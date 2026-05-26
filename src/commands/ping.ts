import { Command, CommandContext } from '../types';
import { WAMessage } from '@whiskeysockets/baileys';
import { Logger } from 'pino';

export default class PingCommand implements Command {
  name = 'ping';
  description = 'Cek latensi dan status bot';
  category = 'info';
  cooldown = 5;

  constructor(private logger: Logger) {}

  async execute(ctx: CommandContext): Promise<void> {
    const start = Date.now();
    
    await ctx.sock.sendMessage(ctx.msg.key!.remoteJid!, { text: 'Pong!' });
    
    const latency = Date.now() - start;
    
    await ctx.sock.sendMessage(ctx.msg.key!.remoteJid!, { 
      text: `Latensi: ${latency}ms\nStatus: Online` 
    }, { quoted: ctx.msg as WAMessage });
  }
}
