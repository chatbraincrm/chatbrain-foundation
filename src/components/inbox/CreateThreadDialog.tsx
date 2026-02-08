import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { createThread } from '@/modules/inbox/threads-api';
import { createAuditLog } from '@/modules/audit/api';
import { logActivityEvent } from '@/modules/crm/timeline-api';
import { createThreadSchema } from '@/lib/validators';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import type { Channel } from '@/types';
import { getTenantLeads } from '@/modules/crm/leads-api';
import { getTenantDeals } from '@/modules/crm/deals-api';
import { getTenantCompanies } from '@/modules/crm/companies-api';

interface CreateThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: Channel[];
}

export default function CreateThreadDialog({
  open,
  onOpenChange,
  channels,
}: CreateThreadDialogProps) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [channelId, setChannelId] = useState('');
  const [subject, setSubject] = useState('');
  const [relatedEntity, setRelatedEntity] = useState<string>('none');
  const [relatedEntityId, setRelatedEntityId] = useState('');

  // Load entities for relationship
  const { data: leads = [] } = useQuery({
    queryKey: ['leads', currentTenant?.id],
    queryFn: () => getTenantLeads(currentTenant!.id),
    enabled: !!currentTenant && relatedEntity === 'lead',
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals', currentTenant?.id],
    queryFn: () => getTenantDeals(currentTenant!.id),
    enabled: !!currentTenant && relatedEntity === 'deal',
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', currentTenant?.id],
    queryFn: () => getTenantCompanies(currentTenant!.id),
    enabled: !!currentTenant && relatedEntity === 'company',
  });

  const entityOptions = relatedEntity === 'lead'
    ? leads.map(l => ({ id: l.id, label: l.name }))
    : relatedEntity === 'deal'
    ? deals.map(d => ({ id: d.id, label: d.title }))
    : relatedEntity === 'company'
    ? companies.map(c => ({ id: c.id, label: c.name }))
    : [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const input = {
        channel_id: channelId || (channels.length === 1 ? channels[0].id : ''),
        subject: subject.trim() || null,
        related_entity: relatedEntity !== 'none' ? relatedEntity : null,
        related_entity_id: relatedEntity !== 'none' && relatedEntityId ? relatedEntityId : null,
      };
      createThreadSchema.parse(input);
      const thread = await createThread(currentTenant!.id, {
        channel_id: input.channel_id,
        subject: input.subject,
        related_entity: input.related_entity,
        related_entity_id: input.related_entity_id,
      });

      // Audit + timeline
      await createAuditLog(
        currentTenant!.id,
        'thread.created',
        'thread',
        thread.id,
        { subject: thread.subject, channel_id: thread.channel_id }
      );
      await logActivityEvent(
        currentTenant!.id,
        'thread',
        thread.id,
        'thread.created',
        { subject: thread.subject }
      );

      return thread;
    },
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      resetForm();
      onOpenChange(false);
      toast({ title: 'Conversa criada' });
      navigate(`/inbox/${thread.id}`);
    },
    onError: (e: Error) =>
      toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const resetForm = () => {
    setChannelId('');
    setSubject('');
    setRelatedEntity('none');
    setRelatedEntityId('');
  };

  // Auto-select first channel
  const effectiveChannelId = channelId || (channels.length === 1 ? channels[0].id : '');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
          <DialogDescription>
            Crie uma nova conversa para iniciar uma discussão.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (effectiveChannelId) {
              if (!channelId && channels.length === 1) setChannelId(channels[0].id);
              createMutation.mutate();
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Canal</label>
            <Select
              value={effectiveChannelId}
              onValueChange={setChannelId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o canal" />
              </SelectTrigger>
              <SelectContent>
                {channels.filter(c => c.is_active).map(ch => (
                  <SelectItem key={ch.id} value={ch.id}>
                    {ch.name} ({ch.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Assunto</label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Opcional"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Relacionar com</label>
            <Select value={relatedEntity} onValueChange={(v) => { setRelatedEntity(v); setRelatedEntityId(''); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="deal">Negócio</SelectItem>
                <SelectItem value="company">Empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {relatedEntity !== 'none' && entityOptions.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {relatedEntity === 'lead' ? 'Lead' : relatedEntity === 'deal' ? 'Negócio' : 'Empresa'}
              </label>
              <Select value={relatedEntityId} onValueChange={setRelatedEntityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {entityOptions.map(opt => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!effectiveChannelId || createMutation.isPending}
            >
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
