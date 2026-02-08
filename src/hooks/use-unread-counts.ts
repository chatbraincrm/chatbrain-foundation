import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { getUnreadCounts, type UnreadCount } from '@/modules/inbox/unread-api';
import { useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useUnreadCounts() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: unreadList = [] } = useQuery({
    queryKey: ['unread-counts', currentTenant?.id],
    queryFn: () => getUnreadCounts(currentTenant!.id),
    enabled: !!currentTenant,
    refetchInterval: 30000, // refresh every 30s as fallback
  });

  // Realtime: invalidate unread counts when new messages arrive
  useEffect(() => {
    if (!currentTenant) return;
    const channel = supabase
      .channel('unread-counts-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unread-counts', currentTenant.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTenant, queryClient]);

  const unreadMap = useMemo(() => {
    const map = new Map<string, number>();
    unreadList.forEach((item: UnreadCount) => {
      map.set(item.thread_id, item.unread_count);
    });
    return map;
  }, [unreadList]);

  const totalUnread = useMemo(() => {
    return unreadList.reduce((sum: number, item: UnreadCount) => sum + item.unread_count, 0);
  }, [unreadList]);

  return { unreadMap, totalUnread };
}
