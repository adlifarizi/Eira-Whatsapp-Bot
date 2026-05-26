import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import logger from '../utils/logger';
import * as schema from './schema';

const dbDir = path.join(process.cwd(), 'storage');
// Ensure storage directory exists
fs.ensureDirSync(dbDir);

const dbPath = path.join(dbDir, 'bot.db');

const sqlite = new Database(dbPath);

// Ensure tables exist (Simple alternative to migrations)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS cooldowns (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS command_settings (
    id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS ai_chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jid TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );
`);

const db = drizzle(sqlite, { schema });

logger.info('Database initialized at %s', dbPath);

export { db, sqlite };
