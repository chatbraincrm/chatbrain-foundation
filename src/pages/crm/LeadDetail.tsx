import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { can } from '@/lib/rbac';
import { getLead, updateLead } from '@/modules/crm/leads-api';
import { getEntityTimeline } from '@/modules/crm/timeline-api';
import EntityTagManager from '@/components/crm/EntityTagManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant, membership } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canWrite = can(membership?.role, 'crm:write');

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => getLead(id!),
    enabled: !!id,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', 'lead', id],
    queryFn: () => getEntityTimeline(currentTenant!.id, 'lead', id!),
    enabled: !!id && !!currentTenant,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => updateLead(id!, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      toast({ title: 'Status atualizado' });
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!lead) return <div className="text-muted-foreground">Lead não encontrado</div>;

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate('/crm/leads')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />Voltar
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{lead.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Email:</span> {lead.email || '-'}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {lead.phone || '-'}</div>
                <div><span className="text-muted-foreground">Origem:</span> {lead.source || '-'}</div>
                <div><span className="text-muted-foreground">Empresa:</span> {(lead as any).companies?.name || '-'}</div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  {canWrite ? (
                    <Select value={lead.status} onValueChange={v => updateStatusMutation.mutate(v)}>
                      <SelectTrigger className="w-[140px] h-7 inline-flex">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Aberto</SelectItem>
                        <SelectItem value="qualified">Qualificado</SelectItem>
                        <SelectItem value="converted">Convertido</SelectItem>
                        <SelectItem value="lost">Perdido</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="capitalize">{lead.status}</Badge>
                  )}
                </div>
              </div>
              <div className="pt-3 border-t border-border mt-3">
                <span className="text-sm text-muted-foreground mr-2">Tags:</span>
                <EntityTagManager entity="lead" entityId={lead.id} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
              ) : (
                <div className="space-y-3">
                  {timeline.map(entry => (
                    <div key={entry.id} className="border-l-2 border-border pl-3 py-1">
                      <p className="text-sm font-medium">{entry.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.profiles?.name || entry.profiles?.email || 'Sistema'} · {format(new Date(entry.created_at), 'dd/MM HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
