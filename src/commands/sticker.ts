import { Command, CommandContext } from '../types';
import { Logger } from 'pino';
import { downloadMediaMessage, WAMessage } from '@whiskeysockets/baileys';
import { imageToSticker, videoToSticker } from '../utils/media';

export default class StickerCommand implements Command {
  name = 'sticker';
  description = 'Ubah gambar atau video menjadi stiker';
  category = 'media';
  cooldown = 5;

  constructor(private logger: Logger) {}

  async execute(ctx: CommandContext): Promise<void> {
    const quoted = ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = ctx.msg.message?.imageMessage || quoted?.imageMessage;
    const isVideo = ctx.msg.message?.videoMessage || quoted?.videoMessage;

    if (!isImage && !isVideo) {
      await ctx.sock.sendMessage(ctx.msg.key!.remoteJid!, { 
        text: 'Silakan kirim atau balas gambar, gif, atau video dengan .sticker' 
      });
      return;
    }

    try {
      const mediaContent = quoted || ctx.msg.message;
      
      const buffer = await downloadMediaMessage(
        { message: mediaContent } as any,
        'buffer',
        {}
      ) as Buffer;

      let stickerBuffer: Buffer;

      if (isImage) {
        stickerBuffer = await imageToSticker(buffer);
      } else {
        stickerBuffer = await videoToSticker(buffer);
      }

      await ctx.sock.sendMessage(ctx.msg.key!.remoteJid!, { sticker: stickerBuffer }, { quoted: ctx.msg as WAMessage });
    } catch (error) {
      this.logger.error(error, 'Failed to create sticker');
      await ctx.sock.sendMessage(ctx.msg.key!.remoteJid!, { text: 'Gagal membuat stiker.' });
    }
  }
}
