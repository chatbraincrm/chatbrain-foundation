import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getAgentActivityLogs } from '@/modules/ai-agent/ai-agent-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Handshake } from 'lucide-react';

const CHANNEL_LABELS: Record<string, string> = {
  internal: 'Interno',
  whatsapp: 'WhatsApp',
  email: 'Email',
  instagram: 'Instagram',
};

interface AiAgentActivityListProps {
  tenantId: string;
}

export function AiAgentActivityList({ tenantId }: AiAgentActivityListProps) {
  const navigate = useNavigate();
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['agent-activity-logs', tenantId],
    queryFn: () => getAgentActivityLogs(tenantId, { limit: 50 }),
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Carregando atividade...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade do Agente</CardTitle>
        <CardDescription>
          Quando o agente respondeu, em qual canal e se a conversa foi assumida por alguém da equipe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma atividade registrada ainda.</p>
        ) : (
          <ul className="space-y-3">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm hover:bg-muted/50"
              >
                <span className="text-muted-foreground shrink-0">
                  {format(new Date(log.responded_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
                <Badge variant="secondary" className="font-normal">
                  {CHANNEL_LABELS[log.channel_type] ?? log.channel_type}
                </Badge>
                {log.interrupted_by_handoff && (
                  <Badge variant="outline" className="text-amber-600 border-amber-500/30 gap-1">
                    <Handshake className="h-3 w-3" />
                    Assumido por humano
                  </Badge>
                )}
                {log.content_summary && (
                  <span className="text-muted-foreground truncate max-w-[200px]" title={log.content_summary}>
                    {log.content_summary}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/inbox/${log.thread_id}`)}
                  className="ml-auto text-primary hover:underline flex items-center gap-1"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Ver conversa
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
