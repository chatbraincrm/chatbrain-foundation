import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/lib/tenant-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus } from 'lucide-react';
import type { Tenant } from '@/types';

export default function SelectTenant() {
  const { tenants, setCurrentTenant } = useTenant();
  const navigate = useNavigate();

  const handleSelect = (tenant: Tenant) => {
    setCurrentTenant(tenant);
    navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Escolha um Workspace</h1>
          <p className="text-muted-foreground mt-2">Selecione o workspace que deseja acessar</p>
        </div>

        <div className="space-y-3">
          {tenants.map(tenant => (
            <Card
              key={tenant.id}
              className="cursor-pointer transition-colors hover:border-primary"
              onClick={() => handleSelect(tenant)}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{tenant.name}</h3>
                  <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/onboarding')}>
          <Plus className="h-4 w-4 mr-2" />
          Criar Novo Workspace
        </Button>
      </div>
    </div>
  );
}
