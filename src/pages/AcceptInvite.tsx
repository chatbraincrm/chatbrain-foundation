import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useTenant } from '@/lib/tenant-context';
import { acceptInvite } from '@/modules/invites/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const { refreshTenants } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleAccept = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await acceptInvite(token);
      setAccepted(true);
      await refreshTenants();
      toast({ title: 'Convite aceito com sucesso!' });
      setTimeout(() => navigate('/select-tenant'), 2000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ title: 'Erro ao aceitar convite', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Aceitar Convite</CardTitle>
            <CardDescription>Você precisa estar logado para aceitar o convite.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild>
              <Link to={`/login?redirect=/invite/${token}`}>Entrar</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/signup?redirect=/invite/${token}`}>Criar Conta</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{accepted ? 'Convite Aceito!' : 'Aceitar Convite'}</CardTitle>
          <CardDescription>
            {accepted
              ? 'Você foi adicionado ao workspace. Redirecionando...'
              : 'Clique abaixo para aceitar o convite e entrar no workspace.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!accepted && (
            <Button onClick={handleAccept} disabled={loading} className="w-full">
              {loading ? 'Aceitando...' : 'Aceitar Convite'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
