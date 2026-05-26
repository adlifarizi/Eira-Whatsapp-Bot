import { WASocket, proto } from '@whiskeysockets/baileys';
import { Logger } from 'pino';
import { Config } from '../config';
import { CommandContext, Command } from '../types';
import { runMiddleware, cooldownMiddleware, permissionMiddleware } from '../middleware';

export class MessageHandler {
  constructor(
    private logger: Logger,
    private config: Config,
    private commands: Map<string, Command>
  ) {}

  async handle(sock: WASocket, msg: proto.IWebMessageInfo) {
    const text = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || 
                 msg.message?.imageMessage?.caption || 
                 msg.message?.videoMessage?.caption || '';

    if (!text.startsWith(this.config.bot.prefix)) return;

    const args = text.slice(this.config.bot.prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = this.commands.get(commandName);

    if (!command) {
      this.logger.debug(`Command not found: ${commandName}`);
      return;
    }

    const ctx: CommandContext = {
      sock,
      msg,
      args,
      logger: this.logger.child({ command: commandName }),
      config: this.config,
    };

    const middlewares = [cooldownMiddleware, permissionMiddleware];
    const shouldContinue = await runMiddleware(ctx, command, middlewares);
    if (!shouldContinue) return;

    try {
      this.logger.info(`Executing command: ${commandName}`);
      await command.execute(ctx);
    } catch (error) {
      this.logger.error(error, `Error executing command ${commandName}`);
      await sock.sendMessage(msg.key!.remoteJid!, { text: 'Terjadi kesalahan saat menjalankan perintah.' });
    }
  }
}
