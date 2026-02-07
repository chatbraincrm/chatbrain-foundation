import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/tenant-context';
import { updateTenant } from '@/modules/tenants/api';
import { updateTenantSchema } from '@/lib/validators';
import { can } from '@/lib/rbac';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { currentTenant, membership, refreshTenants } = useTenant();
  const { toast } = useToast();
  const [name, setName] = useState(currentTenant?.name || '');
  const [loading, setLoading] = useState(false);
  const canEdit = can(membership?.role, 'tenant:write');

  useEffect(() => {
    setName(currentTenant?.name || '');
  }, [currentTenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant) return;
    const result = updateTenantSchema.safeParse({ name });
    if (!result.success) {
      toast({ title: 'Erro', description: result.error.errors[0].message, variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await updateTenant(currentTenant.id, result.data.name);
      await refreshTenants();
      toast({ title: 'Configurações salvas' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Workspace</CardTitle>
          <CardDescription>Gerencie as configurações básicas do workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={currentTenant?.slug || ''} disabled />
              <p className="text-xs text-muted-foreground">O slug não pode ser alterado</p>
            </div>
            {canEdit && (
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
