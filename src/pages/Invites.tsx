import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { can } from '@/lib/rbac';
import { getTenantInvites, createInvite, deleteInvite } from '@/modules/invites/api';
import { createInviteSchema } from '@/lib/validators';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Copy, Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function Invites() {
  const { currentTenant, membership } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('agent');
  const [showForm, setShowForm] = useState(false);
  const canManage = can(membership?.role, 'invites:write');

  const { data: invites, isLoading } = useQuery({
    queryKey: ['invites', currentTenant?.id],
    queryFn: () => getTenantInvites(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const createMutation = useMutation({
    mutationFn: () => createInvite(currentTenant!.id, email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      setEmail('');
      setRole('agent');
      setShowForm(false);
      toast({ title: 'Convite criado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      toast({ title: 'Convite removido' });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const result = createInviteSchema.safeParse({ email, role });
    if (!result.success) {
      toast({ title: 'Erro', description: result.error.errors[0].message, variant: 'destructive' });
      return;
    }
    createMutation.mutate();
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado!' });
  };

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Convites</h1>
        {canManage && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Convite
          </Button>
        )}
      </div>

      {showForm && canManage && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Criar Convite</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 space-y-2 w-full">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Papel</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Criando...' : 'Criar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Expira em</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="w-[100px]">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!invites || invites.length === 0) ? (
              <TableRow>
                <TableCell colSpan={canManage ? 5 : 4} className="text-center text-muted-foreground py-8">
                  Nenhum convite encontrado
                </TableCell>
              </TableRow>
            ) : (
              invites.map((invite: any) => (
                <TableRow key={invite.id}>
                  <TableCell>{invite.email}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{invite.role}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(invite.expires_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    {invite.accepted_at ? (
                      <Badge className="bg-success/20 text-success border-0 hover:bg-success/30">Aceito</Badge>
                    ) : new Date(invite.expires_at) < new Date() ? (
                      <Badge variant="destructive">Expirado</Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-1">
                        {!invite.accepted_at && (
                          <Button variant="ghost" size="icon" onClick={() => copyLink(invite.token)} title="Copiar link">
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(invite.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
