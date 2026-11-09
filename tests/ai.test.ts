import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from '../src/services/ai/ai.service';
import { GeminiProvider } from '../src/services/ai/providers/gemini';
import { Config } from '../src/config';
import fs from 'fs-extra';
import pino from 'pino';

// Initialize a dummy logger
const logger = pino({ level: 'silent' });

// Mock @google/genai
const mockGenerateContent = vi.fn().mockResolvedValue({
  text: 'Halo! Saya Eira, asisten AI Anda.',
  candidates: [
    {
      groundingMetadata: {
        groundingChunks: [
          { web: { title: 'Google', uri: 'https://google.com' } }
        ]
      }
    }
  ]
});

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: mockGenerateContent
      };
    }
  };
});

// Mock fs-extra
vi.mock('fs-extra', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }
}));

import { db } from '../src/database';

// Mock ../src/database
vi.mock('../src/database', () => {
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue([]),
    }
  };
});

describe('AI Modular Service', () => {
  const mockConfig: Config = {
    bot: {
      prefix: '.',
      owners: [],
      usePairingCode: false,
    },
    features: {
      sticker: true,
    },
    ai: {
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      enableSearchGrounding: true,
      systemInstruction: 'Fallback system instructions',
      maxHistoryLimit: 10,
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test_api_key';
  });

  describe('GeminiProvider', () => {
    it('should generate content with correct model and grounding options', async () => {
      const provider = new GeminiProvider(mockConfig, logger);
      const result = await provider.generate('Siapa penemu listrik?', {
        systemInstruction: 'Test instructions',
        enableSearchGrounding: true,
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
        model: 'gemini-3.1-flash-lite',
        contents: 'Siapa penemu listrik?',
        config: expect.objectContaining({
          systemInstruction: 'Test instructions',
          tools: [{ googleSearch: {} }]
        })
      }));

      expect(result.text).toBe('Halo! Saya Eira, asisten AI Anda.');
      expect(result.sources).toBeDefined();
      expect(result.sources![0].title).toBe('Google');
      expect(result.sources![0].url).toBe('https://google.com');
    });

    it('should disable search grounding if requested', async () => {
      const provider = new GeminiProvider(mockConfig, logger);
      await provider.generate('Halo!', {
        systemInstruction: 'Test instructions',
        enableSearchGrounding: false,
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
        config: expect.objectContaining({
          tools: undefined
        })
      }));
    });

    it('should include inlineData when images are provided', async () => {
      const provider = new GeminiProvider(mockConfig, logger);
      const dummyBuffer = Buffer.from('fake-image-bytes');
      await provider.generate('Jelaskan gambar ini', {
        images: [{ data: dummyBuffer, mimeType: 'image/jpeg' }],
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: dummyBuffer.toString('base64'),
                  mimeType: 'image/jpeg',
                }
              },
              { text: 'Jelaskan gambar ini' }
            ]
          }
        ]
      }));
    });
  });

  describe('AIService Prompt Loading', () => {
    const mockCtx = {
      msg: {
        key: { remoteJid: '62898xxx@s.whatsapp.net' },
        pushName: 'Farizi'
      },
      config: mockConfig
    } as any;

    it('should load dynamic instructions from file if exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('Detailed file instructions');

      const aiService = new AIService(mockConfig, logger);
      await aiService.ask('Tes prompt', mockCtx);

      expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
        config: expect.objectContaining({
          systemInstruction: expect.stringContaining('Detailed file instructions')
        })
      }));
    });

    it('should fallback to config instructions if file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const aiService = new AIService(mockConfig, logger);
      await aiService.ask('Tes prompt', mockCtx);

      expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
        config: expect.objectContaining({
          systemInstruction: expect.stringContaining('Fallback system instructions')
        })
      }));
    });

    it('should format finalPrompt with quoted message context if present', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const mockCtxWithQuoted = {
        msg: {
          key: { remoteJid: '62898xxx@s.whatsapp.net' },
          message: {
            extendedTextMessage: {
              contextInfo: {
                quotedMessage: {
                  conversation: 'Hello world'
                },
                participant: '62812345@s.whatsapp.net'
              }
            }
          },
          pushName: 'Farizi'
        },
        config: mockConfig
      } as any;

      const aiService = new AIService(mockConfig, logger);
      await aiService.ask('Tolong terjemahkan ini', mockCtxWithQuoted);

      expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
        contents: expect.stringContaining('[Pesan yang Dikutip/Dibalas dari 62812345]:\n"Hello world"'),
      }));
      expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
        contents: expect.stringContaining('[Pertanyaan/Instruksi Pengguna]:\nTolong terjemahkan ini'),
      }));
    });

    it('should use default tanggapi prompt if user prompt is empty but quoted message is present', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const mockCtxWithQuotedOnly = {
        msg: {
          key: { remoteJid: '62898xxx@s.whatsapp.net' },
          message: {
            extendedTextMessage: {
              contextInfo: {
                quotedMessage: {
                  conversation: 'Hello world'
                },
                participant: '62812345@s.whatsapp.net'
              }
            }
          },
          pushName: 'Farizi'
        },
        config: mockConfig
      } as any;

      const aiService = new AIService(mockConfig, logger);
      await aiService.ask('', mockCtxWithQuotedOnly);

      expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
        contents: expect.stringContaining('(Tanggapi atau jawab pesan di atas)'),
      }));
    });

    it('should fetch history from DB and pass it to Gemini provider', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(db.limit).mockResolvedValueOnce([
        { role: 'model', content: 'Halo! Ada yang bisa saya bantu?', timestamp: 123 },
        { role: 'user', content: 'Siapa penemu listrik?', timestamp: 124 }
      ]);

      const aiService = new AIService(mockConfig, logger);
      await aiService.ask('Pertanyaan baru', mockCtx);

      expect(db.limit).toHaveBeenCalled();
      expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
        contents: [
          { role: 'user', parts: [{ text: 'Siapa penemu listrik?' }] },
          { role: 'model', parts: [{ text: 'Halo! Ada yang bisa saya bantu?' }] },
          { role: 'user', parts: [{ text: 'Pertanyaan baru' }] }
        ]
      }));
    });

    it('should insert user message and model response into DB', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(db.limit).mockResolvedValueOnce([]);

      const aiService = new AIService(mockConfig, logger);
      await aiService.ask('Tes logging', mockCtx);

      expect(db.insert).toHaveBeenCalledTimes(2);
      expect(db.values).toHaveBeenCalledWith(expect.objectContaining({
        jid: '62898xxx@s.whatsapp.net',
        role: 'user',
        content: 'Tes logging'
      }));
      expect(db.values).toHaveBeenCalledWith(expect.objectContaining({
        jid: '62898xxx@s.whatsapp.net',
        role: 'model',
        content: 'Halo! Saya Eira, asisten AI Anda.'
      }));
    });

    it('should handle image input and pass to provider', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(db.limit).mockResolvedValueOnce([]);

      const aiService = new AIService(mockConfig, logger);
      const dummyBuffer = Buffer.from('dummy-image');
      await aiService.ask('Apa objek ini?', mockCtx, { buffer: dummyBuffer, mimeType: 'image/png' });

      expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: dummyBuffer.toString('base64'),
                  mimeType: 'image/png',
                }
              },
              { text: 'Apa objek ini?' }
            ]
          }
        ]
      }));

      expect(db.values).toHaveBeenCalledWith(expect.objectContaining({
        role: 'user',
        content: '[Gambar] Apa objek ini?'
      }));
    });
  });
});
