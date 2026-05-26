export interface AIMessage {
  role: 'user' | 'model' | 'system';
  content: string;
}

export interface AIGenerateOptions {
  systemInstruction?: string;
  enableSearchGrounding?: boolean;
  conversationHistory?: AIMessage[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface SearchSource {
  title: string;
  url: string;
}

export interface AIResponse {
  text: string;
  sources?: SearchSource[];
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  generate(prompt: string, options?: AIGenerateOptions): Promise<AIResponse>;
}
