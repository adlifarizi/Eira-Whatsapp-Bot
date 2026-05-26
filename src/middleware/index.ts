import { CommandContext, Command } from '../types';
import { db } from '../database';
import { cooldowns } from '../database/schema';
import { eq } from 'drizzle-orm';

export type Middleware = (ctx: CommandContext, command: Command) => Promise<boolean>;

/**
 * Run a pipeline of middlewares.
 * Returns false if any middleware aborts the execution.
 */
export async function runMiddleware(ctx: CommandContext, command: Command, middlewares: Middleware[]): Promise<boolean> {
  for (const middleware of middlewares) {
    const shouldContinue = await middleware(ctx, command);
    if (!shouldContinue) return false;
  }
  return true;
}

/**
 * Cooldown middleware to prevent spamming
 */
export const cooldownMiddleware: Middleware = async (ctx, command) => {
  if (!command.cooldown) return true;

  const userId = ctx.msg.key!.participant || ctx.msg.key!.remoteJid!;
  const id = `${userId}:${command.name}`;
  
  const [existing] = await db.select().from(cooldowns).where(eq(cooldowns.id, id));
  
  const now = Date.now();
  if (existing && now - existing.timestamp < command.cooldown * 1000) {
    const timeLeft = ((command.cooldown * 1000 - (now - existing.timestamp)) / 1000).toFixed(1);
    await ctx.sock.sendMessage(ctx.msg.key!.remoteJid!, { text: `Harap tunggu ${timeLeft} detik sebelum menggunakan perintah ini lagi.` });
    return false;
  }

  // Update cooldown
  await db.insert(cooldowns).values({ id, timestamp: now }).onConflictDoUpdate({
    target: cooldowns.id,
    set: { timestamp: now },
  });

  return true;
};

/**
 * Permission middleware to restrict access
 */
export const permissionMiddleware: Middleware = async (ctx, command) => {
  if (!command.permissions) return true;
  
  const userId = ctx.msg.key!.participant || ctx.msg.key!.remoteJid!;
  // Clean JID to get just the number if needed, but usually JID is fine
  const isOwner = ctx.config.bot.owners.includes(userId) || ctx.config.bot.owners.some(owner => userId.startsWith(owner));

  if (command.permissions.includes('owner') && !isOwner) {
    await ctx.sock.sendMessage(ctx.msg.key!.remoteJid!, { text: 'Perintah ini hanya dapat digunakan oleh pemilik bot.' });
    return false;
  }

  return true;
};
