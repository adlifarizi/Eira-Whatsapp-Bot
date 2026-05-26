import { Command, CommandContext } from '../types';
import { WAMessage } from '@whiskeysockets/baileys';
import { Logger } from 'pino';

export default class MenuCommand implements Command {
  name = 'menu';
  description = 'Menampilkan semua perintah yang tersedia berdasarkan kategori';
  category = 'info';
  cooldown = 5;

  constructor(
    private logger: Logger,
    private commands: Map<string, Command>
  ) {}

  async execute(ctx: CommandContext): Promise<void> {
    const categories = new Map<string, string[]>();

    this.commands.forEach((command) => {
      if (command.hidden) return;
      const category = command.category || 'lainnya';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(command.name);
    });

    let text = '*Menu Eira Bot*\n\n';
    
    categories.forEach((commands, category) => {
      text += `*${category.toUpperCase()}*\n`;
      commands.forEach((name) => {
        text += `  .${name}\n`;
      });
      text += '\n';
    });

    text += 'Gunakan `.help <perintah>` untuk info lebih lanjut.';

    await ctx.sock.sendMessage(ctx.msg.key!.remoteJid!, { text }, { quoted: ctx.msg as WAMessage });
  }
}
