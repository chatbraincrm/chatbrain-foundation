import { Resend } from 'resend';
import type { EmailProvider, SendEmailParams } from './email-provider';

export function createResendProvider(apiKey: string, fromEmail: string): EmailProvider {
  const resend = new Resend(apiKey);

  return {
    async send(params: SendEmailParams): Promise<{ ok: boolean; error?: string }> {
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text ?? undefined,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
  };
}
