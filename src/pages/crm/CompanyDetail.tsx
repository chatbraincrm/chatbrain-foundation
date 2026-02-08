import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { getCompany } from '@/modules/crm/companies-api';
import { getEntityTimeline } from '@/modules/crm/timeline-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Globe } from 'lucide-react';
import { format } from 'date-fns';

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => getCompany(id!),
    enabled: !!id,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', 'company', id],
    queryFn: () => getEntityTimeline(currentTenant!.id, 'company', id!),
    enabled: !!id && !!currentTenant,
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!company) return <div className="text-muted-foreground">Empresa não encontrada</div>;

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate('/crm/companies')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />Voltar
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{company.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {company.website && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{company.website}</a>
                </div>
              )}
              <div className="text-muted-foreground">Criada em {format(new Date(company.created_at), 'dd/MM/yyyy')}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade</p>
            ) : (
              <div className="space-y-3">
                {timeline.map(entry => (
                  <div key={entry.id} className="border-l-2 border-border pl-3 py-1">
                    <p className="text-sm font-medium">{entry.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.profiles?.name || 'Sistema'} · {format(new Date(entry.created_at), 'dd/MM HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
