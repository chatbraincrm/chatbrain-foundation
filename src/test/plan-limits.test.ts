import { describe, it, expect } from 'vitest';
import { PLAN_NAME, PLAN_PRICE_MONTHLY, PLAN_LIMITS } from '@/config/plan-limits';

describe('plan-limits', () => {
  it('exports ChatBrain Pro as plan name', () => {
    expect(PLAN_NAME).toBe('ChatBrain Pro');
  });

  it('exports monthly price as 197', () => {
    expect(PLAN_PRICE_MONTHLY).toBe(197);
  });

  it('exports all plan limits with expected values', () => {
    expect(PLAN_LIMITS.threads).toBe(300);
    expect(PLAN_LIMITS.messages_per_month).toBe(6000);
    expect(PLAN_LIMITS.ai_responses_per_month).toBe(2000);
    expect(PLAN_LIMITS.whatsapp_connections).toBe(1);
    expect(PLAN_LIMITS.users).toBe(3);
  });
});
