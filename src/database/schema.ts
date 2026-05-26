import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const cooldowns = sqliteTable('cooldowns', {
  id: text('id').primaryKey(), // Format: "userId:commandName"
  timestamp: integer('timestamp').notNull(),
});

export const commandSettings = sqliteTable('command_settings', {
  id: text('id').primaryKey(), // Format: "groupId:commandName"
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
});

export const aiChatHistory = sqliteTable('ai_chat_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jid: text('jid').notNull(),
  role: text('role').notNull(), // 'user' | 'model'
  content: text('content').notNull(),
  timestamp: integer('timestamp').notNull(),
});
