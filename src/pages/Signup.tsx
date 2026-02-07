import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { signupSchema } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { signUp } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const redirect = new URLSearchParams(location.search).get('redirect') || '';
  const redirectParam = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = signupSchema.safeParse({ email, password, name });
    if (!result.success) {
      toast({ title: 'Erro', description: result.error.errors[0].message, variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await signUp(result.data.email, result.data.password, result.data.name);
      setSubmitted(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ title: 'Erro ao criar conta', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Verifique seu email</CardTitle>
            <CardDescription>
              Enviamos um link de confirmação para <strong>{email}</strong>. Clique no link para ativar sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to={`/login${redirectParam}`} className="text-primary hover:underline text-sm">
              Voltar ao login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">ChatBrain</CardTitle>
          <CardDescription>Crie sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link to={`/login${redirectParam}`} className="text-primary hover:underline">Entrar</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
