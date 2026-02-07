import { useTenant } from '@/lib/tenant-context';
import { useQuery } from '@tanstack/react-query';
import { getTenantMemberships } from '@/modules/memberships/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Activity, Shield } from 'lucide-react';

export default function Dashboard() {
  const { currentTenant, membership } = useTenant();

  const { data: members } = useQuery({
    queryKey: ['memberships', currentTenant?.id],
    queryFn: () => getTenantMemberships(currentTenant!.id),
    enabled: !!currentTenant,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Membros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{members?.length ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Workspace</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{currentTenant?.name}</div>
            <p className="text-sm text-muted-foreground">{currentTenant?.slug}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Seu Papel</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold capitalize">{membership?.role ?? '-'}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
