import fs from 'fs-extra';
import path from 'path';
import { Command } from '../types';
import { Logger } from 'pino';

export class CommandRegistry {
  private commands = new Map<string, Command>();

  constructor(private logger: Logger) {}

  async loadCommands() {
    const commandsDir = path.join(__dirname);
    const files = fs.readdirSync(commandsDir);

    for (const file of files) {
      // Skip index file and non-ts/js files
      if (file.startsWith('index.') || (!file.endsWith('.ts') && !file.endsWith('.js'))) {
        continue;
      }

      try {
        const modulePath = path.join(commandsDir, file);
        const module = await import(modulePath);
        const CommandClass = module.default;

        if (CommandClass && typeof CommandClass === 'function') {
          // Instantiate the command class
          // We can inject dependencies here
          const command = new CommandClass(this.logger, this.commands) as Command;
          
          if (!command.name) {
            this.logger.warn(`Command in ${file} is missing a name.`);
            continue;
          }

          this.commands.set(command.name, command);
          this.logger.info(`Loaded command: ${command.name}`);
        } else {
          this.logger.warn(`File ${file} does not export a default class.`);
        }
      } catch (error) {
        this.logger.error(error, `Failed to load command from file: ${file}`);
      }
    }
  }

  getCommands(): Map<string, Command> {
    return this.commands;
  }
}
