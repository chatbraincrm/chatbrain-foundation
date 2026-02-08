import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { can } from '@/lib/rbac';
import { getTenantPipelines, createPipeline, deletePipeline, getPipelineStages, createStage, deleteStage } from '@/modules/crm/pipelines-api';
import { createPipelineSchema, createStageSchema } from '@/lib/validators';
import { createAuditLog } from '@/modules/audit/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Pipeline, PipelineStage } from '@/types';

function StageList({ pipeline, tenantId, canManage }: { pipeline: Pipeline; tenantId: string; canManage: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [stageName, setStageName] = useState('');
  const [stageColor, setStageColor] = useState('#3b82f6');

  const { data: stages = [] } = useQuery({
    queryKey: ['pipeline-stages', pipeline.id],
    queryFn: () => getPipelineStages(pipeline.id),
  });

  const addStageMutation = useMutation({
    mutationFn: async () => {
      const result = createStageSchema.safeParse({ name: stageName, position: stages.length, color: stageColor });
      if (!result.success) throw new Error(result.error.errors[0].message);
      return createStage(tenantId, pipeline.id, result.data.name, result.data.position, result.data.color);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages', pipeline.id] });
      setStageName('');
      setShowAdd(false);
      toast({ title: 'Etapa criada' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteStageMutation = useMutation({
    mutationFn: deleteStage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages', pipeline.id] });
      toast({ title: 'Etapa removida' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="mt-3 space-y-2">
      {stages.map((stage: PipelineStage) => (
        <div key={stage.id} className="flex items-center gap-2 pl-4">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color || '#6b7280' }} />
          <span className="text-sm flex-1">{stage.name}</span>
          <Badge variant="outline" className="text-xs">{stage.position}</Badge>
          {canManage && !pipeline.is_default && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteStageMutation.mutate(stage.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      {canManage && (
        <>
          {showAdd ? (
            <div className="flex items-end gap-2 pl-4">
              <div className="flex-1 space-y-1">
                <Input placeholder="Nome da etapa" value={stageName} onChange={e => setStageName(e.target.value)} className="h-8 text-sm" />
              </div>
              <input type="color" value={stageColor} onChange={e => setStageColor(e.target.value)} className="h-8 w-8 rounded border border-border cursor-pointer" />
              <Button size="sm" className="h-8" onClick={() => addStageMutation.mutate()} disabled={addStageMutation.isPending}>Adicionar</Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowAdd(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="ml-4 text-xs" onClick={() => setShowAdd(true)}>
              <Plus className="h-3 w-3 mr-1" />Etapa
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export default function Pipelines() {
  const { currentTenant, membership } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = can(membership?.role, 'crm:write');
  const canDelete = can(membership?.role, 'crm:delete');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ['pipelines', currentTenant?.id],
    queryFn: () => getTenantPipelines(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = createPipelineSchema.safeParse({ name });
      if (!result.success) throw new Error(result.error.errors[0].message);
      const pipeline = await createPipeline(currentTenant!.id, result.data.name);
      await createAuditLog(currentTenant!.id, 'pipeline.created', 'pipeline', pipeline.id, { name: result.data.name });
      return pipeline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      setName('');
      setShowCreate(false);
      toast({ title: 'Pipeline criado' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePipeline,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast({ title: 'Pipeline removido' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Pipelines</h1>
        {canManage && (
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4 mr-2" />Novo Pipeline
          </Button>
        )}
      </div>

      {showCreate && canManage && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Vendas Enterprise" />
              </div>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Criando...' : 'Criar'}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {pipelines.map((pipeline) => (
          <Card key={pipeline.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpandedId(expandedId === pipeline.id ? null : pipeline.id)}>
                  {expandedId === pipeline.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <CardTitle className="text-base">{pipeline.name}</CardTitle>
                  {pipeline.is_default && <Badge variant="secondary" className="text-xs">Padrão</Badge>}
                </div>
                {canDelete && !pipeline.is_default && (
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(pipeline.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            {expandedId === pipeline.id && (
              <CardContent>
                <StageList pipeline={pipeline} tenantId={currentTenant!.id} canManage={canManage} />
              </CardContent>
            )}
          </Card>
        ))}
        {pipelines.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum pipeline encontrado</p>
        )}
      </div>
    </div>
  );
}
