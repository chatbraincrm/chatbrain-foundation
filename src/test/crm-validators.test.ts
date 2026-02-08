import { describe, it, expect } from 'vitest';
import {
  createPipelineSchema,
  createStageSchema,
  createCompanySchema,
  createLeadSchema,
  createDealSchema,
  createTaskSchema,
  createTagSchema,
} from '@/lib/validators';

describe('CRM Validators', () => {
  describe('createPipelineSchema', () => {
    it('accepts valid pipeline', () => {
      expect(createPipelineSchema.safeParse({ name: 'Vendas' }).success).toBe(true);
    });
    it('rejects empty name', () => {
      expect(createPipelineSchema.safeParse({ name: '' }).success).toBe(false);
    });
  });

  describe('createStageSchema', () => {
    it('accepts valid stage', () => {
      expect(createStageSchema.safeParse({ name: 'Novo', position: 0 }).success).toBe(true);
    });
    it('rejects negative position', () => {
      expect(createStageSchema.safeParse({ name: 'Novo', position: -1 }).success).toBe(false);
    });
  });

  describe('createCompanySchema', () => {
    it('accepts valid company', () => {
      expect(createCompanySchema.safeParse({ name: 'Acme' }).success).toBe(true);
    });
    it('accepts company with website', () => {
      expect(createCompanySchema.safeParse({ name: 'Acme', website: 'https://acme.com' }).success).toBe(true);
    });
    it('accepts empty website', () => {
      expect(createCompanySchema.safeParse({ name: 'Acme', website: '' }).success).toBe(true);
    });
  });

  describe('createLeadSchema', () => {
    it('accepts valid lead', () => {
      expect(createLeadSchema.safeParse({ name: 'João' }).success).toBe(true);
    });
    it('rejects empty name', () => {
      expect(createLeadSchema.safeParse({ name: '' }).success).toBe(false);
    });
  });

  describe('createDealSchema', () => {
    const validDeal = {
      title: 'Deal 1',
      pipeline_id: '550e8400-e29b-41d4-a716-446655440000',
      stage_id: '550e8400-e29b-41d4-a716-446655440001',
    };
    it('accepts valid deal', () => {
      expect(createDealSchema.safeParse(validDeal).success).toBe(true);
    });
    it('rejects negative value', () => {
      expect(createDealSchema.safeParse({ ...validDeal, value_cents: -100 }).success).toBe(false);
    });
    it('defaults value_cents to 0', () => {
      const result = createDealSchema.safeParse(validDeal);
      expect(result.success && result.data.value_cents).toBe(0);
    });
  });

  describe('createTaskSchema', () => {
    it('accepts valid task', () => {
      expect(createTaskSchema.safeParse({ title: 'Follow up' }).success).toBe(true);
    });
    it('rejects empty title', () => {
      expect(createTaskSchema.safeParse({ title: '' }).success).toBe(false);
    });
  });

  describe('createTagSchema', () => {
    it('accepts valid tag', () => {
      expect(createTagSchema.safeParse({ name: 'VIP' }).success).toBe(true);
    });
    it('rejects too long name', () => {
      expect(createTagSchema.safeParse({ name: 'x'.repeat(51) }).success).toBe(false);
    });
  });
});
