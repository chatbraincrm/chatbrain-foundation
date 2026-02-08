import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { useAuth } from '@/lib/auth-context';
import { can } from '@/lib/rbac';
import { getTenantDeals, createDeal, updateDeal } from '@/modules/crm/deals-api';
import { getAllEntityTags, getTenantTags } from '@/modules/crm/tags-api';
import { getTenantPipelines, getPipelineStages } from '@/modules/crm/pipelines-api';
import { getTenantLeads } from '@/modules/crm/leads-api';
import { getTenantCompanies } from '@/modules/crm/companies-api';
import { getTenantMemberships } from '@/modules/memberships/api';
import { createAuditLog } from '@/modules/audit/api';
import { logActivityEvent } from '@/modules/crm/timeline-api';
import { createDealSchema } from '@/lib/validators';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, GripVertical, Search, X, Tag as TagIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PipelineStage, DealWithRelations } from '@/types';

function DealCard({ deal, tags, onClick }: { deal: DealWithRelations; tags?: any[]; onClick: () => void }) {
  const valueBRL = (deal.value_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: deal.currency });
  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('deal-id', deal.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onClick}
      className="p-3 rounded-md border border-border bg-card hover:bg-muted/50 cursor-pointer transition-colors space-y-1"
    >
      <p className="text-sm font-medium truncate">{deal.title}</p>
      {deal.value_cents > 0 && <p className="text-xs text-primary font-semibold">{valueBRL}</p>}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag: any) => (
            <span key={tag.id} className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: tag.color || '#64748b' }}>{tag.name}</span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {deal.leads && <span>{deal.leads.name}</span>}
        {deal.profiles && <span className="ml-auto">{deal.profiles.name || deal.profiles.email}</span>}
      </div>
    </div>
  );
}

