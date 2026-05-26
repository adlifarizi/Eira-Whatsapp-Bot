import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket,
} from '@whiskeysockets/baileys';
import path from 'path';
import { Logger } from 'pino';
import { Config } from '../config';
import { MessageHandler } from '../handlers/message';

export class BotClient {
  private sock: WASocket | null = null;

  constructor(
    private logger: Logger,
    private config: Config,
    private messageHandler: MessageHandler
  ) {}

  async start() {
    const authDir = path.join(process.cwd(), 'storage', 'auth');
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();
    
    this.logger.info(`Starting bot with Baileys version ${version}`);

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: !this.config.bot.usePairingCode,
      logger: this.logger as any,
    });

    if (this.config.bot.usePairingCode && !state.creds.registered) {
      const phoneNumber = this.config.bot.phoneNumber;
      if (!phoneNumber) {
        this.logger.error('Phone number is required for pairing code');
      } else {
        setTimeout(async () => {
          try {
            const code = await this.sock!.requestPairingCode(phoneNumber);
            this.logger.info(`Pairing code: ${code}`);
            console.log(`\n=================================\nYour Pairing Code: ${code}\n=================================\n`);
          } catch (error) {
            this.logger.error(error, 'Failed to request pairing code');
          }
        }, 5000);
      }
    }

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.logger.warn(`Connection closed. Reconnecting: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          this.start();
        }
      } else if (connection === 'open') {
        this.logger.info('Bot connected to WhatsApp!');
      }
    });

    this.sock.ev.on('messages.upsert', async (m) => {
      for (const msg of m.messages) {
        if (!msg.key.fromMe && m.type === 'notify') {
          await this.messageHandler.handle(this.sock!, msg);
        }
      }
    });
  }

  getSocket(): WASocket | null {
    return this.sock;
  }
}
