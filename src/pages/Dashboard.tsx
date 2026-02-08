import { useMemo } from 'react';
import { useTenant } from '@/lib/tenant-context';
import { useQuery } from '@tanstack/react-query';
import { getTenantMemberships } from '@/modules/memberships/api';
import { getTenantDeals } from '@/modules/crm/deals-api';
import { getTenantLeads } from '@/modules/crm/leads-api';
import { getTenantPipelines, getPipelineStages } from '@/modules/crm/pipelines-api';
import { getTenantTasks } from '@/modules/crm/tasks-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, UserCheck, ListTodo, DollarSign, BarChart3, Target, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import type { DealWithRelations, PipelineStage } from '@/types';

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function DealsByStageChart({ deals, stages }: { deals: DealWithRelations[]; stages: PipelineStage[] }) {
  const data = useMemo(() => {
    return stages
      .sort((a, b) => a.position - b.position)
      .map(stage => {
        const stageDeals = deals.filter(d => d.stage_id === stage.id);
        return {
          name: stage.name,
          count: stageDeals.length,
          value: stageDeals.reduce((sum, d) => sum + d.value_cents, 0),
          color: stage.color || '#6b7280',
        };
      });
  }, [deals, stages]);

  if (data.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(215 12% 55%)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(215 12% 55%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ backgroundColor: 'hsl(224 28% 11%)', border: '1px solid hsl(224 15% 18%)', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'hsl(210 20% 95%)' }}
          formatter={(value: number, name: string) => [value, 'Negócios']}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LeadsByStatusChart({ leads }: { leads: any[] }) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    open: { label: 'Aberto', color: 'hsl(217 91% 60%)' },
    qualified: { label: 'Qualificado', color: 'hsl(142 72% 42%)' },
    converted: { label: 'Convertido', color: 'hsl(262 80% 60%)' },
    lost: { label: 'Perdido', color: 'hsl(0 72% 51%)' },
  };

  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({
      name: statusConfig[status]?.label || status,
      value: count,
      color: statusConfig[status]?.color || '#6b7280',
    }));
  }, [leads]);

  if (data.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>;

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={160}>
        <PieChart>
          <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={40} paddingAngle={2} strokeWidth={0}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(224 28% 11%)', border: '1px solid hsl(224 15% 18%)', borderRadius: 8, fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-2">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground flex-1">{d.name}</span>
            <span className="font-medium">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { currentTenant, membership } = useTenant();

  const { data: members } = useQuery({
    queryKey: ['memberships', currentTenant?.id],
    queryFn: () => getTenantMemberships(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ['pipelines', currentTenant?.id],
    queryFn: () => getTenantPipelines(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const defaultPipelineId = pipelines.find(p => p.is_default)?.id || pipelines[0]?.id || '';

  const { data: stages = [] } = useQuery({
    queryKey: ['pipeline-stages', defaultPipelineId],
    queryFn: () => getPipelineStages(defaultPipelineId),
    enabled: !!defaultPipelineId,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals', currentTenant?.id, defaultPipelineId],
    queryFn: () => getTenantDeals(currentTenant!.id, defaultPipelineId),
    enabled: !!currentTenant && !!defaultPipelineId,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads', currentTenant?.id],
    queryFn: () => getTenantLeads(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', currentTenant?.id],
    queryFn: () => getTenantTasks(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const metrics = useMemo(() => {
    const totalPipelineValue = deals.reduce((sum, d) => sum + d.value_cents, 0);
    const openLeads = leads.filter((l: any) => l.status === 'open').length;
    const qualifiedLeads = leads.filter((l: any) => l.status === 'qualified').length;
    const openTasks = tasks.filter((t: any) => t.status === 'open').length;
    const doneTasks = tasks.filter((t: any) => t.status === 'done').length;
    return { totalPipelineValue, openLeads, qualifiedLeads, openTasks, doneTasks, totalDeals: deals.length, totalLeads: leads.length, totalTasks: tasks.length };
  }, [deals, leads, tasks]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor do Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(metrics.totalPipelineValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{metrics.totalDeals} negócio{metrics.totalDeals !== 1 ? 's' : ''} ativo{metrics.totalDeals !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads Abertos</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.openLeads}</div>
            <p className="text-xs text-muted-foreground mt-1">{metrics.qualifiedLeads} qualificado{metrics.qualifiedLeads !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tarefas Abertas</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.openTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">{metrics.doneTasks} concluída{metrics.doneTasks !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Membros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1 capitalize">{membership?.role ?? '-'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Negócios por Etapa</CardTitle>
            </div>
            {pipelines.length > 0 && (
              <p className="text-xs text-muted-foreground">{pipelines.find(p => p.id === defaultPipelineId)?.name}</p>
            )}
          </CardHeader>
          <CardContent>
            <DealsByStageChart deals={deals} stages={stages} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Leads por Status</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">{metrics.totalLeads} lead{metrics.totalLeads !== 1 ? 's' : ''} no total</p>
          </CardHeader>
          <CardContent>
            <LeadsByStatusChart leads={leads} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
