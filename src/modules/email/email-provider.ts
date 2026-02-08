/**
 * Interface do provedor de email.
 * Implementações: Resend (produção), Mock (dev/testes).
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<{ ok: boolean; error?: string }>;
}
