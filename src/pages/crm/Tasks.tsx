import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { useAuth } from '@/lib/auth-context';
import { can } from '@/lib/rbac';
import { getTenantTasks, createTask, updateTask, deleteTask } from '@/modules/crm/tasks-api';
import { getTenantMemberships } from '@/modules/memberships/api';
import { createAuditLog } from '@/modules/audit/api';
import { logActivityEvent } from '@/modules/crm/timeline-api';
import { createTaskSchema } from '@/lib/validators';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function Tasks() {
  const { currentTenant, membership } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canWrite = can(membership?.role, 'crm:write');
  const canDelete = can(membership?.role, 'crm:delete');
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>('open');
  const [form, setForm] = useState({ title: '', description: '', due_at: '', assigned_user_id: '' });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', currentTenant?.id, filter],
    queryFn: () => getTenantTasks(currentTenant!.id, { status: filter || undefined }),
    enabled: !!currentTenant,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['memberships', currentTenant?.id],
    queryFn: () => getTenantMemberships(currentTenant!.id),
    enabled: !!currentTenant && showCreate,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = createTaskSchema.safeParse({
        ...form,
        due_at: form.due_at || null,
        assigned_user_id: form.assigned_user_id || null,
        description: form.description || null,
      });
      if (!parsed.success) throw new Error(parsed.error.errors[0].message);
      const d = parsed.data;
      const task = await createTask(currentTenant!.id, { title: d.title, description: d.description ?? null, due_at: d.due_at ?? null, assigned_user_id: d.assigned_user_id ?? null });
      await createAuditLog(currentTenant!.id, 'task.created', 'task', task.id, { title: parsed.data.title });
      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setForm({ title: '', description: '', due_at: '', assigned_user_id: '' });
      setShowCreate(false);
      toast({ title: 'Tarefa criada' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await updateTask(taskId, { status: 'done' });
      await createAuditLog(currentTenant!.id, 'task.completed', 'task', taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Tarefa concluída' });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (taskId: string) => updateTask(taskId, { status: 'open' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Tarefa removida' });
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Abertas</SelectItem>
              <SelectItem value="done">Concluídas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canWrite && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Tarefa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Tarefa</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prazo</Label>
                    <Input type="datetime-local" value={form.due_at} onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsável</Label>
                    <Select value={form.assigned_user_id} onValueChange={v => setForm(f => ({ ...f, assigned_user_id: v }))}>
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
                  {createMutation.isPending ? 'Criando...' : 'Criar Tarefa'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>Título</TableHead>
              <TableHead>Negócio</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Status</TableHead>
              {canDelete && <TableHead className="w-[60px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canDelete ? 7 : 6} className="text-center text-muted-foreground py-8">Nenhuma tarefa encontrada</TableCell>
              </TableRow>
            ) : (
              tasks.map((task: any) => (
                <TableRow key={task.id}>
                  <TableCell>
                    {canWrite && task.status !== 'done' ? (
                      <Checkbox onCheckedChange={() => completeMutation.mutate(task.id)} />
                    ) : task.status === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-success cursor-pointer" onClick={() => canWrite && reopenMutation.mutate(task.id)} />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border" />
                    )}
                  </TableCell>
                  <TableCell className={task.status === 'done' ? 'line-through text-muted-foreground' : 'font-medium'}>{task.title}</TableCell>
                  <TableCell className="text-muted-foreground">{task.deals?.title || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{task.profiles?.name || task.profiles?.email || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {task.due_at ? format(new Date(task.due_at), 'dd/MM/yyyy HH:mm') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={task.status === 'done' ? 'secondary' : 'outline'} className="capitalize">
                      {task.status === 'done' ? 'Concluída' : 'Aberta'}
                    </Badge>
                  </TableCell>
                  {canDelete && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(task.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