function StageColumn({
  stage,
  deals,
  dealTagsMap,
  onDrop,
  navigate,
}: {
  stage: PipelineStage;
  deals: DealWithRelations[];
  dealTagsMap: Record<string, any[]>;
  onDrop: (dealId: string, stageId: string) => void;
  navigate: (path: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const stageDeals = deals.filter(d => d.stage_id === stage.id);
  const totalValue = stageDeals.reduce((sum, d) => sum + d.value_cents, 0);

  return (
    <div
      className={`flex flex-col min-w-[280px] max-w-[320px] rounded-lg border transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        const dealId = e.dataTransfer.getData('deal-id');
        if (dealId) onDrop(dealId, stage.id);
      }}
    >
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color || '#6b7280' }} />
          <span className="text-sm font-medium flex-1">{stage.name}</span>
          <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
        </div>
        {totalValue > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {(totalValue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        )}
      </div>
      <div className="p-2 space-y-2 flex-1 min-h-[100px]">
        {stageDeals.map(deal => (
          <DealCard key={deal.id} deal={deal} tags={dealTagsMap[deal.id]} onClick={() => navigate(`/crm/deals/${deal.id}`)} />
        ))}
      </div>
    </div>
  );
}

export default function DealsKanban() {
  const { currentTenant, membership } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = can(membership?.role, 'crm:write');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [dealSearch, setDealSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: '', pipeline_id: '', stage_id: '', lead_id: '', company_id: '',
    value_cents: 0, owner_user_id: '',
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ['pipelines', currentTenant?.id],
    queryFn: () => getTenantPipelines(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const activePipelineId = selectedPipelineId || pipelines.find(p => p.is_default)?.id || pipelines[0]?.id || '';

  const { data: stages = [] } = useQuery({
    queryKey: ['pipeline-stages', activePipelineId],
    queryFn: () => getPipelineStages(activePipelineId),
    enabled: !!activePipelineId,
  });

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', currentTenant?.id, activePipelineId],
    queryFn: () => getTenantDeals(currentTenant!.id, activePipelineId),
    enabled: !!currentTenant && !!activePipelineId,
  });

  const { data: dealTags = [] } = useQuery({
    queryKey: ['entity-tags-all', 'deal', currentTenant?.id],
    queryFn: () => getAllEntityTags(currentTenant!.id, 'deal'),
    enabled: !!currentTenant,
  });

  const dealTagsMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    dealTags.forEach((et: any) => {
      if (!map[et.entity_id]) map[et.entity_id] = [];
      map[et.entity_id].push(et.tags);
    });
    return map;
  }, [dealTags]);

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags', currentTenant?.id],
    queryFn: () => getTenantTags(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const usedDealTagIds = useMemo(() => new Set(dealTags.map((et: any) => et.tag_id)), [dealTags]);
  const filterableDealTags = useMemo(() => allTags.filter(t => usedDealTagIds.has(t.id)), [allTags, usedDealTagIds]);

  const toggleTagFilter = (tagId: string) => {
    setTagFilter(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
  };

  const { data: leads = [] } = useQuery({
    queryKey: ['leads', currentTenant?.id],
    queryFn: () => getTenantLeads(currentTenant!.id),
    enabled: !!currentTenant && showCreate,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', currentTenant?.id],
    queryFn: () => getTenantCompanies(currentTenant!.id),
    enabled: !!currentTenant && showCreate,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['memberships', currentTenant?.id],
    queryFn: () => getTenantMemberships(currentTenant!.id),
    enabled: !!currentTenant && showCreate,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = createDealSchema.safeParse({
        ...form,
        lead_id: form.lead_id || null,
        company_id: form.company_id || null,
        owner_user_id: form.owner_user_id || null,
      });
      if (!parsed.success) throw new Error(parsed.error.errors[0].message);
      const d = parsed.data;
      const deal = await createDeal(currentTenant!.id, { title: d.title, pipeline_id: d.pipeline_id, stage_id: d.stage_id, lead_id: d.lead_id ?? null, company_id: d.company_id ?? null, value_cents: d.value_cents, currency: d.currency, owner_user_id: d.owner_user_id ?? null });
      await Promise.all([
        createAuditLog(currentTenant!.id, 'deal.created', 'deal', deal.id, { title: parsed.data.title }),
        logActivityEvent(currentTenant!.id, 'deal', deal.id, 'deal.created', { title: parsed.data.title }),
      ]);
      return deal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setForm({ title: '', pipeline_id: '', stage_id: '', lead_id: '', company_id: '', value_cents: 0, owner_user_id: '' });
      setShowCreate(false);
      toast({ title: 'Negócio criado' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const moveDealMutation = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      const deal = deals.find(d => d.id === dealId);
      if (!deal || deal.stage_id === stageId) return;
      await updateDeal(dealId, { stage_id: stageId });
      const stageName = stages.find(s => s.id === stageId)?.name || stageId;
      const oldStageName = stages.find(s => s.id === deal.stage_id)?.name || deal.stage_id;
      await Promise.all([
        createAuditLog(currentTenant!.id, 'deal.stage_changed', 'deal', dealId, { from: oldStageName, to: stageName }),
        logActivityEvent(currentTenant!.id, 'deal', dealId, 'deal.stage_changed', { from: oldStageName, to: stageName }),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: (e: Error) => toast({ title: 'Erro ao mover', description: e.message, variant: 'destructive' }),
  });

  // Initialize form pipeline/stage when dialog opens
  const handleOpenCreate = () => {
    if (activePipelineId && stages.length > 0) {
      setForm(f => ({ ...f, pipeline_id: activePipelineId, stage_id: stages[0].id }));
    }
    setShowCreate(true);
  };

  const filteredDeals = useMemo(() => {
    return deals.filter((d: any) => {
      const q = dealSearch.toLowerCase();
      const matchesSearch = !q || d.title?.toLowerCase().includes(q) || d.leads?.name?.toLowerCase().includes(q) || d.companies?.name?.toLowerCase().includes(q);
      const matchesTags = tagFilter.length === 0 || tagFilter.every(tagId => dealTagsMap[d.id]?.some((t: any) => t.id === tagId));
      return matchesSearch && matchesTags;
    });
  }, [deals, dealSearch, tagFilter, dealTagsMap]);

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Negócios</h1>
          {pipelines.length > 1 && (
            <Select value={activePipelineId} onValueChange={setSelectedPipelineId}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar negócios..."
              value={dealSearch}
              onChange={e => setDealSearch(e.target.value)}
              className="pl-9 w-[220px]"
            />
            {dealSearch && (
              <button onClick={() => setDealSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {canWrite && (
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenCreate}><Plus className="h-4 w-4 mr-2" />Novo Negócio</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Criar Negócio</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Título *</Label>
                    <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Etapa</Label>
                      <Select value={form.stage_id} onValueChange={v => setForm(f => ({ ...f, stage_id: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.value_cents / 100}
                        onChange={e => setForm(f => ({ ...f, value_cents: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Lead</Label>
                      <Select value={form.lead_id} onValueChange={v => setForm(f => ({ ...f, lead_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Responsável</Label>
                      <Select value={form.owner_user_id} onValueChange={v => setForm(f => ({ ...f, owner_user_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {members.map((m: any) => (
                            <SelectItem key={m.user_id} value={m.user_id}>{m.profiles?.name || m.profiles?.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Criando...' : 'Criar Negócio'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {filterableDealTags.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <TagIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {filterableDealTags.map((tag: any) => {
            const active = tagFilter.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTagFilter(tag.id)}
                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium transition-all ${active ? 'text-white ring-2 ring-offset-1 ring-offset-background ring-primary' : 'text-white opacity-50 hover:opacity-80'}`}
                style={{ backgroundColor: tag.color || '#64748b' }}
              >
                {tag.name}
              </button>
            );
          })}
          {tagFilter.length > 0 && (
            <button onClick={() => setTagFilter([])} className="text-xs text-muted-foreground hover:text-foreground ml-1">
              Limpar
            </button>
          )}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => (
          <StageColumn
            key={stage.id}
            stage={stage}
            deals={filteredDeals}
            dealTagsMap={dealTagsMap}
            onDrop={(dealId, stageId) => moveDealMutation.mutate({ dealId, stageId })}
            navigate={navigate}
          />
        ))}
        {stages.length === 0 && (
          <p className="text-muted-foreground py-8">Nenhuma etapa configurada para este pipeline</p>
        )}
      </div>
    </div>
  );
}
