import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { can } from '@/lib/rbac';
import { useToast } from '@/hooks/use-toast';
import { getAgent } from '@/modules/ai-agent/ai-agent-api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AiAgentGeneralForm } from './AiAgentGeneralForm';
import { AiAgentChannelsForm } from './AiAgentChannelsForm';
import { AiAgentKnowledgeList } from './AiAgentKnowledgeList';
import { AiAgentActivityList } from './AiAgentActivityList';

export default function AiAgentPage() {
  const { currentTenant, membership } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const canView = can(membership?.role, 'view_ai_agent');
  const canManage = can(membership?.role, 'manage_ai_agent');

  const { data: agent, isLoading } = useQuery({
    queryKey: ['ai-agent', currentTenant?.id],
    queryFn: () => getAgent(currentTenant!.id),
    enabled: !!currentTenant && canView,
  });

  useEffect(() => {
    if (currentTenant && !canView) {
      toast({ title: 'Sem permissão', description: 'Você não tem acesso ao Agente de Atendimento.', variant: 'destructive' });
      navigate('/dashboard', { replace: true });
    }
  }, [currentTenant, canView, navigate, toast]);

  if (!currentTenant) return null;
  if (!canView) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Agente de Atendimento</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Responde clientes automaticamente. Você pode assumir a conversa a qualquer momento.
      </p>
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="channels">Canais e Comportamento</TabsTrigger>
            <TabsTrigger value="knowledge">Base de Conhecimento</TabsTrigger>
            <TabsTrigger value="activity">Atividade</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="mt-4">
            <AiAgentGeneralForm
              tenantId={currentTenant.id}
              agent={agent ?? undefined}
              canManage={canManage}
            />
          </TabsContent>
          <TabsContent value="channels" className="mt-4">
            <AiAgentChannelsForm
              tenantId={currentTenant.id}
              agentId={agent?.id}
              canManage={canManage}
            />
          </TabsContent>
          <TabsContent value="knowledge" className="mt-4">
            <AiAgentKnowledgeList
              tenantId={currentTenant.id}
              agentId={agent?.id}
              canManage={canManage}
            />
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <AiAgentActivityList tenantId={currentTenant.id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
