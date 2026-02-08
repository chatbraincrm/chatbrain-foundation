import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { useAuth } from '@/lib/auth-context';
import { can } from '@/lib/rbac';
import { getTenantLeads, createLead, deleteLead } from '@/modules/crm/leads-api';
import { getAllEntityTags, getTenantTags } from '@/modules/crm/tags-api';
import { getTenantCompanies } from '@/modules/crm/companies-api';
import { createLeadSchema } from '@/lib/validators';
import { createAuditLog } from '@/modules/audit/api';
import { logActivityEvent } from '@/modules/crm/timeline-api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Eye, Search, X, Tag as TagIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Leads() {
  const { currentTenant, membership } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = can(membership?.role, 'crm:write');
  const canDelete = can(membership?.role, 'crm:delete');
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: '', company_id: '' });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', currentTenant?.id],
    queryFn: () => getTenantLeads(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const { data: leadTags = [] } = useQuery({
    queryKey: ['entity-tags-all', 'lead', currentTenant?.id],
    queryFn: () => getAllEntityTags(currentTenant!.id, 'lead'),
    enabled: !!currentTenant,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags', currentTenant?.id],
    queryFn: () => getTenantTags(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const tagsByLeadId = useMemo(() => {
    const map: Record<string, any[]> = {};
    leadTags.forEach((et: any) => {
      if (!map[et.entity_id]) map[et.entity_id] = [];
      map[et.entity_id].push(et.tags);
    });
    return map;
  }, [leadTags]);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', currentTenant?.id],
    queryFn: () => getTenantCompanies(currentTenant!.id),
    enabled: !!currentTenant && showCreate,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = createLeadSchema.safeParse({
        ...form,
        company_id: form.company_id || null,
        email: form.email || null,
        phone: form.phone || null,
        source: form.source || null,
      });
      if (!parsed.success) throw new Error(parsed.error.errors[0].message);
      const d = parsed.data;
      const lead = await createLead(currentTenant!.id, { name: d.name, email: d.email ?? null, phone: d.phone ?? null, source: d.source ?? null, company_id: d.company_id ?? null });
      await Promise.all([
        createAuditLog(currentTenant!.id, 'lead.created', 'lead', lead.id, { name: parsed.data.name }),
        logActivityEvent(currentTenant!.id, 'lead', lead.id, 'lead.created', { name: parsed.data.name }),
      ]);
      return lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setForm({ name: '', email: '', phone: '', source: '', company_id: '' });
      setShowCreate(false);
      toast({ title: 'Lead criado' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead removido' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const statusLabel: Record<string, string> = { open: 'Aberto', qualified: 'Qualificado', converted: 'Convertido', lost: 'Perdido' };

  // Tags that are actually used on leads (for filter options)
  const usedTagIds = useMemo(() => new Set(leadTags.map((et: any) => et.tag_id)), [leadTags]);
  const filterableTags = useMemo(() => allTags.filter(t => usedTagIds.has(t.id)), [allTags, usedTagIds]);

  const toggleTagFilter = (tagId: string) => {
    setTagFilter(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead: any) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || lead.name?.toLowerCase().includes(q) || lead.email?.toLowerCase().includes(q) || lead.phone?.includes(q);
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const matchesTags = tagFilter.length === 0 || tagFilter.every(tagId => tagsByLeadId[lead.id]?.some((t: any) => t.id === tagId));
      return matchesSearch && matchesStatus && matchesTags;
    });
  }, [leads, search, statusFilter, tagFilter, tagsByLeadId]);

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        {canWrite && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Lead</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Lead</DialogTitle>
              </DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Origem</Label>
                    <Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="Ex: Website, Indicação" />
                  </div>
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Select value={form.company_id} onValueChange={v => setForm(f => ({ ...f, company_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Criando...' : 'Criar Lead'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="open">Aberto</SelectItem>
            <SelectItem value="qualified">Qualificado</SelectItem>
            <SelectItem value="converted">Convertido</SelectItem>
            <SelectItem value="lost">Perdido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filterableTags.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <TagIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {filterableTags.map((tag: any) => {
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

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {leads.length === 0 ? 'Nenhum lead encontrado' : 'Nenhum lead corresponde aos filtros'}
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead: any) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{lead.name}</span>
                      {tagsByLeadId[lead.id]?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tagsByLeadId[lead.id].map((tag: any) => (
                            <span key={tag.id} className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: tag.color || '#64748b' }}>{tag.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.email || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.phone || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.source || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{statusLabel[lead.status] || lead.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/crm/leads/${lead.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(lead.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
