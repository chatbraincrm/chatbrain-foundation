import { describe, it, expect } from 'vitest';
import { createThreadSchema, sendMessageSchema } from '@/lib/validators';

describe('Inbox Validators', () => {
  describe('createThreadSchema', () => {
    it('accepts valid thread with channel_id', () => {
      expect(
        createThreadSchema.safeParse({
          channel_id: '550e8400-e29b-41d4-a716-446655440000',
        }).success
      ).toBe(true);
    });

    it('accepts thread with subject', () => {
      expect(
        createThreadSchema.safeParse({
          channel_id: '550e8400-e29b-41d4-a716-446655440000',
          subject: 'Novo lead',
        }).success
      ).toBe(true);
    });

    it('accepts thread with related entity', () => {
      expect(
        createThreadSchema.safeParse({
          channel_id: '550e8400-e29b-41d4-a716-446655440000',
          related_entity: 'lead',
          related_entity_id: '550e8400-e29b-41d4-a716-446655440001',
        }).success
      ).toBe(true);
    });

    it('rejects invalid channel_id', () => {
      expect(
        createThreadSchema.safeParse({ channel_id: 'not-a-uuid' }).success
      ).toBe(false);
    });

    it('rejects missing channel_id', () => {
      expect(
        createThreadSchema.safeParse({}).success
      ).toBe(false);
    });

    it('rejects subject too long', () => {
      expect(
        createThreadSchema.safeParse({
          channel_id: '550e8400-e29b-41d4-a716-446655440000',
          subject: 'x'.repeat(201),
        }).success
      ).toBe(false);
    });

    it('accepts null subject', () => {
      expect(
        createThreadSchema.safeParse({
          channel_id: '550e8400-e29b-41d4-a716-446655440000',
          subject: null,
        }).success
      ).toBe(true);
    });

    it('rejects invalid related_entity value', () => {
      expect(
        createThreadSchema.safeParse({
          channel_id: '550e8400-e29b-41d4-a716-446655440000',
          related_entity: 'user',
        }).success
      ).toBe(false);
    });

    it('accepts all valid related_entity values', () => {
      for (const entity of ['lead', 'deal', 'company']) {
        expect(
          createThreadSchema.safeParse({
            channel_id: '550e8400-e29b-41d4-a716-446655440000',
            related_entity: entity,
            related_entity_id: '550e8400-e29b-41d4-a716-446655440001',
          }).success
        ).toBe(true);
      }
    });
  });

  describe('sendMessageSchema', () => {
    it('accepts valid message', () => {
      expect(
        sendMessageSchema.safeParse({ content: 'Hello world' }).success
      ).toBe(true);
    });

    it('rejects empty content', () => {
      expect(
        sendMessageSchema.safeParse({ content: '' }).success
      ).toBe(false);
    });

    it('rejects whitespace-only content', () => {
      expect(
        sendMessageSchema.safeParse({ content: '   ' }).success
      ).toBe(false);
    });

    it('rejects content over 5000 characters', () => {
      expect(
        sendMessageSchema.safeParse({ content: 'x'.repeat(5001) }).success
      ).toBe(false);
    });

    it('accepts content at max 5000 characters', () => {
      expect(
        sendMessageSchema.safeParse({ content: 'x'.repeat(5000) }).success
      ).toBe(true);
    });

    it('trims content and validates', () => {
      const result = sendMessageSchema.safeParse({ content: '  hello  ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('hello');
      }
    });
  });
});
