import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listKnowledge, deleteKnowledge } from '@/modules/ai-agent/ai-agent-api';
import type { AiAgentKnowledgeItem } from '@/modules/ai-agent/ai-agent-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { AiAgentKnowledgeDialog } from './AiAgentKnowledgeDialog';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  link: 'Link',
  file: 'Arquivo',
};

interface AiAgentKnowledgeListProps {
  tenantId: string;
  agentId?: string;
  canManage: boolean;
}

export function AiAgentKnowledgeList({ tenantId, agentId, canManage }: AiAgentKnowledgeListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<AiAgentKnowledgeItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<AiAgentKnowledgeItem | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['ai-agent-knowledge', tenantId, agentId, debouncedSearch],
    queryFn: () => listKnowledge(tenantId!, agentId!, debouncedSearch || undefined),
    enabled: !!tenantId && !!agentId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKnowledge(tenantId, agentId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-knowledge', tenantId, agentId] });
      toast({ title: 'Conhecimento excluído' });
      setDeleteItem(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleOpenCreate = () => {
    setEditItem(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: AiAgentKnowledgeItem) => {
    setEditItem(item);
    setDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['ai-agent-knowledge', tenantId, agentId] });
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditItem(null);
  };

  if (!agentId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Crie um agente na aba Geral para gerenciar a base de conhecimento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Base de Conhecimento</CardTitle>
          <CardDescription>Itens usados para enriquecer as respostas do agente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Input
              placeholder="Buscar por título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            {canManage && (
              <Button onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Conhecimento
              </Button>
            )}
          </div>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              Nenhum item cadastrado. {canManage && 'Clique em Adicionar Conhecimento para começar.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  {canManage && <TableHead className="w-[100px]">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{SOURCE_TYPE_LABELS[item.source_type] ?? item.source_type}</TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(item)}
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteItem(item)}
                            aria-label="Excluir"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AiAgentKnowledgeDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        tenantId={tenantId}
        agentId={agentId}
        mode={editItem ? 'edit' : 'create'}
        initialData={editItem ?? undefined}
        onSuccess={handleDialogSuccess}
      />

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conhecimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá &quot;{deleteItem?.title}&quot; da base. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
