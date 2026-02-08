import type { ChannelAdapter, OutgoingMessage, IncomingMessage } from '../channel-adapter';
import { insertAiMessage } from '@/modules/inbox/messages-api';

export const internalAdapter: ChannelAdapter = {
  async sendOutgoingMessage(msg: OutgoingMessage): Promise<void> {
    await insertAiMessage(msg.tenantId, msg.threadId, msg.content);
  },

  normalizeIncomingMessage(payload: unknown): IncomingMessage {
    if (payload && typeof payload === 'object' && 'content' in payload && typeof (payload as { content: unknown }).content === 'string') {
      return { content: (payload as { content: string }).content, raw: payload };
    }
    return { content: '', raw: payload };
  },
};
