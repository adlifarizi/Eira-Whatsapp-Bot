import { Command, CommandContext } from '../types';
import { WAMessage } from '@whiskeysockets/baileys';
import { Logger } from 'pino';
import { AIService } from '../services/ai/ai.service';

export default class AskCommand implements Command {
  name = 'ask';
  description = 'Tanya sesuatu pada Eira.';
  category = 'ai';
  cooldown = 5;

  private aiService?: AIService;

  constructor(private logger: Logger) {}

  async execute(ctx: CommandContext): Promise<void> {
    const prompt = ctx.args.join(' ').trim();
    const jid = ctx.msg.key!.remoteJid!;

    const contextInfo = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const quotedMessage = contextInfo?.quotedMessage;
    const quotedText = quotedMessage?.conversation ||
                       quotedMessage?.extendedTextMessage?.text ||
                       quotedMessage?.imageMessage?.caption ||
                       quotedMessage?.videoMessage?.caption || '';

    if (!prompt && !quotedText) {
      await ctx.sock.sendMessage(jid, {
        text: `Silakan masukkan pertanyaan setelah perintah atau balas (reply) pesan teks dengan perintah \`${ctx.config.bot.prefix}ask\`.`
      }, { quoted: ctx.msg as WAMessage });
      return;
    }

    if (!this.aiService) {
      this.aiService = new AIService(ctx.config, this.logger);
    }

    try {
      // Indicate that the bot is typing/thinking
      await ctx.sock.sendPresenceUpdate('composing', jid);

      // Fetch answer from AIService
      const response = await this.aiService.ask(prompt, ctx);
      
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
      
      // const errMsg = error instanceof Error ? error.message : 'Terjadi kesalahan internal.';
      await ctx.sock.sendMessage(jid, {
        text: `Maaf, terjadi kesalahan saat.`
      }, { quoted: ctx.msg as WAMessage });
    }
  }
}
