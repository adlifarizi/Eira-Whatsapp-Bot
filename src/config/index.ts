import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import { z } from 'zod';
import logger from '../utils/logger';

// Load environment variables from .env
dotenv.config();

const ConfigSchema = z.object({
  bot: z.object({
    prefix: z.string().default('.'),
    owners: z.array(z.string()).default([]),
    usePairingCode: z.boolean().default(false),
    phoneNumber: z.string().optional(),
  }),
  features: z.object({
    sticker: z.boolean().default(true),
  }),
  ai: z.object({
    provider: z.string().default('gemini'),
    model: z.string().default('gemini-3.1-flash-lite'),
    enableSearchGrounding: z.boolean().default(true),
    systemInstruction: z.string().default('Kamu adalah Eira, asisten AI WhatsApp yang cerdas.'),
    maxHistoryLimit: z.number().int().default(10),
    temperature: z.number().default(0.75),
    maxOutputTokens: z.number().int().default(800),
  }).default({
    provider: 'gemini',
    model: 'gemini-3.1-flash-lite',
    enableSearchGrounding: true,
    systemInstruction: 'Kamu adalah Eira, asisten AI WhatsApp yang cerdas.',
    maxHistoryLimit: 10,
    temperature: 0.75,
    maxOutputTokens: 800,
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const configPath = path.join(process.cwd(), 'config', 'config.yaml');
  let yamlConfig: any = {};

  if (fs.existsSync(configPath)) {
    try {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      yamlConfig = yaml.parse(fileContent);
    } catch (error) {
      logger.error(error, 'Failed to parse config.yaml');
    }
  } else {
    logger.warn('config.yaml not found, using defaults');
  }

  const result = ConfigSchema.safeParse(yamlConfig);

  if (!result.success) {
    logger.error(result.error.format(), 'Invalid configuration');
    process.exit(1);
  }

  return result.data;
}

const config = loadConfig();

export default config;
