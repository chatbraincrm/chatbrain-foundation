import { describe, it, expect } from 'vitest';
import { mockProvider } from '@/modules/whatsapp/providers/mock-provider';
import { buildWebhookRequest } from '@/modules/whatsapp/webhook-handler';
import { linkThreadSchema } from '@/modules/whatsapp/whatsapp-validators';

describe('WhatsApp mock provider', () => {
  describe('verifyWebhook', () => {
    it('returns challenge when GET and hub.verify_token matches expectedToken', async () => {
      const req = buildWebhookRequest({
        method: 'GET',
        url: 'http://localhost/webhook?hub.mode=subscribe&hub.verify_token=secret123&hub.challenge=challenge456',
        rawBody: '',
      });
      const result = await mockProvider.verifyWebhook(req, 'secret123');
      expect(result).toBe('challenge456');
    });

    it('returns null when verify_token does not match', async () => {
      const req = buildWebhookRequest({
        method: 'GET',
        url: 'http://localhost/webhook?hub.verify_token=wrong&hub.challenge=challenge456',
        rawBody: '',
      });
      const result = await mockProvider.verifyWebhook(req, 'secret123');
      expect(result).toBeNull();
    });

    it('returns null for POST', async () => {
      const req = buildWebhookRequest({
        method: 'POST',
        url: 'http://localhost/webhook',
        rawBody: '{}',
      });
      const result = await mockProvider.verifyWebhook(req, 'secret123');
      expect(result).toBeNull();
    });
  });

  describe('parseInboundMessage', () => {
    it('parses POST body with wa_id and text', async () => {
      const body = { wa_id: '5511999999999', name: 'João', text: 'Olá!' };
      const req = buildWebhookRequest({
        method: 'POST',
        url: 'http://localhost/webhook',
        rawBody: JSON.stringify(body),
        body,
      });
      const result = await mockProvider.parseInboundMessage(req, 'conn-uuid-1');
      expect(result).toEqual({
        connectionId: 'conn-uuid-1',
        wa_id: '5511999999999',
        name: 'João',
        text: 'Olá!',
        media: undefined,
      });
    });

    it('parses POST body with wa_id and media', async () => {
      const body = {
        wa_id: '5511888888888',
        media: [{ type: 'image', url: 'https://example.com/img.png' }, { type: 'audio' }],
      };
      const req = buildWebhookRequest({
        method: 'POST',
        url: 'http://localhost/webhook',
        rawBody: JSON.stringify(body),
        body,
      });
      const result = await mockProvider.parseInboundMessage(req, 'conn-uuid-2');
      expect(result).not.toBeNull();
      expect(result!.wa_id).toBe('5511888888888');
      expect(result!.media).toHaveLength(2);
      expect(result!.media![0]).toEqual({ type: 'image', url: 'https://example.com/img.png' });
      expect(result!.media![1]).toEqual({ type: 'audio', url: undefined });
    });

    it('returns null when body has no wa_id', async () => {
      const req = buildWebhookRequest({
        method: 'POST',
        url: 'http://localhost/webhook',
        rawBody: JSON.stringify({ text: 'no wa_id' }),
        body: { text: 'no wa_id' },
      });
      const result = await mockProvider.parseInboundMessage(req, 'conn-uuid');
      expect(result).toBeNull();
    });

    it('returns null for GET', async () => {
      const req = buildWebhookRequest({
        method: 'GET',
        url: 'http://localhost/webhook',
        rawBody: '',
      });
      const result = await mockProvider.parseInboundMessage(req, 'conn-uuid');
      expect(result).toBeNull();
    });
  });

  describe('sendMessage', () => {
    it('returns ok without sending (mock)', async () => {
      const result = await mockProvider.sendMessage({
        connectionId: 'c1',
        toWaId: '5511999999999',
        text: 'Test',
      });
      expect(result).toEqual({ ok: true });
    });
  });
});

describe('WhatsApp link thread validator', () => {
  it('accepts valid linkThread input', () => {
    const input = {
      connection_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      wa_chat_id: '5511999999999@s.whatsapp.net',
      wa_contact_phone: '5511999999999',
      wa_contact_name: 'João',
      thread_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    };
    const parsed = linkThreadSchema.parse(input);
    expect(parsed.connection_id).toBe(input.connection_id);
    expect(parsed.wa_chat_id).toBe(input.wa_chat_id);
    expect(parsed.thread_id).toBe(input.thread_id);
  });

  it('rejects invalid thread_id', () => {
    expect(() =>
      linkThreadSchema.parse({
        connection_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        wa_chat_id: '5511999999999',
        thread_id: 'not-a-uuid',
      })
    ).toThrow();
  });

  it('rejects empty wa_chat_id', () => {
    expect(() =>
      linkThreadSchema.parse({
        connection_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        wa_chat_id: '',
        thread_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      })
    ).toThrow();
  });
});
