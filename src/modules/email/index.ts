import type { EmailProvider } from './email-provider';
import { createResendProvider } from './resend-provider';
import { createMockEmailProvider } from './mock-provider';

export type { EmailProvider, SendEmailParams } from './email-provider';

export function getEmailProvider(): EmailProvider | null {
  const providerEnv = (typeof process !== 'undefined' && process.env.EMAIL_PROVIDER) || '';
  if (providerEnv === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !fromEmail) return null;
    return createResendProvider(apiKey, fromEmail);
  }
  if (providerEnv === 'mock' || providerEnv === '') {
    return createMockEmailProvider(true);
  }
  return null;
}
