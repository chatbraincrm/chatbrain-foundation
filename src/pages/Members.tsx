import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { can } from '@/lib/rbac';
import { getTenantMemberships, updateMembershipRole, deleteMembership } from '@/modules/memberships/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

export default function Members() {
  const { currentTenant, membership } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = can(membership?.role, 'members:write');

  const { data: members, isLoading } = useQuery({
    queryKey: ['memberships', currentTenant?.id],
    queryFn: () => getTenantMemberships(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => updateMembershipRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      toast({ title: 'Papel atualizado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMembership,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      toast({ title: 'Membro removido' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Membros</h1>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Papel</TableHead>
              {canManage && <TableHead className="w-[80px]">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!members || members.length === 0) ? (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 3} className="text-center text-muted-foreground py-8">
                  Nenhum membro encontrado
                </TableCell>
              </TableRow>
            ) : (
              members.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>{m.profiles?.name || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{m.profiles?.email}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <Select
                        value={m.role}
                        onValueChange={(role) => updateRoleMutation.mutate({ id: m.id, role })}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="agent">Agent</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(m.id)}
                        className="text-destructive hover:text-destructive"
                      >
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
