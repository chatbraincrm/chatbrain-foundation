/**
 * Channel adapters for sending agent replies and normalizing incoming messages.
 * Internal uses insert_ai_message RPC; WhatsApp will be implemented later.
 */

export interface OutgoingMessage {
  tenantId: string;
  threadId: string;
  content: string;
}

export interface IncomingMessage {
  content: string;
  /** Optional: raw payload from channel for future use (e.g. media IDs) */
  raw?: unknown;
}

export interface ChannelAdapter {
  /** Send a message from the agent into the channel (e.g. insert_ai_message for internal). */
  sendOutgoingMessage(msg: OutgoingMessage): Promise<void>;
  /** Normalize channel-specific payload into a unified IncomingMessage. */
  normalizeIncomingMessage(payload: unknown): IncomingMessage;
}

export type ChannelType = 'internal' | 'whatsapp';
