/**
 * Minimal request shape for webhook verification and parsing.
 * Providers receive this (e.g. from Edge Function) to avoid hardcoded Node/Deno types.
 */
export interface WebhookRequest {
  method: string;
  /** URL search params (e.g. hub.mode, hub.verify_token) */
  searchParams: URLSearchParams;
  /** Raw body as string (for POST). */
  rawBody: string;
  /** Parsed body if already JSON. */
  body?: unknown;
}

export interface ParsedInboundMessage {
  connectionId: string;
  wa_id: string;
  name: string | null;
  text: string | null;
  media?: { type: 'audio' | 'image' | 'video' | 'document'; url?: string }[];
}

export interface SendMessageParams {
  connectionId: string;
  toWaId: string;
  text: string;
  /** Optional media placeholders for future use. */
  media?: { type: 'audio' | 'image'; url?: string }[];
}

export interface SendMessageResult {
  ok: boolean;
  externalId?: string;
  error?: string;
}

/**
 * WhatsApp provider interface (meta_cloud, evolution, mock).
 * Implementations must not depend on a specific runtime (Node/Deno).
 */
export interface WhatsAppProvider {
  /**
   * Verify webhook subscription (e.g. Meta GET with hub.mode, hub.verify_token).
   * Returns challenge string to respond with 200, or null if verification failed.
   */
  verifyWebhook(req: WebhookRequest, expectedToken: string): Promise<string | null>;

  /**
   * Parse incoming webhook payload into a normalized inbound message.
   * Returns null if the request is not a valid message event.
   */
  parseInboundMessage(
    req: WebhookRequest,
    connectionId: string
  ): Promise<ParsedInboundMessage | null>;

  /**
   * Send a message through the provider. Optional; mock may no-op.
   */
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
}
