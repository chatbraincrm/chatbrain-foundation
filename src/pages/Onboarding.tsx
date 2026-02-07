import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTenantWithAdmin, getTenantById } from '@/modules/tenants/api';
import { createTenantSchema } from '@/lib/validators';
import { useTenant } from '@/lib/tenant-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function Onboarding() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const { setCurrentTenant, refreshTenants } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = createTenantSchema.safeParse({ name, slug });
    if (!result.success) {
      toast({ title: 'Erro', description: result.error.errors[0].message, variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { tenant_id } = await createTenantWithAdmin(result.data.name, result.data.slug);
      const tenant = await getTenantById(tenant_id);
      setCurrentTenant(tenant);
      await refreshTenants();
      toast({ title: 'Workspace criado com sucesso!' });
      navigate('/dashboard');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ title: 'Erro ao criar workspace', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Crie seu Workspace</CardTitle>
          <CardDescription>Configure seu workspace para começar a usar o ChatBrain</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Workspace</Label>
              <Input id="name" value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Minha Empresa" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" value={slug} onChange={e => setSlug(e.target.value)} placeholder="minha-empresa" required />
              <p className="text-xs text-muted-foreground">Identificador único. Apenas letras minúsculas, números e hífens.</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Workspace'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
