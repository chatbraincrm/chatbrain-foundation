import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createKnowledge, updateKnowledge } from '@/modules/ai-agent/ai-agent-api';
import { aiAgentKnowledgeSchema, type AiAgentKnowledgeFormData } from '@/modules/ai-agent/ai-agent-validators';
import { AI_AGENT_SOURCE_TYPES } from '@/modules/ai-agent/ai-agent-types';
import type { AiAgentKnowledgeItem } from '@/modules/ai-agent/ai-agent-types';
import { useToast } from '@/hooks/use-toast';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  link: 'Link',
  file: 'Arquivo',
};

interface AiAgentKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  agentId: string;
  mode: 'create' | 'edit';
  initialData?: AiAgentKnowledgeItem | null;
  onSuccess: () => void;
}

export function AiAgentKnowledgeDialog({
  open,
  onOpenChange,
  tenantId,
  agentId,
  mode,
  initialData,
  onSuccess,
}: AiAgentKnowledgeDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState<'text' | 'link' | 'file'>('text');
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [filePath, setFilePath] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialData) {
        setTitle(initialData.title);
        setSourceType(initialData.source_type);
        setContent(initialData.content ?? '');
        setSourceUrl(initialData.source_url ?? '');
        setFilePath(initialData.file_path ?? '');
      } else {
        setTitle('');
        setSourceType('text');
        setContent('');
        setSourceUrl('');
        setFilePath('');
      }
    }
  }, [open, mode, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: title.trim(),
      source_type: sourceType,
      content: sourceType === 'text' ? content.trim() || null : null,
      source_url: sourceType === 'link' ? (sourceUrl.trim() || null) : null,
      file_path: sourceType === 'file' ? (filePath.trim() || null) : null,
    };
    const result = aiAgentKnowledgeSchema.safeParse(payload);
    if (!result.success) {
      toast({ title: 'Erro', description: result.error.errors[0].message, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (mode === 'create') {
        await createKnowledge(tenantId, agentId, result.data);
        toast({ title: 'Conhecimento adicionado' });
      } else if (initialData) {
        await updateKnowledge(tenantId, agentId, initialData.id, result.data);
        toast({ title: 'Conhecimento atualizado' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao salvar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Adicionar Conhecimento' : 'Editar Conhecimento'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: FAQ Produto X"
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo de fonte</Label>
            <Select value={sourceType} onValueChange={(v) => setSourceType(v as 'text' | 'link' | 'file')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_AGENT_SOURCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {SOURCE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {sourceType === 'text' && (
            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="resize-y"
                placeholder="Cole ou digite o texto aqui."
              />
            </div>
          )}
          {sourceType === 'link' && (
            <div className="space-y-2">
              <Label htmlFor="source_url">URL</Label>
              <Input
                id="source_url"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}
          {sourceType === 'file' && (
            <div className="space-y-2">
              <Label htmlFor="file_path">Caminho do arquivo</Label>
              <Input
                id="file_path"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="Cole o caminho do arquivo (ex: /uploads/doc.pdf)"
              />
              <p className="text-xs text-muted-foreground">
                Nesta etapa, informe apenas o caminho do arquivo. O upload será implementado em versão futura.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : mode === 'create' ? 'Adicionar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
