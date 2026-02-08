import { supabase } from '@/lib/supabase';

/**
 * Base URL para chamadas à API (convite email, etc.).
 * - Se VITE_API_URL estiver definida, usa ela (ex.: dev com server em 3001 → http://localhost:3001).
 * - Senão usa window.location.origin (mesmo host; com nginx proxy /api → node).
 */
function getApiBaseUrl(): string {
  const raw = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '';
  const base = String(raw).trim().replace(/\/$/, '');
  return base || (typeof window !== 'undefined' ? window.location.origin : '');
}

export async function getTenantInvites(tenantId: string) {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createInvite(tenantId: string, email: string, role: string) {
  const { data, error } = await supabase.rpc('create_invite', {
    _tenant_id: tenantId,
    _email: email,
    _role: role,
  } as never);
  if (error) throw error;
  const result = data as unknown as { ok: boolean; data?: { id: string; token: string; expires_at: string }; error?: { message: string } };
  if (!result.ok) throw new Error(result.error?.message || 'Erro ao criar convite');
  return result.data!;
}

/** Call backend to send (or resend) invite email. Fails safely if server or email not configured. */
export async function sendInviteEmail(inviteId: string): Promise<{ sent: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { sent: false, error: 'Não autenticado' };
  }
  const base = getApiBaseUrl();
  const url = `${base}/api/invites/send-email`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ invite_id: inviteId }),
    });
    const json = (await res.json().catch(() => ({}))) as { sent?: boolean; error?: string };
    if (!res.ok) return { sent: false, error: json.error ?? `HTTP ${res.status}` };
    return { sent: json.sent === true, error: json.error };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro de rede';
    return { sent: false, error: message };
  }
}

export async function deleteInvite(id: string) {
  const { error } = await supabase.from('invites').delete().eq('id', id);
  if (error) throw error;
}

export async function acceptInvite(token: string) {
  const { data, error } = await supabase.rpc('accept_invite' as never, {
    _token: token,
  } as never);
  if (error) throw error;
  const result = data as unknown as { ok: boolean; data?: { membership_id: string; tenant_id: string }; error?: { message: string } };
  if (!result.ok) throw new Error(result.error?.message || 'Erro ao aceitar convite');
  return result.data!;
}
