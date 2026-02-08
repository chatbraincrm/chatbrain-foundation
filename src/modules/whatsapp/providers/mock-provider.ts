import type {
  WhatsAppProvider,
  WebhookRequest,
  ParsedInboundMessage,
  SendMessageParams,
  SendMessageResult,
} from './types';

/**
 * Mock provider for tests and local Inbox simulation.
 * - verifyWebhook: accepts hub.verify_token === expectedToken, returns hub.challenge.
 * - parseInboundMessage: expects JSON body { wa_id, name?, text?, media? }.
 * - sendMessage: no-op, returns ok.
 */
export const mockProvider: WhatsAppProvider = {
  async verifyWebhook(req: WebhookRequest, expectedToken: string): Promise<string | null> {
    if (req.method !== 'GET') return null;
    const token = req.searchParams.get('hub.verify_token');
    const challenge = req.searchParams.get('hub.challenge');
    if (token !== expectedToken || !challenge) return null;
    return challenge;
  },

  async parseInboundMessage(
    req: WebhookRequest,
    connectionId: string
  ): Promise<ParsedInboundMessage | null> {
    if (req.method !== 'POST') return null;
    let data: unknown = req.body;
    if (!data && req.rawBody) {
      try {
        data = JSON.parse(req.rawBody) as unknown;
      } catch {
        return null;
      }
    }
    if (!data || typeof data !== 'object') return null;
    const o = data as Record<string, unknown>;
    const wa_id = typeof o.wa_id === 'string' ? o.wa_id : null;
    if (!wa_id) return null;
    const name = typeof o.name === 'string' ? o.name : null;
    const text = typeof o.text === 'string' ? o.text : null;
    const media = Array.isArray(o.media)
      ? (o.media as { type?: string; url?: string }[])
          .filter((m) => m && typeof m.type === 'string')
          .map((m) => ({
            type: m.type as 'audio' | 'image' | 'video' | 'document',
            url: typeof m.url === 'string' ? m.url : undefined,
          }))
      : undefined;
    return {
      connectionId,
      wa_id,
      name: name ?? null,
      text: text ?? null,
      media: media?.length ? media : undefined,
    };
  },

  async sendMessage(_params: SendMessageParams): Promise<SendMessageResult> {
    return { ok: true };
  },
};
