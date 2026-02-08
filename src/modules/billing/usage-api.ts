import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { PLAN_LIMITS } from '@/config/plan-limits';

export interface UsageCounters {
  messages_count: number;
  ai_messages_count: number;
  threads_count: number;
}

const CURRENT_PERIOD = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

/** Retorna o uso do tenant no período (YYYY-MM). Default: mês atual. */
export async function getUsageForPeriod(
  tenantId: string,
  period?: string,
  client?: SupabaseClient
): Promise<UsageCounters> {
  const db = client ?? supabase;
  const p = period ?? CURRENT_PERIOD();
  const { data, error } = await db
    .from('usage_counters')
    .select('messages_count, ai_messages_count, threads_count')
    .eq('tenant_id', tenantId)
    .eq('period', p)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return { messages_count: 0, ai_messages_count: 0, threads_count: 0 };
  }
  return data as UsageCounters;
}

/** Uso do mês atual. */
export async function getUsageForCurrentPeriod(
  tenantId: string,
  client?: SupabaseClient
): Promise<UsageCounters> {
  return getUsageForPeriod(tenantId, CURRENT_PERIOD(), client);
}

/** Incrementa contagem de mensagens (envio/recebimento). */
export async function incrementMessageUsage(
  tenantId: string,
  client?: SupabaseClient
): Promise<void> {
  const db = client ?? supabase;
  const { error } = await db.rpc('increment_usage_counters' as never, {
    _tenant_id: tenantId,
    _period: CURRENT_PERIOD(),
    _messages_delta: 1,
    _ai_messages_delta: 0,
    _threads_delta: 0,
  } as never);
  if (error) throw error;
}

/** Incrementa contagem de respostas do agente. */
export async function incrementAiUsage(
  tenantId: string,
  client?: SupabaseClient
): Promise<void> {
  const db = client ?? supabase;
  const { error } = await db.rpc('increment_usage_counters' as never, {
    _tenant_id: tenantId,
    _period: CURRENT_PERIOD(),
    _messages_delta: 0,
    _ai_messages_delta: 1,
    _threads_delta: 0,
  } as never);
  if (error) throw error;
}

/** Incrementa contagem de conversas criadas. */
export async function incrementThreadUsage(
  tenantId: string,
  client?: SupabaseClient
): Promise<void> {
  const db = client ?? supabase;
  const { error } = await db.rpc('increment_usage_counters' as never, {
    _tenant_id: tenantId,
    _period: CURRENT_PERIOD(),
    _messages_delta: 0,
    _ai_messages_delta: 0,
    _threads_delta: 1,
  } as never);
  if (error) throw error;
}

/** Verifica se pode enviar mensagem (dentro do limite). */
export async function canSendMessage(
  tenantId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const usage = await getUsageForCurrentPeriod(tenantId, client);
  return usage.messages_count < PLAN_LIMITS.messages_per_month;
}

/** Verifica se pode criar nova conversa. */
export async function canCreateThread(
  tenantId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const usage = await getUsageForCurrentPeriod(tenantId, client);
  return usage.threads_count < PLAN_LIMITS.threads;
}

/** Verifica se o agente pode responder (limite de respostas do agente). */
export async function canAgentRespond(
  tenantId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const usage = await getUsageForCurrentPeriod(tenantId, client);
  return usage.ai_messages_count < PLAN_LIMITS.ai_responses_per_month;
}
