import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { can } from '@/lib/rbac';
import { getTenantCompanies, createCompany, deleteCompany } from '@/modules/crm/companies-api';
import { createCompanySchema } from '@/lib/validators';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Companies() {
  const { currentTenant, membership } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = can(membership?.role, 'crm:write');
  const canDelete = can(membership?.role, 'crm:delete');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', website: '' });

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies', currentTenant?.id],
    queryFn: () => getTenantCompanies(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = createCompanySchema.safeParse({ ...form, website: form.website || null });
      if (!parsed.success) throw new Error(parsed.error.errors[0].message);
      return createCompany(currentTenant!.id, { name: parsed.data.name, website: parsed.data.website ?? null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setForm({ name: '', website: '' });
      setShowCreate(false);
      toast({ title: 'Empresa criada' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Empresa removida' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
        {canWrite && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Empresa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Empresa</DialogTitle>
              </DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://exemplo.com" />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Criando...' : 'Criar Empresa'}
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
              <TableHead>Nome</TableHead>
              <TableHead>Website</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhuma empresa encontrada</TableCell>
              </TableRow>
            ) : (
              companies.map(company => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.website ? <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{company.website}</a> : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/crm/companies/${company.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(company.id)}>
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
