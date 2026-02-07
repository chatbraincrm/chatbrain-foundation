import { Navigate, Outlet } from 'react-router-dom';
import { useTenant } from '@/lib/tenant-context';

export default function TenantGuard() {
  const { currentTenant, tenants, loading } = useTenant();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-lg">Carregando workspace...</div>
      </div>
    );
  }

  if (tenants.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!currentTenant) {
    return <Navigate to="/select-tenant" replace />;
  }

  return <Outlet />;
}
