import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { can } from '@/lib/rbac';
import { getTenantTags, createTag, updateTag, deleteTag } from '@/modules/crm/tags-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Tag as TagIcon } from 'lucide-react';
import type { Tag } from '@/types';

const TAG_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#6366f1', '#a855f7', '#14b8a6', '#64748b',
];

export default function Tags() {
  const { currentTenant, membership } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canWrite = can(membership?.role, 'crm:write');
  const canDelete = can(membership?.role, 'crm:delete');

  const [createOpen, setCreateOpen] = useState(false);
  const [editTag, setEditTag] = useState<Tag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(TAG_COLORS[0]);

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags', currentTenant?.id],
    queryFn: () => getTenantTags(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const createMutation = useMutation({
    mutationFn: () => createTag(currentTenant!.id, formName.trim(), formColor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      resetForm();
      setCreateOpen(false);
      toast({ title: 'Tag criada com sucesso' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateTag(editTag!.id, formName.trim(), formColor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['entity-tags'] });
      resetForm();
      setEditTag(null);
      toast({ title: 'Tag atualizada com sucesso' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTag(deleteTarget!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['entity-tags'] });
      setDeleteTarget(null);
      toast({ title: 'Tag excluída com sucesso' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const resetForm = () => {
    setFormName('');
    setFormColor(TAG_COLORS[0]);
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setFormName(tag.name);
    setFormColor(tag.color || TAG_COLORS[0]);
    setEditTag(tag);
  };

  const isFormDialogOpen = createOpen || !!editTag;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    if (editTag) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const closeFormDialog = () => {
    setCreateOpen(false);
    setEditTag(null);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie as tags do seu workspace para organizar leads e negócios.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Nova Tag
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Carregando...
        </div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <TagIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium">Nenhuma tag criada</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm">
            Tags ajudam a categorizar seus leads e negócios. Crie sua primeira tag para começar.
          </p>
          {canWrite && (
            <Button onClick={openCreate} size="sm" className="mt-4">
              <Plus className="h-4 w-4 mr-1.5" />
              Criar primeira tag
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Criada em</TableHead>
                {(canWrite || canDelete) && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map(tag => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <Badge
                      className="text-xs font-medium text-white border-0"
                      style={{ backgroundColor: tag.color || '#64748b' }}
                    >
                      {tag.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full border border-border"
                        style={{ backgroundColor: tag.color || '#64748b' }}
                      />
                      <span className="text-xs text-muted-foreground font-mono">
                        {tag.color || '#64748b'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(tag.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  {(canWrite || canDelete) && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(tag)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(tag)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isFormDialogOpen} onOpenChange={(v) => !v && closeFormDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTag ? 'Editar Tag' : 'Nova Tag'}</DialogTitle>
            <DialogDescription>
              {editTag
                ? 'Altere o nome ou a cor da tag.'
                : 'Crie uma nova tag para categorizar seus registros.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Ex: Prioridade Alta"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cor</label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormColor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      formColor === color
                        ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Pré-visualização</label>
              <div>
                <Badge
                  className="text-sm font-medium text-white border-0"
                  style={{ backgroundColor: formColor }}
                >
                  {formName || 'Nome da tag'}
                </Badge>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeFormDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  !formName.trim() ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
              >
                {editTag ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Tag</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a tag{' '}
              <Badge
                className="text-xs font-medium text-white border-0 mx-1"
                style={{ backgroundColor: deleteTarget?.color || '#64748b' }}
              >
                {deleteTarget?.name}
              </Badge>
              ? Ela será removida de todos os registros associados. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
