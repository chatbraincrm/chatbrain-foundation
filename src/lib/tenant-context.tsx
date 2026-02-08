import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './auth-context';
import type { Tenant, Membership, AppRole } from '@/types';

interface TenantContextType {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  membership: Membership | null;
  loading: boolean;
  setCurrentTenant: (tenant: Tenant) => void;
  refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMembership = useCallback(async (tenantId: string, userId: string) => {
    const { data } = await supabase
      .from('memberships')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle();
    setMembership(data ? { ...data, role: data.role as AppRole } as Membership : null);
  }, []);

  const persistActiveTenant = useCallback(async (tenantId: string) => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ active_tenant_id: tenantId } as never)
      .eq('id', user.id);
  }, [user]);

  const fetchTenants = useCallback(async () => {
    // Wait for auth to finish before making decisions
    if (authLoading) return;

    if (!user) {
      setTenants([]);
      setCurrentTenantState(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    const [{ data: tenantData, error }, { data: profileData }] = await Promise.all([
      supabase.from('tenants').select('*'),
      supabase.from('profiles').select('active_tenant_id').eq('id', user.id).maybeSingle(),
    ]);

    if (error) {
      console.error('Failed to fetch tenants:', error);
      setLoading(false);
      return;
    }

    const tenantList = (tenantData || []) as unknown as Tenant[];
    setTenants(tenantList);

    const savedTenantId = (profileData as any)?.active_tenant_id || localStorage.getItem('chatbrain_active_tenant_id');
    const savedTenant = tenantList.find(t => t.id === savedTenantId);

    if (savedTenant) {
      setCurrentTenantState(savedTenant);
      await fetchMembership(savedTenant.id, user.id);
    } else if (tenantList.length === 1) {
      setCurrentTenantState(tenantList[0]);
      persistActiveTenant(tenantList[0].id);
      await fetchMembership(tenantList[0].id, user.id);
    }

    setLoading(false);
  }, [user, authLoading, fetchMembership, persistActiveTenant]);

  const setCurrentTenant = useCallback((tenant: Tenant) => {
    setCurrentTenantState(tenant);
    persistActiveTenant(tenant.id);
    // Fallback for localStorage during transition
    localStorage.setItem('chatbrain_active_tenant_id', tenant.id);
    if (user) {
      fetchMembership(tenant.id, user.id);
    }
  }, [user, fetchMembership, persistActiveTenant]);

  const refreshTenants = useCallback(async () => {
    await fetchTenants();
  }, [fetchTenants]);

  useEffect(() => {
    // Reset loading when user changes to prevent premature redirects
    setLoading(true);
    fetchTenants();
  }, [fetchTenants]);

  return (
    <TenantContext.Provider value={{ currentTenant, tenants, membership, loading, setCurrentTenant, refreshTenants }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within TenantProvider');
  return context;
}
