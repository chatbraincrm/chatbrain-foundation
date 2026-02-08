import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { can } from '@/lib/rbac';
import {
  getConnectionByTenant,
  upsertEvolutionConnection,
} from '@/modules/whatsapp/whatsapp-api';
import { upsertEvolutionConnectionSchema } from '@/modules/whatsapp/whatsapp-validators';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Copy, Key } from 'lucide-react';

const WEBHOOK_SERVER_PORT = 3001;

function generateWebhookSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function WhatsAppSettings() {
  const { currentTenant, membership } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canView = can(membership?.role, 'view_whatsapp_settings');
  const canManage = can(membership?.role, 'manage_whatsapp_settings');

  const [form, setForm] = useState({
    name: 'WhatsApp Principal',
    is_active: false,
    base_url: '',
    api_key: '',
    phone_number: '',
    instance_name: '',
    webhook_secret: '',
  });

  useEffect(() => {
    if (currentTenant && !canView) {
      toast({
        title: 'Sem permissão',
        description: 'Você não tem acesso às configurações do WhatsApp.',
        variant: 'destructive',
      });
      navigate('/dashboard', { replace: true });
    }
  }, [currentTenant, canView, navigate, toast]);

  const { data: connection, isLoading } = useQuery({
    queryKey: ['whatsapp-connection', currentTenant?.id],
    queryFn: () => getConnectionByTenant(currentTenant!.id),
    enabled: !!currentTenant && canView,
  });

  useEffect(() => {
    if (connection) {
      setForm((f) => ({
        ...f,
        name: connection.name ?? 'WhatsApp Principal',
        is_active: connection.is_active ?? false,
        base_url: connection.base_url ?? '',
        api_key: '', // never prefill; use placeholder
        phone_number: connection.phone_number ?? '',
        instance_name: connection.instance_name ?? '',
        webhook_secret: connection.webhook_secret ?? '',
      }));
    }
  }, [connection?.id, connection?.name, connection?.is_active, connection?.base_url, connection?.phone_number, connection?.instance_name, connection?.webhook_secret]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = upsertEvolutionConnectionSchema.safeParse({
        name: form.name,
        is_active: form.is_active,
        base_url: form.base_url,
        api_key: form.api_key || undefined,
        phone_number: form.phone_number || null,
        instance_name: form.instance_name,
        webhook_secret: form.webhook_secret || null,
      });
      if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Dados inválidos');
      return upsertEvolutionConnection(
        currentTenant!.id,
        parsed.data,
        form.api_key.trim() ? undefined : (connection?.api_key ?? undefined)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connection', currentTenant?.id] });
      toast({ title: 'Configurações salvas' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    },
  });

  const getWebhookUrl = () => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const base = origin.includes('localhost') ? `http://localhost:${WEBHOOK_SERVER_PORT}` : origin;
      return `${base}/api/webhooks/evolution`;
    }
    return `https://seu-dominio.com/api/webhooks/evolution`;
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(getWebhookUrl());
    toast({ title: 'URL copiada', description: 'Cole no painel Evolution como URL do webhook.' });
  };

  if (!currentTenant) return null;
  if (!canView) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">WhatsApp</h1>
      <Card>
        <CardHeader>
          <CardTitle>Evolution API</CardTitle>
          <CardDescription>
            Uma conexão por tenant. Configure a Evolution API e informe a URL base, a chave da API e o nome da instância. Use o webhook abaixo no painel Evolution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Status</p>
                    <p className="text-sm text-muted-foreground">
                      {connection ? (connection.is_active ? 'Ativo' : 'Inativo') : 'Não configurado'}
                    </p>
                  </div>
                  {connection && (
                    <Badge variant={connection.is_active ? 'default' : 'secondary'}>
                      {connection.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  )}
                </div>
              </div>

              {canManage && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="WhatsApp Principal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL base (Evolution API)</Label>
                    <Input
                      value={form.base_url}
                      onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                      placeholder="https://sua-evolution.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Chave da API (api_key)</Label>
                    <Input
                      type="password"
                      value={form.api_key}
                      onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                      placeholder={connection?.api_key ? '•••••••• (deixe em branco para manter)' : 'Cole a chave da Evolution'}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome da instância (instance_name)</Label>
                    <Input
                      value={form.instance_name}
                      onChange={(e) => setForm((f) => ({ ...f, instance_name: e.target.value }))}
                      placeholder="minha-instancia"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número (telefone) – opcional</Label>
                    <Input
                      value={form.phone_number}
                      onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
                      placeholder="5511999999999"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Ativo</Label>
                      <Switch
                        checked={form.is_active}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Webhook secret</Label>
                    <div className="flex gap-2">
                      <Input
                        value={form.webhook_secret}
                        onChange={(e) => setForm((f) => ({ ...f, webhook_secret: e.target.value }))}
                        placeholder="Gere um token e configure no header x-webhook-secret"
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const secret = generateWebhookSecret();
                          setForm((f) => ({ ...f, webhook_secret: secret }));
                          toast({ title: 'Token gerado. Clique em Salvar para persistir.' });
                        }}
                        title="Gerar token"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>URL do webhook (cole na Evolution)</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={getWebhookUrl()} className="font-mono text-sm" />
                      <Button variant="outline" size="icon" onClick={copyWebhookUrl} title="Copiar URL">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      No painel Evolution: Webhook → URL = esta URL; header <code className="bg-muted px-1 rounded">x-webhook-secret</code> = o token acima. Eventos: MESSAGES_UPSERT.
                    </p>
                  </div>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.instance_name.trim()}>
                    {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              )}

              {!canManage && connection && (
                <div className="text-sm text-muted-foreground">
                  <p>Instance: {connection.instance_name}</p>
                  {connection.phone_number && <p>Número: {connection.phone_number}</p>}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
