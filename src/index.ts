import { BotClient } from './bot/client';
import logger from './utils/logger';
import config from './config';
import { CommandRegistry } from './commands';
import { MessageHandler } from './handlers/message';

async function main() {
  logger.info('Starting application...');

  // Initialize command registry
  const commandRegistry = new CommandRegistry(logger);
  await commandRegistry.loadCommands();

  // Initialize message handler with loaded commands
  const messageHandler = new MessageHandler(logger, config, commandRegistry.getCommands());

  // Initialize bot client with message handler
  const botClient = new BotClient(logger, config, messageHandler);
  await botClient.start();
}

main().catch((error) => {
  logger.fatal(error, 'Application failed to start');
  process.exit(1);
});
