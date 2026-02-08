import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/lib/tenant-context';
import { useAuth } from '@/lib/auth-context';
import { can } from '@/lib/rbac';
import { getTenantThreads, type ThreadFilters } from '@/modules/inbox/threads-api';
import { getTenantChannels } from '@/modules/inbox/channels-api';
import { getHandoffsForThreads } from '@/modules/inbox/handoffs-api';
import { getAgent, getAgentChannels } from '@/modules/ai-agent/ai-agent-api';
import { useUnreadCounts } from '@/hooks/use-unread-counts';
import { useUsage } from '@/hooks/use-usage';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, MessageSquare, User, Clock, Archive, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CreateThreadDialog from '@/components/inbox/CreateThreadDialog';
import ThreadLastMessage from '@/components/inbox/ThreadLastMessage';
import type { ThreadWithRelations } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  closed: 'Fechado',
  archived: 'Arquivado',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-500/15 text-green-400 border-green-500/30',
  closed: 'bg-muted text-muted-foreground border-border',
  archived: 'bg-muted text-muted-foreground border-border',
};

const CHANNEL_ICONS: Record<string, string> = {
  internal: '💬',
  whatsapp: '📱',
  email: '📧',
  instagram: '📸',
};

export default function InboxList() {
  const { currentTenant, membership } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canWrite = can(membership?.role, 'crm:write');
  const { unreadMap } = useUnreadCounts();
  const { canCreateThread, threadsLimitReached } = useUsage();

  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const filters: ThreadFilters = useMemo(() => {
    const f: ThreadFilters = {};
    if (statusFilter && statusFilter !== 'all') f.status = statusFilter;
    if (channelFilter && channelFilter !== 'all') f.channel_id = channelFilter;
    return f;
  }, [statusFilter, channelFilter]);

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['threads', currentTenant?.id, filters],
    queryFn: () => getTenantThreads(currentTenant!.id, filters),
    enabled: !!currentTenant,
  });

  const { data: channels = [] } = useQuery({
    queryKey: ['channels', currentTenant?.id],
    queryFn: () => getTenantChannels(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const { data: agent } = useQuery({
    queryKey: ['ai-agent', currentTenant?.id],
    queryFn: () => getAgent(currentTenant!.id),
    enabled: !!currentTenant && threads.length > 0,
  });

  const { data: agentChannels = [] } = useQuery({
    queryKey: ['ai-agent-channels', currentTenant?.id, agent?.id],
    queryFn: () => getAgentChannels(currentTenant!.id, agent!.id),
    enabled: !!currentTenant && !!agent?.id,
  });

  const { data: handoffsMap = {} } = useQuery({
    queryKey: ['thread-handoffs-batch', currentTenant?.id, threads.map((t) => t.id).join(',')],
    queryFn: () => getHandoffsForThreads(currentTenant!.id, threads.map((t) => t.id)),
    enabled: !!currentTenant && threads.length > 0,
  });

  const internalEnabled = agentChannels.some((c) => c.channel_type === 'internal' && c.is_enabled);
  const whatsappEnabled = agentChannels.some((c) => c.channel_type === 'whatsapp' && c.is_enabled);

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground text-sm">
            Central de conversas do seu workspace.
          </p>
        </div>
        {canWrite && (
          threadsLimitReached ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button disabled size="sm">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Nova Conversa
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Você atingiu o limite de conversas do seu plano. Entre em contato com o suporte para continuar.
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Nova Conversa
            </Button>
          )
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="closed">Fechados</SelectItem>
              <SelectItem value="archived">Arquivados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            {channels.map(ch => (
              <SelectItem key={ch.id} value={ch.id}>
                {CHANNEL_ICONS[ch.type] || '📨'} {ch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Thread List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Carregando...
        </div>
      ) : threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium">Nenhuma conversa encontrada</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm">
            {statusFilter === 'open'
              ? 'Não há conversas abertas. Crie uma nova conversa para começar.'
              : 'Nenhuma conversa com os filtros selecionados.'}
          </p>
          {canWrite && statusFilter === 'open' && (
            threadsLimitReached ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block mt-4">
                    <Button disabled size="sm">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Nova Conversa
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Você atingiu o limite de conversas do seu plano. Entre em contato com o suporte para continuar.
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button onClick={() => setCreateOpen(true)} size="sm" className="mt-4">
                <Plus className="h-4 w-4 mr-1.5" />
                Nova Conversa
              </Button>
            )
          )}
        </div>
      ) : (
        <TooltipProvider>
          <div className="border rounded-lg divide-y divide-border">
            {threads.map(thread => {
              const channelType = thread.channels?.type;
              const agentActiveHere =
                !!agent?.is_active &&
                ((channelType === 'internal' && internalEnabled) ||
                  (channelType === 'whatsapp' && whatsappEnabled));
              const isHandedOff = agentActiveHere && (handoffsMap[thread.id]?.is_handed_off ?? false);
              return (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  unreadCount={unreadMap.get(thread.id) || 0}
                  onClick={() => navigate(`/inbox/${thread.id}`)}
                  agentBadge={agentActiveHere ? (isHandedOff ? 'human' : 'agent') : null}
                />
              );
            })}
          </div>
        </TooltipProvider>
      )}

      <CreateThreadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        channels={channels}
      />
    </div>
    </TooltipProvider>
  );
}

function ThreadRow({
  thread,
  unreadCount,
  onClick,
  agentBadge,
}: {
  thread: ThreadWithRelations;
  unreadCount: number;
  onClick: () => void;
  agentBadge: 'agent' | 'human' | null;
}) {
  const channelIcon = CHANNEL_ICONS[thread.channels?.type || 'internal'] || '📨';

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-4 p-4 text-left hover:bg-muted/50 transition-colors ${
        unreadCount > 0 ? 'bg-primary/5' : ''
      }`}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm">{channelIcon}</span>
          <span className={`text-sm truncate ${unreadCount > 0 ? 'font-bold' : 'font-medium'}`}>
            {thread.subject || 'Sem assunto'}
          </span>
          {thread.related_entity && (
            <Badge variant="outline" className="text-xs shrink-0">
              {thread.related_entity}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={`text-xs shrink-0 ${STATUS_COLORS[thread.status] || ''}`}
          >
            {STATUS_LABELS[thread.status] || thread.status}
          </Badge>
          {agentBadge === 'agent' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs shrink-0 bg-blue-500/15 text-blue-600 border-blue-500/30">
                  Agente ativo
                </Badge>
              </TooltipTrigger>
              <TooltipContent>O agente de atendimento está respondendo automaticamente nesta conversa.</TooltipContent>
            </Tooltip>
          )}
          {agentBadge === 'human' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs shrink-0 bg-amber-500/15 text-amber-600 border-amber-500/30">
                  Em atendimento humano
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Um atendente assumiu esta conversa.</TooltipContent>
            </Tooltip>
          )}
        </div>
        <ThreadLastMessage threadId={thread.id} />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {thread.profiles && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {thread.profiles.name || thread.profiles.email}
            </span>
          )}
          {thread.last_message_at && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(thread.last_message_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          )}
          {!thread.last_message_at && thread.created_at && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(thread.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          )}
        </div>
      </div>
      {unreadCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shrink-0 mt-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
