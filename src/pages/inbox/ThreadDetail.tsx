import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { useAuth } from '@/lib/auth-context';
import { can } from '@/lib/rbac';
import { getThread, assignThread, closeThread, reopenThread } from '@/modules/inbox/threads-api';
import { getThreadMessages, sendMessage } from '@/modules/inbox/messages-api';
import { markThreadRead } from '@/modules/inbox/unread-api';
import { createAuditLog } from '@/modules/audit/api';
import { logActivityEvent } from '@/modules/crm/timeline-api';
import { sendMessageSchema } from '@/lib/validators';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Send,
  UserCheck,
  XCircle,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
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

  const [messageContent, setMessageContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const parsed = sendMessageSchema.parse({ content: messageContent });
      return sendMessage(currentTenant!.id, id!, parsed.content, user!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread-messages', id] });
      queryClient.invalidateQueries({ queryKey: ['thread', id] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      setMessageContent('');
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
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {thread.channels && (
                <span>{thread.channels.name} ({thread.channels.type})</span>
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Nenhuma mensagem ainda. Envie a primeira!
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_user_id === user?.id} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      {isOpen && canWrite && (
        <div className="border-t border-border pt-4 mt-4">
          <div className="flex gap-2">
            <Textarea
              value={messageContent}
              onChange={e => setMessageContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
              className="resize-none min-h-[60px] max-h-[120px]"
              maxLength={5000}
            />
            <Button
              size="icon"
              className="shrink-0 self-end h-10 w-10"
              onClick={() => sendMutation.mutate()}
              disabled={!messageContent.trim() || sendMutation.isPending}
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

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </span>
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
