import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { getTenantAuditLogs } from '@/modules/audit/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function AuditLog() {
  const { currentTenant } = useTenant();
  const [page, setPage] = useState(0);
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', currentTenant?.id, page],
    queryFn: () => getTenantAuditLogs(currentTenant!.id, page, limit),
    enabled: !!currentTenant,
  });

  const totalPages = Math.ceil((data?.count || 0) / limit);

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Auditoria</h1>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Ator</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!data?.data || data.data.length === 0) ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum registro de auditoria
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell>{log.profiles?.name || log.profiles?.email || 'Sistema'}</TableCell>
                  <TableCell className="font-mono text-sm">{log.action}</TableCell>
                  <TableCell>
                    {log.entity && (
                      <span className="text-muted-foreground">
                        {log.entity}
                        {log.entity_id ? `:${log.entity_id.slice(0, 8)}` : ''}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {log.metadata ? JSON.stringify(log.metadata) : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages} ({data?.count} registros)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
