import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { useAuth } from '@/lib/auth-context';
import { can } from '@/lib/rbac';
import { getDeal, updateDeal } from '@/modules/crm/deals-api';
import { getTenantTasks, createTask, updateTask } from '@/modules/crm/tasks-api';
import { getEntityTimeline, logActivityEvent } from '@/modules/crm/timeline-api';
import { createAuditLog } from '@/modules/audit/api';
import { createTaskSchema } from '@/lib/validators';
import EntityTagManager from '@/components/crm/EntityTagManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant, membership } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canWrite = can(membership?.role, 'crm:write');
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueAt, setTaskDueAt] = useState('');

  const { data: deal, isLoading } = useQuery({
    queryKey: ['deal', id],
    queryFn: () => getDeal(id!),
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'deal', id],
    queryFn: () => getTenantTasks(currentTenant!.id, { deal_id: id }),
    enabled: !!id && !!currentTenant,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', 'deal', id],
    queryFn: () => getEntityTimeline(currentTenant!.id, 'deal', id!),
    enabled: !!id && !!currentTenant,
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const parsed = createTaskSchema.safeParse({
        title: taskTitle,
        deal_id: id,
        due_at: taskDueAt || null,
        assigned_user_id: user?.id || null,
      });
      if (!parsed.success) throw new Error(parsed.error.errors[0].message);
      const d = parsed.data;
      const task = await createTask(currentTenant!.id, { title: d.title, deal_id: d.deal_id ?? null, due_at: d.due_at ?? null, assigned_user_id: d.assigned_user_id ?? null });
      await Promise.all([
        createAuditLog(currentTenant!.id, 'task.created', 'task', task.id, { title: parsed.data.title, deal_id: id }),
        logActivityEvent(currentTenant!.id, 'deal', id!, 'task.created', { title: parsed.data.title }),
      ]);
      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'deal', id] });
      queryClient.invalidateQueries({ queryKey: ['timeline', 'deal', id] });
      setTaskTitle('');
      setTaskDueAt('');
      setShowAddTask(false);
      toast({ title: 'Tarefa criada' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await updateTask(taskId, { status: 'done' });
      await Promise.all([
        createAuditLog(currentTenant!.id, 'task.completed', 'task', taskId),
        logActivityEvent(currentTenant!.id, 'deal', id!, 'task.completed', { task_id: taskId }),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'deal', id] });
      queryClient.invalidateQueries({ queryKey: ['timeline', 'deal', id] });
      toast({ title: 'Tarefa concluída' });
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!deal) return <div className="text-muted-foreground">Negócio não encontrado</div>;

  const valueBRL = (deal.value_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: deal.currency });

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate('/crm/deals')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />Voltar
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Deal Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{deal.title}</CardTitle>
                {deal.value_cents > 0 && <span className="text-lg font-bold text-primary">{valueBRL}</span>}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Etapa:</span> <Badge style={{ backgroundColor: deal.pipeline_stages?.color || '#6b7280' }} className="text-white">{deal.pipeline_stages?.name}</Badge></div>
                <div><span className="text-muted-foreground">Lead:</span> {deal.leads?.name || '-'}</div>
                <div><span className="text-muted-foreground">Empresa:</span> {deal.companies?.name || '-'}</div>
                <div><span className="text-muted-foreground">Responsável:</span> {deal.profiles?.name || deal.profiles?.email || '-'}</div>
              </div>
              <div className="pt-3 border-t border-border mt-3">
                <span className="text-sm text-muted-foreground mr-2">Tags:</span>
                <EntityTagManager entity="deal" entityId={deal.id} />
              </div>
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Tarefas</CardTitle>
                {canWrite && (
                  <Button variant="outline" size="sm" onClick={() => setShowAddTask(!showAddTask)}>
                    <Plus className="h-3 w-3 mr-1" />Tarefa
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {showAddTask && (
                <form onSubmit={e => { e.preventDefault(); createTaskMutation.mutate(); }} className="flex items-end gap-2 mb-4">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Título</Label>
                    <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} className="h-8 text-sm" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Prazo</Label>
                    <Input type="datetime-local" value={taskDueAt} onChange={e => setTaskDueAt(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <Button size="sm" className="h-8" type="submit" disabled={createTaskMutation.isPending}>Adicionar</Button>
                </form>
              )}
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task: any) => (
                    <div key={task.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                      {canWrite && task.status !== 'done' ? (
                        <Checkbox onCheckedChange={() => completeTaskMutation.mutate(task.id)} />
                      ) : task.status === 'done' ? (
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                      )}
                      <span className={`text-sm flex-1 ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
                      {task.due_at && (
                        <span className="text-xs text-muted-foreground">{format(new Date(task.due_at), 'dd/MM HH:mm')}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade</p>
            ) : (
              <div className="space-y-3">
                {timeline.map(entry => (
                  <div key={entry.id} className="border-l-2 border-border pl-3 py-1">
                    <p className="text-sm font-medium">{entry.action}</p>
                    {entry.metadata && (
                      <p className="text-xs text-muted-foreground">
                        {Object.entries(entry.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {entry.profiles?.name || 'Sistema'} · {format(new Date(entry.created_at), 'dd/MM HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
