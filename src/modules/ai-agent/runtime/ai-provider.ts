export class MissingAiKeyError extends Error {
  constructor() {
    super('OPENAI_API_KEY is not configured');
    this.name = 'MissingAiKeyError';
  }
}

export interface AiProviderInput {
  systemPrompt: string;
  userPrompt?: string | null;
  conversation: { role: 'user' | 'assistant'; content: string }[];
}

export interface AiProvider {
  generateResponse(input: AiProviderInput): Promise<string>;
}

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAiProvider implements AiProvider {
  private apiKey: string | null;

  constructor(apiKey: string | null) {
    this.apiKey = apiKey?.trim() || null;
  }

  async generateResponse(input: AiProviderInput): Promise<string> {
    if (!this.apiKey) {
      throw new MissingAiKeyError();
    }

    const messages: { role: string; content: string }[] = [
      { role: 'system', content: input.systemPrompt },
    ];
    if (input.userPrompt?.trim()) {
      messages.push({ role: 'user', content: input.userPrompt });
      messages.push({
        role: 'assistant',
        content: 'Entendido. Vou seguir essas instruções no contexto da conversa.',
      });
    }
    for (const m of input.conversation) {
      messages.push({ role: m.role, content: m.content });
    }

    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI API error: ${res.status} ${errBody}`);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content ?? '';
  }
}
