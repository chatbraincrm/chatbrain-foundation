# CHATBRAIN

SaaS multi-tenant com React SPA + Vite + Lovable Cloud.

## Stack

- **Frontend**: React 18 · Vite · TypeScript · Tailwind CSS · shadcn/ui
- **Backend**: Lovable Cloud (Supabase) — Auth, Database (RLS), Edge Functions
- **ORM**: Drizzle ORM (schema-first, migrations via Drizzle Kit)
- **Validação**: Zod
- **State**: React Context (Auth, Tenant) + TanStack Query

## Estrutura do Projeto

```
src/
├── db/schema/          # Drizzle schema (source of truth)
│   ├── enums.ts
│   ├── profiles.ts
│   ├── tenants.ts
│   ├── memberships.ts
│   ├── invites.ts
│   ├── audit-logs.ts
│   ├── pipelines.ts
│   ├── pipeline-stages.ts
│   ├── companies.ts
│   ├── leads.ts
│   ├── deals.ts
│   ├── tasks.ts
│   ├── activity-timeline.ts
│   ├── tags.ts
│   ├── entity-tags.ts
│   ├── channels.ts
│   ├── threads.ts
│   ├── thread-participants.ts
│   ├── messages.ts
│   ├── thread-reads.ts
│   └── index.ts
├── lib/                # Infraestrutura (auth, tenant, rbac, validators)
├── modules/            # Camada de dados (API/repository por domínio)
│   ├── audit/
│   ├── invites/
│   ├── memberships/
│   ├── tenants/
│   ├── crm/
│   └── inbox/
│       ├── channels-api.ts
│       ├── threads-api.ts
│       ├── messages-api.ts
│       ├── participants-api.ts
│       └── unread-api.ts
├── hooks/              # React hooks
│   └── use-unread-counts.ts
├── components/         # Componentes de UI
├── pages/              # Rotas/telas
└── types/              # Tipos compartilhados
```

## Drizzle ORM

O schema Drizzle em `src/db/schema/` é o **source of truth** para a estrutura do banco de dados.

### Comandos de Migration

```bash
npx drizzle-kit generate    # Gerar migrations
npx drizzle-kit migrate     # Aplicar migrations
npx drizzle-kit push        # Visualizar diff
npx drizzle-kit studio      # Inspecionar o banco
```

### Fluxo de trabalho

1. Altere o schema TypeScript em `src/db/schema/`
2. Execute `npx drizzle-kit generate` para gerar a migration SQL
3. Revise a migration gerada em `drizzle/`
4. Execute `npx drizzle-kit migrate` para aplicar

---

## Seed de Desenvolvimento

Script de seed para popular o banco com dados demo em ambiente de desenvolvimento.

### O que o seed cria

| Recurso | Detalhes |
|---------|---------|
| **Usuário demo** | `demo@chatbrain.dev` / `Demo12345!` (admin) |
| **Tenant** | `Tenant Demo` (slug: `demo`) |
| **Pipeline padrão** | 5 estágios: Novo → Contato feito → Proposta → Negociação → Fechado |
| **Canal Interno** | Tipo `internal` |
| **Lead demo** | Maria Silva |
| **Thread demo** | Vinculada à lead |
| **Mensagem demo** | Mensagem de boas-vindas do sistema |

### Características

- **Idempotente**: rodar múltiplas vezes não duplica dados
- **Usa RPC**: tenant criado via `create_tenant_with_admin` (evita duplicação de pipeline/canal)
- **Guarda de produção**: aborta se `NODE_ENV=production`
- **Usuário automático**: cria auth user + profile + membership admin automaticamente

### Como rodar

```bash
# Opção 1: Variáveis inline
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxx \
SUPABASE_PUBLISHABLE_KEY=xxx \
npx tsx scripts/seed-dev.ts

# Opção 2: Via shell script (carrega .env.local automaticamente)
chmod +x scripts/seed-dev.sh
./scripts/seed-dev.sh
```

### Variáveis de ambiente necessárias

