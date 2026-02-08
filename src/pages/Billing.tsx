import { useUsage } from '@/hooks/use-usage';
import { PLAN_NAME, PLAN_PRICE_MONTHLY } from '@/config/plan-limits';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function Billing() {
  const { usage, limits, isLoading } = useUsage();

  const threadsPct = usage && limits.threads > 0
    ? Math.min(100, (usage.threads_count / limits.threads) * 100)
    : 0;
  const messagesPct = usage && limits.messages_per_month > 0
    ? Math.min(100, (usage.messages_count / limits.messages_per_month) * 100)
    : 0;
  const aiPct = usage && limits.ai_responses_per_month > 0
    ? Math.min(100, (usage.ai_messages_count / limits.ai_responses_per_month) * 100)
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Plano e Uso</h1>

      <Card>
        <CardHeader>
          <CardTitle>Plano atual</CardTitle>
          <CardDescription>Resumo do seu plano e uso no mês</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-lg font-medium">{PLAN_NAME}</p>
            <p className="text-muted-foreground text-sm">
              R$ {PLAN_PRICE_MONTHLY}/mês
            </p>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando uso...</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Conversas</span>
                  <span>
                    {usage?.threads_count ?? 0} / {limits.threads}
                  </span>
                </div>
                <Progress value={threadsPct} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Mensagens</span>
                  <span>
                    {usage?.messages_count ?? 0} / {limits.messages_per_month}
                  </span>
                </div>
                <Progress value={messagesPct} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Respostas do agente</span>
                  <span>
                    {usage?.ai_messages_count ?? 0} / {limits.ai_responses_per_month}
                  </span>
                </div>
                <Progress value={aiPct} className="h-2" />
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground border-t border-border pt-4">
            Para alterar seu plano ou limites, fale com nosso time no WhatsApp.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
