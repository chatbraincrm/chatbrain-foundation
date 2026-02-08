import type {
  WhatsAppProvider,
  WebhookRequest,
  ParsedInboundMessage,
  SendMessageParams,
  SendMessageResult,
} from './types';

/**
 * Meta Cloud API placeholder. Not implemented in V1.
 */
export const metaCloudProvider: WhatsAppProvider = {
  async verifyWebhook(_req: WebhookRequest, _expectedToken: string): Promise<string | null> {
    return null;
  },

  async parseInboundMessage(
    _req: WebhookRequest,
    _connectionId: string
  ): Promise<ParsedInboundMessage | null> {
    return null;
  },

  async sendMessage(_params: SendMessageParams): Promise<SendMessageResult> {
    return { ok: false, error: 'Meta Cloud provider not implemented' };
  },
};
