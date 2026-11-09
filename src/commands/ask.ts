import { Command, CommandContext } from '../types';
import { downloadMediaMessage, WAMessage } from '@whiskeysockets/baileys';
import { Logger } from 'pino';
import { AIService } from '../services/ai/ai.service';

export default class AskCommand implements Command {
  name = 'ask';
  description = 'Tanya sesuatu pada Eira (mendukung teks dan gambar).';
  category = 'ai';
  cooldown = 5;

  private aiService?: AIService;

  constructor(private logger: Logger) {}

  async execute(ctx: CommandContext): Promise<void> {
    const prompt = ctx.args.join(' ').trim();
    const jid = ctx.msg.key!.remoteJid!;

    const contextInfo = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;
    
    // Check for image directly in message or in quoted message
    const directImage = ctx.msg.message?.imageMessage || 
                        ctx.msg.message?.viewOnceMessage?.message?.imageMessage || 
                        ctx.msg.message?.viewOnceMessageV2?.message?.imageMessage;
    const quotedImage = quoted?.imageMessage || 
                        quoted?.viewOnceMessage?.message?.imageMessage || 
                        quoted?.viewOnceMessageV2?.message?.imageMessage;
    const hasImage = !!(directImage || quotedImage);

    const quotedText = quoted?.conversation ||
                       quoted?.extendedTextMessage?.text ||
                       quoted?.imageMessage?.caption ||
                       quoted?.videoMessage?.caption || '';

    if (!prompt && !quotedText && !hasImage) {
      await ctx.sock.sendMessage(jid, {
        text: `Silakan masukkan pertanyaan setelah perintah atau kirim/balas gambar/teks dengan perintah \`${ctx.config.bot.prefix}ask [pertanyaan]\`.`
      }, { quoted: ctx.msg as WAMessage });
      return;
    }

    if (!this.aiService) {
      this.aiService = new AIService(ctx.config, this.logger);
    }

    try {
      // Indicate that the bot is typing/thinking
      await ctx.sock.sendPresenceUpdate('composing', jid);

      let imageMedia: { buffer: Buffer; mimeType: string } | undefined;

      if (hasImage) {
        try {
          const mediaMessage = directImage ? ctx.msg.message : quoted;
          const mimeType = (directImage || quotedImage)?.mimetype || 'image/jpeg';
          const buffer = await downloadMediaMessage(
            { message: mediaMessage } as any,
            'buffer',
            {}
          ) as Buffer;

          if (buffer && buffer.length > 0) {
            imageMedia = { buffer, mimeType };
          }
        } catch (downloadErr) {
          this.logger.error(downloadErr, 'Failed to download image for AI ask command');
        }
      }

      // Fetch answer from AIService
      const response = await this.aiService.ask(prompt, ctx, imageMedia);
      
      let replyText = response.text;

      // Format citations from search grounding
      if (response.sources && response.sources.length > 0) {
        replyText += '\n\n*Sumber Referensi:*';
        // Filter unique references to avoid duplicates
        const uniqueSources = response.sources.filter(
          (src, idx, self) => self.findIndex(s => s.url === src.url) === idx
        );
        uniqueSources.forEach((src, idx) => {
          replyText += `\n${idx + 1}. ${src.title} (${src.url})`;
        });
      }

      // Stop composing state
      await ctx.sock.sendPresenceUpdate('paused', jid);
      
      // Reply to user
      await ctx.sock.sendMessage(jid, { text: replyText }, { quoted: ctx.msg as WAMessage });

    } catch (error) {
      this.logger.error(error, 'Error in ask command execution');
      
      // Safety pause composing state
      await ctx.sock.sendPresenceUpdate('paused', jid);
      
      await ctx.sock.sendMessage(jid, {
        text: `Maaf, terjadi kesalahan saat memproses permintaan AI.`
      }, { quoted: ctx.msg as WAMessage });
    }
  }
}
