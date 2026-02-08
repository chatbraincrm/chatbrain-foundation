import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { useAuth } from '@/lib/auth-context';
import { can } from '@/lib/rbac';
import { getThread, assignThread, closeThread, reopenThread } from '@/modules/inbox/threads-api';
import { getThreadMessages, sendMessage } from '@/modules/inbox/messages-api';
import { markThreadRead } from '@/modules/inbox/unread-api';
import { getThreadHandoff, setHandoff } from '@/modules/inbox/handoffs-api';
import {
  getThreadAppointments,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  type Appointment,
  type AppointmentStatus,
} from '@/modules/inbox/appointments-api';
import { maybeRunAiAgent } from '@/modules/inbox/run-agent';
import { useUsage } from '@/hooks/use-usage';
import { getAgent, getAgentSettings, getAgentChannels } from '@/modules/ai-agent/ai-agent-api';
import { getThreadLinkByThreadId, getConnection } from '@/modules/whatsapp/whatsapp-api';
import { createAuditLog } from '@/modules/audit/api';
import { logActivityEvent } from '@/modules/crm/timeline-api';
import { sendMessageSchema } from '@/lib/validators';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Send,
  UserCheck,
  XCircle,
  RotateCcw,
  ExternalLink,
  Handshake,
  Bot,
  Calendar,
  Plus,
  Mic,
  Image as ImageIcon,
  MessageCircle,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { MessageWithProfile } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  closed: 'Fechado',
  archived: 'Arquivado',
};

const ENTITY_LABELS: Record<string, string> = {
  lead: 'Lead',
  deal: 'Negócio',
  company: 'Empresa',
};

const ENTITY_ROUTES: Record<string, string> = {
  lead: '/crm/leads',
  deal: '/crm/deals',
  company: '/crm/companies',
};

