import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertAgent } from '@/modules/ai-agent/ai-agent-api';
import { aiAgentSchema, type AiAgentFormData } from '@/modules/ai-agent/ai-agent-validators';
import type { AiAgent } from '@/modules/ai-agent/ai-agent-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Bot } from 'lucide-react';

interface AiAgentGeneralFormProps {
  tenantId: string;
  agent?: AiAgent | null;
  canManage: boolean;
}

export function AiAgentGeneralForm({ tenantId, agent, canManage }: AiAgentGeneralFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(agent?.name ?? '');
  const [isActive, setIsActive] = useState(agent?.is_active ?? false);
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt ?? '');
  const [userPrompt, setUserPrompt] = useState(agent?.user_prompt ?? '');

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setIsActive(agent.is_active);
      setSystemPrompt(agent.system_prompt);
      setUserPrompt(agent.user_prompt ?? '');
    } else {
      setName('');
      setIsActive(false);
      setSystemPrompt('');
      setUserPrompt('');
    }
  }, [agent]);

  const upsertMutation = useMutation({
    mutationFn: (payload: AiAgentFormData) => upsertAgent(tenantId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent', tenantId] });
      toast({ title: 'Agente salvo com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = aiAgentSchema.safeParse({
      name,
      is_active: isActive,
      system_prompt: systemPrompt,
      user_prompt: userPrompt || null,
    });
    if (!result.success) {
      toast({ title: 'Erro', description: result.error.errors[0].message, variant: 'destructive' });
      return;
    }
    upsertMutation.mutate(result.data);
  };

  const handleCreateAgent = () => {
    const result = aiAgentSchema.safeParse({
      name: 'Meu Agente',
      is_active: false,
      system_prompt: 'Você é um assistente prestativo. Responda de forma clara e objetiva.',
      user_prompt: null,
    });
    if (!result.success) return;
    upsertMutation.mutate(result.data);
  };

  if (!agent && !canManage) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Nenhum agente configurado. Apenas administradores e gerentes podem criar.</p>
        </CardContent>
      </Card>
    );
  }

  if (!agent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agente de Atendimento</CardTitle>
          <CardDescription>Configure o agente para responder clientes automaticamente nas conversas.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Ainda não há agente configurado para este workspace.</p>
            <Button onClick={handleCreateAgent} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? 'Criando...' : 'Criar Agente de Atendimento'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Geral</CardTitle>
        <CardDescription>Nome, ativação e instruções do agente.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>
            <AlertDescription>Defina como o agente deve se comportar e o que responder aos clientes.</AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManage}
              placeholder="Ex: Atendimento"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={!canManage}
            />
            <Label htmlFor="is_active">Agente ativo (responde automaticamente)</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="system_prompt">Instruções do agente (obrigatório)</Label>
            <Textarea
              id="system_prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              disabled={!canManage}
              rows={8}
              className="resize-y min-h-[160px]"
              placeholder="Ex: Você é um assistente do suporte. Seja cordial e objetivo."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user_prompt">Contexto adicional (opcional)</Label>
            <Textarea
              id="user_prompt"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              disabled={!canManage}
              rows={4}
              className="resize-y"
              placeholder="Instruções adicionais ou contexto."
            />
          </div>
          {canManage && (
            <Button type="submit" disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
