import { Command, CommandContext } from '../types';
import { WAMessage } from '@whiskeysockets/baileys';
import { Logger } from 'pino';

export default class HelpCommand implements Command {
  name = 'help';
  description = 'Menampilkan bantuan detail perintah';
  category = 'info';
  cooldown = 5;

  constructor(
    private logger: Logger,
    private commands: Map<string, Command>
  ) {}

  async execute(ctx: CommandContext): Promise<void> {
    const commandName = ctx.args[0]?.toLowerCase();

    if (commandName) {
      const command = this.commands.get(commandName);
      if (!command) {
        await ctx.sock.sendMessage(ctx.msg.key!.remoteJid!, { text: `Perintah .${commandName} tidak ditemukan.` });
        return;
      }

      const text = `*Perintah:* .${command.name}\n` +
                   `*Deskripsi:* ${command.description}\n` +
                   `*Kategori:* ${command.category}\n` +
                   `*Jeda:* ${command.cooldown || 0}d`;
      
      await ctx.sock.sendMessage(ctx.msg.key!.remoteJid!, { text }, { quoted: ctx.msg as WAMessage });
      return;
    }

    // Generic help
    await ctx.sock.sendMessage(ctx.msg.key!.remoteJid!, { 
      text: 'Gunakan `.help <nama_perintah>` untuk melihat detail perintah tertentu.\nGunakan `.menu` untuk melihat semua perintah.' 
    }, { quoted: ctx.msg as WAMessage });
  }
}
