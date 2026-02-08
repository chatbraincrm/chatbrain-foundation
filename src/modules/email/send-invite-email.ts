import { getEmailProvider } from './index';

const APP_BASE_URL = typeof process !== 'undefined' ? (process.env.APP_BASE_URL || '') : '';

export interface InviteEmailParams {
  to: string;
  token: string;
  tenantName: string;
  role: string;
}

export async function sendInviteEmail(params: InviteEmailParams): Promise<{
  sent: boolean;
  error?: string;
}> {
  const provider = getEmailProvider();
  if (!provider) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
      console.warn('[email] Provider not configured (EMAIL_PROVIDER / RESEND_*). Invite link can be copied manually.');
    }
    return { sent: false, error: 'Email provider not configured' };
  }

  const baseUrl = APP_BASE_URL.replace(/\/$/, '');
  const link = baseUrl ? `${baseUrl}/invite/${params.token}` : `/invite/${params.token}`;
  const roleLabel = params.role === 'admin' ? 'Administrador' : params.role === 'manager' ? 'Gerente' : 'Agente';

  const subject = 'Convite para acessar o ChatBrain';
  const html = `
    <p>Você foi convidado a acessar o <strong>${escapeHtml(params.tenantName)}</strong> no ChatBrain.</p>
    <p>Papel: <strong>${escapeHtml(roleLabel)}</strong>.</p>
    <p><a href="${escapeHtml(link)}">Aceitar convite</a></p>
    <p>Ou copie o link: ${escapeHtml(link)}</p>
    <p>Este link expira em 7 dias.</p>
  `.trim();

  const text = `Convite para ${params.tenantName} (${roleLabel}). Acesse: ${link} (expira em 7 dias).`;

  const result = await provider.send({
    to: params.to,
    subject,
    html,
    text,
  });

  if (!result.ok) return { sent: false, error: result.error ?? 'Send failed' };
  return { sent: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
