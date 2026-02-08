import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseUrl, supabaseProjectRef } from '@/lib/env';
import { useAuth } from '@/lib/auth-context';
import { useTenant } from '@/lib/tenant-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface ConnectionResult {
  ok: boolean;
  tenantCount: number | null;
  error: string | null;
}

export default function DebugSupabase() {
  const { user } = useAuth();
  const { membership } = useTenant();
  const [result, setResult] = useState<ConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);

  const isAdmin = membership?.role === 'admin';

  const runTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.from('tenants').select('id');
      if (error) {
        setResult({ ok: false, tenantCount: null, error: error.message });
      } else {
        setResult({ ok: true, tenantCount: data?.length ?? 0, error: null });
      }
    } catch (err) {
      setResult({
        ok: false,
        tenantCount: null,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Faça login para acessar esta página.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Apenas administradores podem acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Debug Supabase
            <Button variant="outline" size="icon" onClick={runTest} disabled={testing}>
              <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">URL</p>
            <code className="block rounded bg-muted px-3 py-2 text-sm break-all">
              {supabaseUrl}
            </code>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Project Ref</p>
            <code className="block rounded bg-muted px-3 py-2 text-sm">
              {supabaseProjectRef}
            </code>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Conexão</p>
            {result === null ? (
              <Badge variant="outline">Testando...</Badge>
            ) : result.ok ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-green-600 hover:bg-green-700">Conectado ✓</Badge>
                <span className="text-sm text-muted-foreground">
                  {result.tenantCount} tenant(s) encontrado(s)
                </span>
              </div>
            ) : (
              <div>
                <Badge variant="destructive">Erro</Badge>
                <p className="mt-1 text-sm text-destructive">{result.error}</p>
              </div>
            )}
          </div>

          {result?.ok && result.tenantCount === 0 && (
            <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
              ⚠️ Banco conectado mas nenhum tenant encontrado. As tabelas podem estar vazias.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
