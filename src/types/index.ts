import { WASocket, proto } from '@whiskeysockets/baileys';
import { Logger } from 'pino';
import { Config } from '../config';

export interface CommandContext {
  sock: WASocket;
  msg: proto.IWebMessageInfo;
  args: string[];
  logger: Logger;
  config: Config;
}

export interface Command {
  name: string;
  description: string;
  category: string;
  cooldown?: number;
  permissions?: string[];
  hidden?: boolean;
  execute(ctx: CommandContext): Promise<void>;
}
