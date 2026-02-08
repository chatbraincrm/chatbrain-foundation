import type { ChannelAdapter, OutgoingMessage, IncomingMessage } from '../channel-adapter';

class NotImplementedError extends Error {
  constructor() {
    super('WhatsApp adapter not implemented yet');
    this.name = 'NotImplementedError';
  }
}

export const whatsappAdapter: ChannelAdapter = {
  async sendOutgoingMessage(_msg: OutgoingMessage): Promise<void> {
    throw new NotImplementedError();
  },

  normalizeIncomingMessage(_payload: unknown): IncomingMessage {
    throw new NotImplementedError();
  },
};
