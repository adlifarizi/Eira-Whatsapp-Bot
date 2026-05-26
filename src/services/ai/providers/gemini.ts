import { GoogleGenAI } from '@google/genai';
import { AIProvider, AIResponse, AIGenerateOptions } from '../types';
import { Config } from '../../../config';
import { Logger } from 'pino';

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  private client: GoogleGenAI;

  constructor(private config: Config, private logger: Logger) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY environment variable is not defined!');
    }
    this.client = new GoogleGenAI({ apiKey: apiKey || '' });
  }

  async generate(prompt: string, options?: AIGenerateOptions): Promise<AIResponse> {
    const modelName = this.config.ai?.model || 'gemini-3.1-flash-lite';
    
    // Configure tools: enable native Google Search Grounding if requested
    const tools: any[] = [];
    if (options?.enableSearchGrounding) {
      tools.push({ googleSearch: {} });
    }

    let contents: any = prompt;

    if (options?.conversationHistory && options.conversationHistory.length > 0) {
      const historyContents = options.conversationHistory.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
      contents = [
        ...historyContents,
        { role: 'user', parts: [{ text: prompt }] }
      ];
    }

    try {
      this.logger.debug(`Calling Gemini model ${modelName} (Search Grounding: ${!!options?.enableSearchGrounding})...`);
      
      const response = await this.client.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: options?.systemInstruction,
          tools: tools.length > 0 ? tools : undefined,
          temperature: options?.temperature,
          maxOutputTokens: options?.maxOutputTokens,
        },
      });

      const candidate = response.candidates?.[0];
      const text = response.text || '';
      
      // Extract Google Search grounding metadata
      const sources: { title: string; url: string }[] = [];
      const groundingMetadata = candidate?.groundingMetadata;
      
      if (groundingMetadata && groundingMetadata.groundingChunks) {
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web?.uri && chunk.web?.title) {
            sources.push({
              title: chunk.web.title,
              url: chunk.web.uri,
            });
          }
        }
      }

      this.logger.debug(`Gemini generated response of length ${text.length} with ${sources.length} sources`);

      return {
        text,
        sources: sources.length > 0 ? sources : undefined,
      };
    } catch (error) {
      this.logger.error(error, `Gemini API generation failed for model ${modelName}`);
      throw error;
    }
  }
}
