import { Config } from '../../config';
import { AIProvider, AIResponse } from './types';
import { GeminiProvider } from './providers/gemini';
import { Logger } from 'pino';
import { CommandContext } from '../../types';
import { db } from '../../database';
import { aiChatHistory } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';
import fs from 'fs-extra';
import path from 'path';

export class AIService {
  private activeProvider: AIProvider;

  constructor(private config: Config, private logger: Logger) {
    // In the future, other providers can be initialized and registered here
    this.activeProvider = new GeminiProvider(config, logger);
  }

  /**
   * Generates a grounded response for a given user prompt.
   */
  async ask(prompt: string, ctx: CommandContext): Promise<AIResponse> {
    const baseSystemInstruction = this.loadSystemInstruction();
    const enableSearchGrounding = this.config.ai?.enableSearchGrounding ?? false;

    // Gather user and chat metadata
    const isGroup = ctx.msg.key?.remoteJid?.endsWith('@g.us');
    const userJid = isGroup ? (ctx.msg.key?.participant || ctx.msg.participant || '') : ctx.msg.key?.remoteJid;
    const pushName = ctx.msg.pushName || 'Pengguna';
    const remoteJid = ctx.msg.key?.remoteJid || '';
    
    // Get formatted local time/date (Jakarta timezone)
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' });

    // Assemble rich dynamic context instructions
    const dynamicContext = `
[INFORMASI KONTEKS INTERAKSI]
- Hari/Tanggal: ${dateStr}
- Waktu Sekarang: ${timeStr} (Zona Waktu: Asia/Jakarta)
- Nama WhatsApp Pengirim: ${pushName}
- WhatsApp ID Pengirim: ${userJid?.split('@')[0]}
- Jenis Obrolan: ${isGroup ? 'Grup WhatsApp' : 'Obrolan Pribadi (DM)'}
- Prefix Bot Saat Ini: "${ctx.config.bot.prefix}"

PANDUAN TAMBAHAN:
- Sapa pengirim menggunakan nama panggilannya ("${pushName}") atau hanya nama depannya dengan hangat di saat-saat tertentu untuk obrolan yang lebih personal.
- Gunakan waktu dan tanggal di atas secara akurat jika pengguna menanyakan waktu atau tanggal (misalnya "hari ini hari apa", "sekarang jam berapa", "besok tanggal berapa").
    `.trim();

    // Check for quoted message context
    const contextInfo = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const quotedMessage = contextInfo?.quotedMessage;
    const quotedSender = contextInfo?.participant || '';
    const quotedText = quotedMessage?.conversation ||
                       quotedMessage?.extendedTextMessage?.text ||
                       quotedMessage?.imageMessage?.caption ||
                       quotedMessage?.videoMessage?.caption || '';

    let finalPrompt = prompt;
    if (quotedText) {
      const quotedSenderNumber = quotedSender ? quotedSender.split('@')[0] : 'Pengguna';
      if (prompt) {
        finalPrompt = `[Pesan yang Dikutip/Dibalas dari ${quotedSenderNumber}]:\n"${quotedText}"\n\n[Pertanyaan/Instruksi Pengguna]:\n${prompt}`;
      } else {
        finalPrompt = `[Pesan yang Dikutip/Dibalas dari ${quotedSenderNumber}]:\n"${quotedText}"\n\n(Tanggapi atau jawab pesan di atas)`;
      }
    }

    // Retrieve previous history for JID
    const limit = this.config.ai?.maxHistoryLimit || 10;
    let conversationHistory: any[] = [];
    if (remoteJid) {
      try {
        const historyLogs = await db
          .select()
          .from(aiChatHistory)
          .where(eq(aiChatHistory.jid, remoteJid))
          .orderBy(desc(aiChatHistory.timestamp))
          .limit(limit);

        // Reverse to keep oldest first (chronological order)
        conversationHistory = historyLogs
          .reverse()
          .map(log => ({
            role: log.role as 'user' | 'model',
            content: log.content,
          }));
      } catch (error) {
        this.logger.error(error, `Failed to retrieve chat history for ${remoteJid}`);
      }
    }

    // Save user query/prompt to DB
    if (remoteJid) {
      try {
        await db.insert(aiChatHistory).values({
          jid: remoteJid,
          role: 'user',
          content: finalPrompt,
          timestamp: Date.now(),
        });
      } catch (error) {
        this.logger.error(error, `Failed to save user prompt to chat history`);
      }
    }

    const finalSystemInstruction = `${baseSystemInstruction}\n\n${dynamicContext}`;

    this.logger.info(`Sending prompt to ${this.activeProvider.name} (Sender: ${pushName})`);

    const temperature = this.config.ai?.temperature ?? 0.75;
    const maxOutputTokens = this.config.ai?.maxOutputTokens ?? 800;

    const response = await this.activeProvider.generate(finalPrompt, {
      systemInstruction: finalSystemInstruction,
      enableSearchGrounding,
      conversationHistory,
      temperature,
      maxOutputTokens,
    });

    // Save AI response to DB
    if (remoteJid && response.text) {
      try {
        await db.insert(aiChatHistory).values({
          jid: remoteJid,
          role: 'model',
          content: response.text,
          timestamp: Date.now(),
        });
      } catch (error) {
        this.logger.error(error, `Failed to save AI response to chat history`);
      }
    }

    return response;
  }

  /**
   * Dynamically loads Eira's detailed system instructions from config/system-instruction.txt.
   * If the file is missing or empty, it falls back to config.yaml settings or a default.
   */
  private loadSystemInstruction(): string {
    const promptPath = path.join(process.cwd(), 'config', 'system-instruction.txt');
    
    if (fs.existsSync(promptPath)) {
      try {
        const content = fs.readFileSync(promptPath, 'utf8').trim();
        if (content) {
          this.logger.debug('Loaded detailed system instructions from config/system-instruction.txt');
          return content;
        }
      } catch (error) {
        this.logger.error(error, 'Failed to read detailed system instructions from file');
      }
    }

    this.logger.debug('Detailed system instruction file not found, using fallback from configuration');
    return this.config.ai?.systemInstruction || 'Kamu adalah Eira, asisten AI WhatsApp yang cerdas.';
  }
}
