import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { getUsageForCurrentPeriod, type UsageCounters } from '@/modules/billing/usage-api';
import { PLAN_LIMITS } from '@/config/plan-limits';

export interface UseUsageResult {
  usage: UsageCounters | null;
  limits: typeof PLAN_LIMITS;
  canSendMessage: boolean;
  canCreateThread: boolean;
  agentLimitReached: boolean;
  messagesLimitReached: boolean;
  threadsLimitReached: boolean;
  isLoading: boolean;
}

export function useUsage(): UseUsageResult {
  const { currentTenant } = useTenant();

  const { data: usage = null, isLoading } = useQuery({
    queryKey: ['usage', currentTenant?.id],
    queryFn: () => getUsageForCurrentPeriod(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const messagesLimitReached = usage !== null && usage.messages_count >= PLAN_LIMITS.messages_per_month;
  const threadsLimitReached = usage !== null && usage.threads_count >= PLAN_LIMITS.threads;
  const agentLimitReached = usage !== null && usage.ai_messages_count >= PLAN_LIMITS.ai_responses_per_month;

  return {
    usage,
    limits: PLAN_LIMITS,
    canSendMessage: !messagesLimitReached,
    canCreateThread: !threadsLimitReached,
    agentLimitReached,
    messagesLimitReached,
    threadsLimitReached,
    isLoading,
  };
}
