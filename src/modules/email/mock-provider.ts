import type { EmailProvider, SendEmailParams } from './email-provider';

const isNode = typeof process !== 'undefined' && process.env?.NODE_ENV;

export function createMockEmailProvider(logToConsole = true): EmailProvider {
  return {
    async send(params: SendEmailParams): Promise<{ ok: boolean; error?: string }> {
      if (logToConsole && isNode) {
        console.log('[email:mock]', {
          to: params.to,
          subject: params.subject,
          htmlLength: params.html?.length,
        });
      }
      return { ok: true };
    },
  };
}
