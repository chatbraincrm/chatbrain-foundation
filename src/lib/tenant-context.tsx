import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

const TENANT_STORAGE_KEY = 'chatbrain_active_tenant_id';

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
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

  const fetchTenants = useCallback(async () => {
    if (!user) {
      setTenants([]);
      setCurrentTenantState(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from('tenants').select('*');
    if (error) {
      console.error('Failed to fetch tenants:', error);
      setLoading(false);
      return;
    }

    const tenantList = (data || []) as unknown as Tenant[];
    setTenants(tenantList);

    const savedTenantId = localStorage.getItem(TENANT_STORAGE_KEY);
    const savedTenant = tenantList.find(t => t.id === savedTenantId);

    if (savedTenant) {
      setCurrentTenantState(savedTenant);
      await fetchMembership(savedTenant.id, user.id);
    } else if (tenantList.length === 1) {
      setCurrentTenantState(tenantList[0]);
      localStorage.setItem(TENANT_STORAGE_KEY, tenantList[0].id);
      await fetchMembership(tenantList[0].id, user.id);
    }

    setLoading(false);
  }, [user, fetchMembership]);

  const setCurrentTenant = useCallback((tenant: Tenant) => {
    setCurrentTenantState(tenant);
    localStorage.setItem(TENANT_STORAGE_KEY, tenant.id);
    if (user) {
      fetchMembership(tenant.id, user.id);
    }
  }, [user, fetchMembership]);

  const refreshTenants = useCallback(async () => {
    await fetchTenants();
  }, [fetchTenants]);

  useEffect(() => {
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
