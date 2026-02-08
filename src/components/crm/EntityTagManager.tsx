import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { can } from '@/lib/rbac';
import { getTenantTags, createTag, getEntityTags, addEntityTag, removeEntityTag } from '@/modules/crm/tags-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Tag as TagIcon } from 'lucide-react';
import type { Tag, EntityTag } from '@/types';

const TAG_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#6366f1', '#a855f7', '#14b8a6', '#64748b',
];

interface EntityTagManagerProps {
  entity: 'lead' | 'deal';
  entityId: string;
  compact?: boolean;
}

export default function EntityTagManager({ entity, entityId, compact = false }: EntityTagManagerProps) {
  const { currentTenant, membership } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = can(membership?.role, 'crm:write');
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags', currentTenant?.id],
    queryFn: () => getTenantTags(currentTenant!.id),
    enabled: !!currentTenant,
  });

  const { data: entityTags = [] } = useQuery({
    queryKey: ['entity-tags', entity, entityId],
    queryFn: () => getEntityTags(currentTenant!.id, entity, entityId),
    enabled: !!currentTenant && !!entityId,
  });

  const assignedTagIds = entityTags.map((et: any) => et.tag_id);

  const createTagMutation = useMutation({
    mutationFn: async () => {
      if (!newTagName.trim()) throw new Error('Nome obrigatório');
      const tag = await createTag(currentTenant!.id, newTagName.trim(), newTagColor);
      await addEntityTag(currentTenant!.id, tag.id, entity, entityId);
      return tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['entity-tags', entity, entityId] });
      setNewTagName('');
      toast({ title: 'Tag criada e adicionada' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const addTagMutation = useMutation({
    mutationFn: (tagId: string) => addEntityTag(currentTenant!.id, tagId, entity, entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-tags', entity, entityId] });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const removeTagMutation = useMutation({
    mutationFn: (entityTagId: string) => removeEntityTag(entityTagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-tags', entity, entityId] });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const availableTags = allTags.filter(t => !assignedTagIds.includes(t.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entityTags.map((et: any) => (
        <Badge
          key={et.id}
          className="text-xs font-medium text-white border-0 gap-1 pr-1"
          style={{ backgroundColor: et.tags?.color || '#64748b' }}
        >
          {et.tags?.name}
          {canManage && (
            <button
              onClick={(e) => { e.stopPropagation(); removeTagMutation.mutate(et.id); }}
              className="ml-0.5 rounded-full hover:bg-white/20 p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}

      {canManage && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
              <Plus className="h-3 w-3" />
              {!compact && 'Tag'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              {/* Existing tags to add */}
              {availableTags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Tags existentes</p>
                  <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                    {availableTags.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => addTagMutation.mutate(tag.id)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: tag.color || '#64748b' }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Create new tag */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Nova tag</p>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    placeholder="Nome da tag"
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => createTagMutation.mutate()}
                    disabled={createTagMutation.isPending || !newTagName.trim()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewTagColor(color)}
                      className={`w-5 h-5 rounded-full transition-all ${newTagColor === color ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {entityTags.length === 0 && !canManage && (
        <span className="text-xs text-muted-foreground">Sem tags</span>
      )}
    </div>
  );
}
