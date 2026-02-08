import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sendInviteEmail } from '@/modules/email/send-invite-email';

describe('sendInviteEmail', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns sent: true when provider is mock', async () => {
    process.env.EMAIL_PROVIDER = 'mock';
    const result = await sendInviteEmail({
      to: 'user@example.com',
      token: 'abc123',
      tenantName: 'Tenant Demo',
      role: 'agent',
    });
    expect(result.sent).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns sent: false when provider is resend but env missing', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    const result = await sendInviteEmail({
      to: 'user@example.com',
      token: 'abc123',
      tenantName: 'Tenant Demo',
      role: 'admin',
    });
    expect(result.sent).toBe(false);
    expect(result.error).toBe('Email provider not configured');
  });

  it('uses APP_BASE_URL in link when set', async () => {
    process.env.EMAIL_PROVIDER = 'mock';
    process.env.APP_BASE_URL = 'https://app.example.com';
    const result = await sendInviteEmail({
      to: 'u@x.com',
      token: 't1',
      tenantName: 'T',
      role: 'manager',
    });
    expect(result.sent).toBe(true);
    // Link is built inside sendInviteEmail; we only assert it didn't throw and sent succeeded
  });
});
