import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAgentChannels,
  setChannelEnabled,
  getAgentSettings,
  updateAgentSettings,
} from '@/modules/ai-agent/ai-agent-api';
import { aiAgentSettingsSchema, type AiAgentSettingsFormData } from '@/modules/ai-agent/ai-agent-validators';
import type { AiAgentChannelType } from '@/modules/ai-agent/ai-agent-types';
import { AI_AGENT_CHANNEL_TYPES } from '@/modules/ai-agent/ai-agent-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

const CHANNEL_LABELS: Record<AiAgentChannelType, string> = {
  internal: 'Interno',
  whatsapp: 'WhatsApp',
  email: 'Email',
  instagram: 'Instagram',
};

const CHANNELS_ENABLED_IN_UI: AiAgentChannelType[] = ['internal', 'whatsapp'];
const CHANNELS_COMING_SOON: AiAgentChannelType[] = ['email', 'instagram'];

interface AiAgentChannelsFormProps {
  tenantId: string;
  agentId?: string;
  canManage: boolean;
}

export function AiAgentChannelsForm({ tenantId, agentId, canManage }: AiAgentChannelsFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: channels = [] } = useQuery({
    queryKey: ['ai-agent-channels', tenantId, agentId],
    queryFn: () => getAgentChannels(tenantId!, agentId!),
    enabled: !!tenantId && !!agentId,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['ai-agent-settings', tenantId, agentId],
    queryFn: () => getAgentSettings(tenantId!, agentId!),
    enabled: !!tenantId && !!agentId,
  });

  const [form, setForm] = useState<AiAgentSettingsFormData>({
    response_delay_ms: 1200,
    use_chunked_messages: true,
    typing_simulation: true,
    max_chunks: 6,
    max_consecutive_replies: 5,
    allow_audio: true,
    allow_images: true,
    allow_handoff_human: true,
    allow_scheduling: true,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        response_delay_ms: settings.response_delay_ms,
        use_chunked_messages: settings.use_chunked_messages,
        typing_simulation: settings.typing_simulation,
        max_chunks: settings.max_chunks,
        max_consecutive_replies: settings.max_consecutive_replies ?? 5,
        allow_audio: settings.allow_audio,
        allow_images: settings.allow_images,
        allow_handoff_human: settings.allow_handoff_human,
        allow_scheduling: settings.allow_scheduling,
      });
    }
  }, [settings]);

  const channelMutation = useMutation({
    mutationFn: ({
      channelType,
      isEnabled,
    }: { channelType: AiAgentChannelType; isEnabled: boolean }) =>
      setChannelEnabled(tenantId, agentId!, channelType, isEnabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-channels', tenantId, agentId] });
      toast({ title: 'Canal atualizado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (payload: AiAgentSettingsFormData) =>
      updateAgentSettings(tenantId, agentId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-settings', tenantId, agentId] });
      toast({ title: 'Configurações salvas' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const getChannelEnabled = (channelType: AiAgentChannelType) =>
    channels.find((c) => c.channel_type === channelType)?.is_enabled ?? false;

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const result = aiAgentSettingsSchema.safeParse(form);
    if (!result.success) {
      toast({ title: 'Erro', description: result.error.errors[0].message, variant: 'destructive' });
      return;
    }
    settingsMutation.mutate(result.data);
  };

  if (!agentId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Crie um agente na aba Geral para configurar canais e comportamento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Canais</CardTitle>
            <CardDescription>Habilite o agente por canal. Apenas internal e WhatsApp estão disponíveis nesta versão.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {AI_AGENT_CHANNEL_TYPES.map((channelType) => {
              const enabledInUi = CHANNELS_ENABLED_IN_UI.includes(channelType);
              const comingSoon = CHANNELS_COMING_SOON.includes(channelType);
              const isEnabled = getChannelEnabled(channelType);
              const row = (
                <div key={channelType} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium">{CHANNEL_LABELS[channelType]}</span>
                  {comingSoon ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center">
                          <Switch checked={false} disabled />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Em breve</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) =>
                        canManage && channelMutation.mutate({ channelType, isEnabled: checked })
                      }
                      disabled={!canManage}
                    />
                  )}
                </div>
              );
              return row;
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comportamento</CardTitle>
            <CardDescription>Ajustes de resposta e mídia.</CardDescription>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="response_delay_ms">Atraso da resposta (ms)</Label>
                    <Input
                      id="response_delay_ms"
                      type="number"
                      min={0}
                      max={15000}
                      value={form.response_delay_ms}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, response_delay_ms: parseInt(e.target.value, 10) || 0 }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_chunks">Máx. fragmentos</Label>
                    <Input
                      id="max_chunks"
                      type="number"
                      min={1}
                      max={12}
                      value={form.max_chunks}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, max_chunks: parseInt(e.target.value, 10) || 1 }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div className="space-y-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label htmlFor="max_consecutive_replies">Máx. respostas seguidas</Label>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Após esse número de respostas automáticas na mesma conversa, o agente pausa e sugere assumir a conversa.
                      </TooltipContent>
                    </Tooltip>
                    <Input
                      id="max_consecutive_replies"
                      type="number"
                      min={1}
                      max={20}
                      value={form.max_consecutive_replies}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, max_consecutive_replies: parseInt(e.target.value, 10) || 1 }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="use_chunked_messages"
                      checked={form.use_chunked_messages}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, use_chunked_messages: v }))}
                      disabled={!canManage}
                    />
                    <Label htmlFor="use_chunked_messages">Mensagens em fragmentos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="typing_simulation"
                      checked={form.typing_simulation}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, typing_simulation: v }))}
                      disabled={!canManage}
                    />
                    <Label htmlFor="typing_simulation">Simular digitação</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="allow_audio"
                      checked={form.allow_audio}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, allow_audio: v }))}
                      disabled={!canManage}
                    />
                    <Label htmlFor="allow_audio">Permitir áudio</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="allow_images"
                      checked={form.allow_images}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, allow_images: v }))}
                      disabled={!canManage}
                    />
                    <Label htmlFor="allow_images">Permitir imagens</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="allow_handoff_human"
                      checked={form.allow_handoff_human}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, allow_handoff_human: v }))}
                      disabled={!canManage}
                    />
                    <Label htmlFor="allow_handoff_human">Permitir que atendentes assumam a conversa</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="allow_scheduling"
                      checked={form.allow_scheduling}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, allow_scheduling: v }))}
                      disabled={!canManage}
                    />
                    <Label htmlFor="allow_scheduling">Permitir agendamento</Label>
                  </div>
                </div>
                {canManage && (
                  <Button type="submit" disabled={settingsMutation.isPending}>
                    {settingsMutation.isPending ? 'Salvando...' : 'Salvar configurações'}
                  </Button>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