export default function ThreadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant, membership } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canWrite = can(membership?.role, 'crm:write');
  const canDelete = can(membership?.role, 'crm:delete');
  const canManageHandoff = can(membership?.role, 'manage_ai_agent');
  const canManageAppointments = can(membership?.role, 'manage_ai_agent') || canWrite;
  const { canSendMessage: canSendByPlan, agentLimitReached } = useUsage();

  const [messageContent, setMessageContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [appointmentForm, setAppointmentForm] = useState({
    title: '',
    starts_at: '',
    ends_at: '',
    status: 'scheduled' as AppointmentStatus,
  });
  const [agentTyping, setAgentTyping] = useState(false);
  const agentTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: thread, isLoading: threadLoading } = useQuery({
    queryKey: ['thread', id],
    queryFn: () => getThread(id!),
    enabled: !!id,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['thread-messages', id],
    queryFn: () => getThreadMessages(id!),
    enabled: !!id,
  });

  const { data: handoff } = useQuery({
    queryKey: ['thread-handoff', id],
    queryFn: () => getThreadHandoff(currentTenant!.id, id!),
    enabled: !!id && !!currentTenant,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['thread-appointments', id],
    queryFn: () => getThreadAppointments(currentTenant!.id, id!),
    enabled: !!id && !!currentTenant,
  });

  const { data: agent } = useQuery({
    queryKey: ['ai-agent', currentTenant?.id],
    queryFn: () => getAgent(currentTenant!.id),
    enabled: !!currentTenant && !!thread && (thread.channels?.type === 'internal' || thread.channels?.type === 'whatsapp'),
  });

  const { data: agentChannels = [] } = useQuery({
    queryKey: ['ai-agent-channels', currentTenant?.id, agent?.id],
    queryFn: () => getAgentChannels(currentTenant!.id, agent!.id),
    enabled: !!currentTenant && !!agent?.id,
  });

  const { data: agentSettings } = useQuery({
    queryKey: ['ai-agent-settings', currentTenant?.id, agent?.id],
    queryFn: () => getAgentSettings(currentTenant!.id, agent!.id),
    enabled: !!currentTenant && !!agent?.id,
  });

  const { data: whatsappLink } = useQuery({
    queryKey: ['whatsapp-thread-link', currentTenant?.id, id],
    queryFn: async () => {
      const link = await getThreadLinkByThreadId(currentTenant!.id, id!);
      return link ?? null;
    },
    enabled: !!currentTenant && !!id && !!thread && thread.channels?.type === 'whatsapp',
  });

  const { data: whatsappConnection } = useQuery({
    queryKey: ['whatsapp-connection', currentTenant?.id, whatsappLink?.connection_id],
    queryFn: () => getConnection(currentTenant!.id, whatsappLink!.connection_id),
    enabled: !!currentTenant && !!whatsappLink?.connection_id,
  });

  const allowAudio = agentSettings?.allow_audio ?? false;
  const allowImages = agentSettings?.allow_images ?? false;
  const isHandedOff = handoff?.is_handed_off ?? false;
  const internalEnabled = agentChannels.some((c) => c.channel_type === 'internal' && c.is_enabled);
  const whatsappEnabled = agentChannels.some((c) => c.channel_type === 'whatsapp' && c.is_enabled);
  const agentActiveForThisChannel =
    !!agent?.is_active &&
    ((thread?.channels?.type === 'internal' && internalEnabled) ||
      (thread?.channels?.type === 'whatsapp' && whatsappEnabled));

  const maxConsecutive = agentSettings?.max_consecutive_replies ?? 5;
  let consecutiveAiAtEnd = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as { sender_type?: string; sender_subtype?: string | null };
    if (m.sender_type === 'system' && m.sender_subtype === 'ai') consecutiveAiAtEnd++;
    else break;
  }
  const lastMsgFromAgent = messages.length > 0 && (() => {
    const last = messages[messages.length - 1] as { sender_type?: string; sender_subtype?: string | null };
    return last.sender_type === 'system' && last.sender_subtype === 'ai';
  })();
  const limitReachedBanner =
    agentActiveForThisChannel &&
    !lastMsgFromAgent &&
    consecutiveAiAtEnd >= maxConsecutive &&
    consecutiveAiAtEnd > 0;

  // Mark thread as read when opened or when new messages arrive
  useEffect(() => {
    if (!id || !currentTenant) return;
    markThreadRead(currentTenant.id, id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['unread-counts', currentTenant.id] });
    }).catch(() => {/* ignore */});
  }, [id, currentTenant, messages.length, queryClient]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!id || !currentTenant) return;
    const channel = supabase
      .channel(`messages-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['thread-messages', id] });
          queryClient.invalidateQueries({ queryKey: ['thread', id] });
          queryClient.invalidateQueries({ queryKey: ['thread-last-message', id] });
          // Mark as read since user is viewing
          markThreadRead(currentTenant.id, id!).then(() => {
            queryClient.invalidateQueries({ queryKey: ['unread-counts', currentTenant.id] });
          }).catch(() => {/* ignore */});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, currentTenant, queryClient]);

  // Clear typing indicator when last message is from agent
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1] as { sender_type?: string; sender_subtype?: string | null };
    if (last?.sender_type === 'system' && last?.sender_subtype === 'ai') {
      setAgentTyping(false);
      if (agentTypingTimeoutRef.current) {
        clearTimeout(agentTypingTimeoutRef.current);
        agentTypingTimeoutRef.current = null;
      }
    }
  }, [messages]);

  useEffect(() => () => {
    if (agentTypingTimeoutRef.current) clearTimeout(agentTypingTimeoutRef.current);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content?: string) => {
      const toSend = content ?? messageContent;
      const parsed = sendMessageSchema.parse({ content: toSend });
      return sendMessage(currentTenant!.id, id!, parsed.content, user!.id);
    },
    onSuccess: (_, content) => {
      queryClient.invalidateQueries({ queryKey: ['thread-messages', id] });
      queryClient.invalidateQueries({ queryKey: ['thread', id] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      if (content === undefined) setMessageContent('');
      if (agent?.id && thread?.channels?.type === 'internal') {
        setAgentTyping(true);
        if (agentTypingTimeoutRef.current) clearTimeout(agentTypingTimeoutRef.current);
        agentTypingTimeoutRef.current = setTimeout(() => setAgentTyping(false), 30000);
      }
      maybeRunAiAgent(currentTenant!.id, id!).catch(() => {});
    },
    onError: (e: Error) =>
      toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const handoffMutation = useMutation({
    mutationFn: (handedOff: boolean) =>
      setHandoff(currentTenant!.id, id!, handedOff, handedOff ? user!.id : null),
    onSuccess: (_, handedOff) => {
      queryClient.invalidateQueries({ queryKey: ['thread-handoff', id] });
      if (handedOff) setAgentTyping(false);
      toast({ title: handedOff ? 'Conversa assumida por você' : 'Agente reativado' });
    },
    onError: (e: Error) =>
      toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const createAppointmentMutation = useMutation({
    mutationFn: () =>
      createAppointment(
        currentTenant!.id,
        id!,
        {
          title: appointmentForm.title,
          starts_at: new Date(appointmentForm.starts_at).toISOString(),
          ends_at: new Date(appointmentForm.ends_at).toISOString(),
          status: appointmentForm.status,
        },
        user!.id
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread-appointments', id] });
      toast({ title: 'Agendamento criado' });
      setAppointmentDialogOpen(false);
      setAppointmentForm({ title: '', starts_at: '', ends_at: '', status: 'scheduled' });
    },
    onError: (e: Error) =>
      toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      updateAppointment(
        currentTenant!.id,
        appointmentId,
        {
          title: appointmentForm.title,
          starts_at: new Date(appointmentForm.starts_at).toISOString(),
          ends_at: new Date(appointmentForm.ends_at).toISOString(),
          status: appointmentForm.status,
        },
        user!.id
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread-appointments', id] });
      toast({ title: 'Agendamento atualizado' });
      setAppointmentDialogOpen(false);
      setEditingAppointment(null);
    },
    onError: (e: Error) =>
      toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const cancelAppointmentMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      cancelAppointment(currentTenant!.id, appointmentId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread-appointments', id] });
      toast({ title: 'Agendamento cancelado' });
    },
    onError: (e: Error) =>
      toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      await assignThread(id!, user!.id);
      await createAuditLog(currentTenant!.id, 'thread.assigned', 'thread', id!, {
        assigned_user_id: user!.id,
      });
      await logActivityEvent(currentTenant!.id, 'thread', id!, 'thread.assigned', {
        assigned_user_id: user!.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', id] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      toast({ title: 'Conversa atribuída a você' });
    },
    onError: (e: Error) =>
      toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      await closeThread(id!);
      await createAuditLog(currentTenant!.id, 'thread.closed', 'thread', id!);
      await logActivityEvent(currentTenant!.id, 'thread', id!, 'thread.closed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', id] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      toast({ title: 'Conversa fechada' });
    },
    onError: (e: Error) =>
      toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      await reopenThread(id!);
      await createAuditLog(currentTenant!.id, 'thread.reopened', 'thread', id!);
      await logActivityEvent(currentTenant!.id, 'thread', id!, 'thread.reopened');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', id] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      toast({ title: 'Conversa reaberta' });
    },
    onError: (e: Error) =>
      toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (messageContent.trim() && !sendMutation.isPending) {
          sendMutation.mutate();
        }
      }
    },
    [messageContent, sendMutation]
  );

  if (threadLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h3 className="text-lg font-medium">Conversa não encontrada</h3>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/inbox')}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Voltar ao Inbox
        </Button>
      </div>
    );
  }

  const isOpen = thread.status === 'open';

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inbox')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">
                {thread.subject || 'Sem assunto'}
              </h1>
              <Badge
                variant="outline"
                className={`text-xs ${
                  isOpen
                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {STATUS_LABELS[thread.status]}
              </Badge>
              <TooltipProvider>
                {agentActiveForThisChannel && (
                  isHandedOff ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs bg-amber-500/15 text-amber-600 border-amber-500/30">
                          Em atendimento humano
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        Um atendente assumiu esta conversa. O agente não enviará mais respostas automáticas até ser reativado.
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs bg-blue-500/15 text-blue-600 border-blue-500/30">
                          Agente ativo
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        O agente de atendimento está respondendo automaticamente. Você pode assumir a conversa a qualquer momento.
                      </TooltipContent>
                    </Tooltip>
                  )
                )}
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {thread.channels && (
                <span className="flex items-center gap-1.5">
                  {thread.channels.name} ({thread.channels.type})
                  {thread.channels.type === 'whatsapp' && (
                    <Badge variant="secondary" className="text-xs font-normal gap-1">
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp
                    </Badge>
                  )}
                </span>
              )}
              {thread.profiles && (
                <span>Responsável: {thread.profiles.name || thread.profiles.email}</span>
              )}
              {thread.related_entity && thread.related_entity_id && (
                <Link
                  to={`${ENTITY_ROUTES[thread.related_entity]}/${thread.related_entity_id}`}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {ENTITY_LABELS[thread.related_entity]}
                </Link>
              )}
            </div>
          </div>
        </div>

        {canWrite && (
          <div className="flex items-center gap-2">
            {canManageHandoff && agentActiveForThisChannel && (
              isHandedOff ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handoffMutation.mutate(false)}
                  disabled={handoffMutation.isPending}
                >
                  <Bot className="h-3.5 w-3.5 mr-1.5" />
                  Devolver ao agente
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handoffMutation.mutate(true)}
                  disabled={handoffMutation.isPending}
                >
                  <Handshake className="h-3.5 w-3.5 mr-1.5" />
                  Assumir conversa
                </Button>
              )
            )}
            {(!thread.assigned_user_id || thread.assigned_user_id !== user?.id) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => assignMutation.mutate()}
                disabled={assignMutation.isPending}
              >
                <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                Atribuir a mim
              </Button>
            )}
            {isOpen ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Fechar
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reopenMutation.mutate()}
                disabled={reopenMutation.isPending}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reabrir
              </Button>
            )}
          </div>
        )}
      </div>

      {limitReachedBanner && canManageHandoff && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400 mb-4">
          Limite de respostas automáticas atingido nesta conversa. Assuma a conversa para continuar atendendo.
          <Button
            variant="outline"
            size="sm"
            className="ml-2 mt-1"
            onClick={() => handoffMutation.mutate(true)}
            disabled={handoffMutation.isPending}
          >
            <Handshake className="h-3.5 w-3.5 mr-1" />
            Assumir conversa
          </Button>
        </div>
      )}

      {agentLimitReached && agentActiveForThisChannel && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400 mb-4">
          O agente de atendimento atingiu o limite mensal. Você pode continuar atendendo manualmente.
        </div>
      )}

      {!canSendByPlan && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive mb-4">
          Você atingiu o limite do seu plano ChatBrain Pro. Entre em contato com o suporte para continuar atendendo.
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Nenhuma mensagem ainda. Envie a primeira!
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_user_id === user?.id} />
            ))}
            {agentTyping && (agentSettings?.typing_simulation ?? true) && (
              <div className="flex justify-center">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full animate-pulse">
                  Agente de atendimento está digitando…
                </span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Appointments */}
      {canManageAppointments && (
        <div className="border-t border-border pt-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Agendamentos
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingAppointment(null);
                setAppointmentForm({
                  title: '',
                  starts_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                  ends_at: format(new Date(Date.now() + 3600000), "yyyy-MM-dd'T'HH:mm"),
                  status: 'scheduled',
                });
                setAppointmentDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo Agendamento
            </Button>
          </div>
          {appointments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum agendamento.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {appointments.map((apt) => (
                <li
                  key={apt.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
                >
                  <div>
                    <span className="font-medium">{apt.title}</span>
                    <span className="text-muted-foreground ml-2">
                      {format(new Date(apt.starts_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} –{' '}
                      {format(new Date(apt.ends_at), "HH:mm", { locale: ptBR })}
                    </span>
                    {apt.status !== 'scheduled' && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {apt.status === 'cancelled' ? 'Cancelado' : 'Reagendado'}
                      </Badge>
                    )}
                  </div>
                  {apt.status === 'scheduled' && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingAppointment(apt);
                          setAppointmentForm({
                            title: apt.title,
                            starts_at: format(new Date(apt.starts_at), "yyyy-MM-dd'T'HH:mm"),
                            ends_at: format(new Date(apt.ends_at), "yyyy-MM-dd'T'HH:mm"),
                            status: 'rescheduled',
                          });
                          setAppointmentDialogOpen(true);
                        }}
                      >
                        Reagendar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => cancelAppointmentMutation.mutate(apt.id)}
                        disabled={cancelAppointmentMutation.isPending}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Composer */}
      {isOpen && canWrite && (
        <div className="border-t border-border pt-4 mt-4">
          {!canSendByPlan && (
            <p className="text-sm text-destructive mb-2">
              Você atingiu o limite do seu plano. Entre em contato com o suporte para continuar atendendo.
            </p>
          )}
          {canSendByPlan && thread.channels?.type === 'whatsapp' && whatsappConnection && !whatsappConnection.is_active && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
              Conexão WhatsApp não está ativa. Envio de mensagens bloqueado até ativar em Configurações.
            </p>
          )}
          <div className="flex gap-2">
            {(allowAudio || allowImages) && (
              <div className="flex shrink-0 self-end gap-1">
                {allowAudio && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10"
                    onClick={() => sendMutation.mutate('[audio] arquivo enviado')}
                    disabled={!canSendByPlan || sendMutation.isPending}
                    title="Enviar áudio (placeholder)"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
                {allowImages && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10"
                    onClick={() => sendMutation.mutate('[image] arquivo enviado')}
                    disabled={!canSendByPlan || sendMutation.isPending}
                    title="Enviar imagem (placeholder)"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            <Textarea
              value={messageContent}
              onChange={e => setMessageContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
              className="resize-none min-h-[60px] max-h-[120px]"
              maxLength={5000}
              disabled={
                !canSendByPlan ||
                !!(
                  thread.channels?.type === 'whatsapp' &&
                  whatsappConnection &&
                  !whatsappConnection.is_active
                )
              }
            />
            <Button
              size="icon"
              className="shrink-0 self-end h-10 w-10"
              onClick={() => sendMutation.mutate()}
              disabled={
                !messageContent.trim() ||
                !canSendByPlan ||
                sendMutation.isPending ||
                (thread.channels?.type === 'whatsapp' &&
                  !!whatsappConnection &&
                  !whatsappConnection.is_active)
              }
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {!isOpen && (
        <div className="border-t border-border pt-4 mt-4 text-center text-sm text-muted-foreground">
          Esta conversa está fechada. Reabra para enviar mensagens.
        </div>
      )}

      {/* Appointment dialog */}
      <Dialog open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAppointment ? 'Reagendar' : 'Novo Agendamento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={appointmentForm.title}
                onChange={(e) =>
                  setAppointmentForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Ex: Reunião de follow-up"
              />
            </div>
            <div className="space-y-2">
              <Label>Início</Label>
              <Input
                type="datetime-local"
                value={appointmentForm.starts_at}
                onChange={(e) =>
                  setAppointmentForm((f) => ({ ...f, starts_at: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input
                type="datetime-local"
                value={appointmentForm.ends_at}
                onChange={(e) =>
                  setAppointmentForm((f) => ({ ...f, ends_at: e.target.value }))
                }
              />
            </div>
            {editingAppointment && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={appointmentForm.status}
                  onValueChange={(v) =>
                    setAppointmentForm((f) => ({ ...f, status: v as AppointmentStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Agendado</SelectItem>
                    <SelectItem value="rescheduled">Reagendado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAppointmentDialogOpen(false);
                setEditingAppointment(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const start = new Date(appointmentForm.starts_at).getTime();
                const end = new Date(appointmentForm.ends_at).getTime();
                const now = Date.now();
                if (end <= start) {
                  toast({
                    title: 'Erro',
                    description: 'A data de término deve ser posterior à data de início.',
                    variant: 'destructive',
                  });
                  return;
                }
                if (!editingAppointment && start < now) {
                  toast({
                    title: 'Erro',
                    description: 'A data de início não pode ser no passado.',
                    variant: 'destructive',
                  });
                  return;
                }
                if (editingAppointment) {
                  updateAppointmentMutation.mutate(editingAppointment.id);
                } else {
                  createAppointmentMutation.mutate();
                }
              }}
              disabled={
                !appointmentForm.title.trim() ||
                !appointmentForm.starts_at ||
                !appointmentForm.ends_at ||
                createAppointmentMutation.isPending ||
                updateAppointmentMutation.isPending
              }
            >
              {editingAppointment ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageBubble({
  message,
  isOwn,
}: {
  message: MessageWithProfile;
  isOwn: boolean;
}) {
  const isSystem = message.sender_type === 'system';
  const isAi = isSystem && (message as { sender_subtype?: string | null }).sender_subtype === 'ai';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="text-center">
          {isAi && (
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Agente de atendimento</p>
          )}
          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {message.content}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2.5 ${
          isOwn
            ? 'bg-primary text-primary-foreground'
            : 'bg-card border border-border'
        }`}
      >
        {!isOwn && message.profiles && (
          <p className={`text-xs font-medium mb-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            {message.profiles.name || message.profiles.email}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={`text-xs mt-1 ${
            isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'
          }`}
        >
          {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}