| Variável | Alternativa | Obrigatória |
|----------|-------------|-------------|
| `SUPABASE_URL` | `VITE_SUPABASE_URL` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | — | ✅ |
| `SUPABASE_PUBLISHABLE_KEY` | `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ |

> ⚠️ O script usa a **service role key** e deve ser usado **somente em desenvolvimento**.

### Após o seed

Faça login com `demo@chatbrain.dev` / `Demo12345!` — o sistema estará totalmente funcional com CRM e Inbox populados.

---

## Segurança

- **RLS** habilitado em todas as tabelas com políticas por tenant
- **RBAC** com papéis: `admin`, `manager`, `agent`
  - `admin`: acesso total
  - `manager`: leitura de membros/convites/audit + CRM completo + Inbox completo
  - `agent`: CRM (leitura + escrita própria, sem delete) + Inbox (leitura + envio de mensagens)
- **RPCs SECURITY DEFINER** para operações sensíveis:
  - `create_tenant_with_admin` — cria tenant + membership admin + pipeline padrão + canal interno atomicamente
  - `accept_invite` — aceita convite com validação de token/expiração
  - `create_invite` — cria convite com validação, geração de token e audit log
  - `log_audit_event` — registra evento de auditoria
  - `log_activity_event` — registra evento na timeline de atividades
  - `log_message_event` — registra evento de mensagem na timeline
  - `mark_thread_read` — marca thread como lida (upsert em `thread_reads`)
  - `get_unread_counts` — retorna contagem de não lidas por thread
- Writes em `invites`, `audit_logs` e `activity_timeline` passam exclusivamente por RPCs

---

## CRM

### Tabelas

- `pipelines` — Pipelines de vendas com nome e flag de padrão
- `pipeline_stages` — Etapas de pipeline com posição e cor
- `companies` — Empresas/organizações
- `leads` — Leads com status (open/qualified/converted/lost)
- `deals` — Negócios vinculados a pipeline/stage com valor e responsável
- `tasks` — Tarefas vinculadas a deals/leads/companies
- `activity_timeline` — Linha do tempo de atividades por entidade
- `tags` — Tags por tenant
- `entity_tags` — Associação polimórfica tag-entidade

### RLS CRM

- **SELECT**: qualquer membro do tenant
- **INSERT/UPDATE**: admin e manager podem tudo; agent pode criar/editar registros próprios
- **DELETE**: somente admin e manager

### Pipeline Padrão

Criado automaticamente pela RPC `create_tenant_with_admin` com 5 etapas:
Novo → Contato feito → Proposta → Negociação → Fechado

---

## Inbox

### Arquitetura

Módulo centralizado de conversas, extensível a múltiplos canais (WhatsApp, Email, Instagram) sem refatoração.

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `channels` | Canais de comunicação (internal, whatsapp, email, instagram). Constraint `UNIQUE(tenant_id, type, name)` |
| `threads` | Conversas com status, responsável e vínculo CRM. `last_message_at` para ordenação |
| `thread_participants` | Participantes internos. Constraint `UNIQUE(thread_id, user_id)` |
| `messages` | Mensagens com `sender_type` (user/system/external). Realtime habilitado |
| `thread_reads` | Rastreio de última leitura **por usuário por thread**. Constraint `UNIQUE(thread_id, user_id)` |

### Mensagens Não Lidas

A estratégia de leitura é **por usuário**, usando a tabela `thread_reads` como fonte de verdade.

#### RPCs

| RPC | Descrição |
|-----|-----------|
| `get_unread_counts(_tenant_id)` | Retorna `(thread_id, unread_count)` para o usuário autenticado. Conta mensagens com `created_at > last_read_at` excluindo mensagens do próprio usuário |
| `mark_thread_read(_tenant_id, _thread_id)` | Faz upsert em `thread_reads` com `last_read_at = now()` |

#### Comportamento na UI

- **Sidebar**: badge com total de não lidas no link "Conversas"
- **Lista de threads**: badge individual por thread + destaque visual (negrito + fundo sutil)
- **Auto-mark**: ao abrir thread e ao receber mensagens via Realtime enquanto visualiza
- **Realtime**: `use-unread-counts` hook invalida contagens ao detectar novas mensagens + polling 30s como fallback

### RLS Inbox

- **channels**: SELECT para membros; INSERT/UPDATE/DELETE apenas admin
- **threads**: SELECT para membros; INSERT admin+manager+agent; UPDATE admin+manager (agent limitado); DELETE admin+manager
- **messages**: SELECT para membros; INSERT para membros; UPDATE/DELETE admin+manager
- **thread_participants**: SELECT para membros; INSERT/DELETE admin+manager
- **thread_reads**: SELECT/INSERT/UPDATE somente para o próprio usuário (membro do tenant)

### Eventos de Auditoria e Timeline

- `thread.created` — ao criar conversa
- `message.sent` — ao enviar mensagem (via RPC `log_message_event`)
- `thread.assigned` — ao atribuir responsável
- `thread.closed` — ao fechar conversa
- `thread.reopened` — ao reabrir conversa

### Validações Zod

- `createThreadSchema`: `channel_id` (uuid), `subject` (max 200), `related_entity` (enum), `related_entity_id` (uuid)
- `sendMessageSchema`: `content` (string, min 1, max 5000, trimmed)

### Extensibilidade

Para adicionar um novo canal (ex: WhatsApp):
1. Criar registro em `channels` com `type = 'whatsapp'`
2. Implementar integração via Edge Function com `sender_type = 'external'`
3. Nenhuma alteração de schema necessária

---

## Auditoria

Operações que geram registros:
`deal.created`, `deal.stage_changed`, `lead.created`, `task.created`, `task.completed`,
`tag.created`, `thread.created`, `thread.assigned`, `thread.closed`, `thread.reopened`, `message.sent`

## Tenant Ativo

Persistência via `profiles.active_tenant_id` (com fallback temporário para localStorage).
