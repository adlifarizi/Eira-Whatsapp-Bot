# Eira WhatsApp Bot

A personal, production-ready WhatsApp bot assistant built with Node.js, TypeScript, and the Baileys library. 

> [!NOTE]
> This is my personal WhatsApp bot (Eira) built and customized specifically for my personal daily use cases. The repository is open-source and public for transparency, sharing, and showcase purposes. You are welcome to fork, modify, or run your own instance, but please note that features and updates are tailored to my own requirements.

## Technology Stack

- **Core:** Node.js (LTS), TypeScript, Baileys
- **AI Engine:** Google Gemini (via `@google/genai`)
- **Database:** SQLite (via `better-sqlite3` and `drizzle-orm`)
- **Logging:** Pino for structured and high-performance logging
- **Media Processing:** FFmpeg and Sharp for advanced sticker generation and image processing

## Features

- **AI Conversation Assistant (`.ask`)**: Powered by Google Gemini with context-aware responses.
- **Conversation Memory**: Remembers past turns of conversation by retrieving history records from a local SQLite database for context-rich interactions.
- **Advanced Sticker Creation**: Supports images, animated GIFs, and videos. Automatically handles aspect ratio correction and size optimization.
- **Command Framework**: Fully modular command loading system with built-in cooldowns and category management.
- **Container Ready**: Includes full Docker and Docker Compose support.

## Architecture

The project follows a modular structure to ensure a clean codebase:

- `src/bot`: Core connection logic and WhatsApp event handling.
- `src/commands`: Modular command definitions.
- `src/config`: Configuration management and validation.
- `src/database`: Persistence layer, schema definitions, and table migrations.
- `src/handlers`: Primary message routing logic.
- `src/middleware`: Request pipeline for cross-cutting concerns (e.g., cooldowns).
- `src/services/ai`: Abstraction layers and concrete Gemini providers for AI capability.
- `src/utils`: Technical utility functions, including optimized media processing.

## Setup Instructions

### Prerequisites

- Node.js 20.x or higher
- FFmpeg (required for video and GIF sticker processing)

### Installation

1.  **Clone and Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configuration**:
    *   **YAML Config**: Copy the example config file:
        ```bash
        cp config/config.example.yaml config/config.yaml
        ```
        Open `config/config.yaml` and adjust basic settings (prefix, owner phone numbers, phone pairing settings).
    *   **Environment Variables**: Copy the template environment file:
        ```bash
        cp .env.example .env
        ```
        Open `.env` and fill in your variables. Specifically, set your `GEMINI_API_KEY` to enable the AI features.

### Running the Application

For optimal performance and compatibility, it is recommended to build the project before execution:

1.  **Build the Project**:
    ```bash
    npm run build
    ```

2.  **Start the Application**:
    ```bash
    npm start
    ```

## Usage Guide

The bot operates using a prefix-based command system. The default prefix is `.`.

### Media Commands

#### .sticker
Convert images, videos, or GIFs into WhatsApp stickers.
- **Image**: Send or reply to an image with `.sticker`.
- **Video/GIF**: Send or reply to a video or GIF with `.sticker`.
- **Features**: 
  - Preserves aspect ratio with transparent padding.
  - Automatically optimizes file size to stay below WhatsApp's 1MB limit.
  - Limits animation duration to 6 seconds for compatibility.

### AI Commands

#### .ask
Interact with the Google Gemini AI assistant (Eira).
- **Format**: `.ask [prompt]` or reply to any message with `.ask`.
- **Features**: 
  - Automatically loads and maps dynamic conversational context (time zone, sender details, group/private type).
  - Handles reply/quoted messages automatically as prompt context.
  - Maintains conversation history using local SQLite storage for multi-turn capability.

### Utility Commands

#### .ping
Verify the bot's responsiveness and check system latency.

#### .menu
Display the full list of available commands categorized by feature.

## Development

### Adding New Commands

To implement a new command, create a TypeScript file in `src/commands/`. The bot will automatically discover and register the command.

Example implementation:

```typescript
import { Command, CommandContext } from '../types';
import { WAMessage } from '@whiskeysockets/baileys';

export default class ExampleCommand implements Command {
  name = 'example';
  description = 'Detailed description of the command';
  category = 'utility';
  cooldown = 5;

  async execute(ctx: CommandContext): Promise<void> {
    const response = 'Action executed successfully.';
    await ctx.sock.sendMessage(ctx.msg.key!.remoteJid!, { text: response }, { quoted: ctx.msg as WAMessage });
  }
}
```

### Docker Deployment

Deploy the application using the provided Docker configurations:

- **Production Environment**:
  ```bash
  docker-compose up bot-prod
  ```
- **Development Environment**:
  ```bash
  docker-compose up bot-dev
  ```

## License

This project is licensed under the [MIT License](LICENSE) - see the [LICENSE](LICENSE) file for details.
