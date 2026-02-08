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
│   ├── crm/            # CRM repositories
│   │   ├── pipelines-api.ts
│   │   ├── companies-api.ts
│   │   ├── leads-api.ts
│   │   ├── deals-api.ts
│   │   ├── tasks-api.ts
│   │   ├── tags-api.ts
│   │   └── timeline-api.ts
│   └── inbox/          # Inbox repositories
│       ├── channels-api.ts
│       ├── threads-api.ts
│       ├── messages-api.ts
│       ├── participants-api.ts
│       └── unread-api.ts
├── components/         # Componentes de UI
│   ├── inbox/          # Inbox components
│   │   ├── CreateThreadDialog.tsx
│   │   └── ThreadLastMessage.tsx
│   └── ...
├── pages/              # Rotas/telas
│   ├── crm/            # CRM pages
│   ├── inbox/          # Inbox pages
│   │   ├── InboxList.tsx
│   │   └── ThreadDetail.tsx
│   └── ...
└── types/              # Tipos compartilhados
```

## Drizzle ORM

O schema Drizzle em `src/db/schema/` é o **source of truth** para a estrutura do banco de dados.

### Configuração

O arquivo `drizzle.config.ts` na raiz do projeto aponta para o schema e usa a variável `SUPABASE_DB_URL`.

### Comandos de Migration

```bash
# Gerar migrations a partir de mudanças no schema
npx drizzle-kit generate

# Aplicar migrations pendentes
npx drizzle-kit migrate

# Visualizar diff entre schema e banco
npx drizzle-kit push

# Abrir o Drizzle Studio para inspecionar o banco
npx drizzle-kit studio
```

### Fluxo de trabalho

1. Altere o schema TypeScript em `src/db/schema/`
2. Execute `npx drizzle-kit generate` para gerar a migration SQL
3. Revise a migration gerada em `drizzle/`
4. Execute `npx drizzle-kit migrate` para aplicar

## Seed de Desenvolvimento

Um script de seed opcional está disponível para criar dados demo em ambiente de dev.

### O que o seed cria

- **Tenant Demo** (`slug: demo`) com:
  - Canal "Interno"
  - Pipeline padrão com 5 estágios (Novo → Contato feito → Proposta → Negociação → Fechado)
  - Lead demo (Maria Silva)
  - Thread demo vinculada à lead
  - Mensagem de boas-vindas

### Como rodar

```bash
# Defina as variáveis de ambiente e execute
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxx \
npx tsx scripts/seed-dev.ts
```

> ⚠️ O script usa a **service role key** e só deve ser usado em desenvolvimento. O script é idempotente — rodar múltiplas vezes não duplica dados.

## Segurança

- **RLS** habilitado em todas as tabelas com políticas por tenant
- **RBAC** com papéis: `admin`, `manager`, `agent`
  - `admin`: acesso total
  - `manager`: leitura de membros/convites/audit + CRM completo + Inbox completo
  - `agent`: CRM (leitura + escrita própria, sem delete) + Inbox (leitura + envio de mensagens) + leitura básica
- **RPCs SECURITY DEFINER** para operações sensíveis:
  - `create_tenant_with_admin` — cria tenant + membership admin + pipeline padrão + canal interno atomicamente
  - `accept_invite` — aceita convite com validação de token/expiração
  - `create_invite` — cria convite com validação, geração de token e audit log
  - `log_audit_event` — registra evento de auditoria (único caminho para INSERT em audit_logs)
  - `log_activity_event` — registra evento na timeline de atividades (único caminho para INSERT em activity_timeline)
  - `log_message_event` — registra evento de mensagem na timeline (entity=thread, action=message.sent)
- Writes em `invites`, `audit_logs` e `activity_timeline` **não possuem** políticas de INSERT direto; toda escrita passa por RPCs

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
- **INSERT/UPDATE**: admin e manager podem tudo; agent pode criar/editar registros onde `owner_user_id` ou `assigned_user_id` seja ele
- **DELETE**: somente admin e manager

### Pipeline Padrão

Ao criar um tenant via `create_tenant_with_admin`, um pipeline padrão é criado automaticamente com 5 etapas:
Novo → Contato feito → Proposta → Negociação → Fechado

## Inbox

### Arquitetura

O módulo Inbox é um sistema centralizado de conversas, projetado para ser extensível a múltiplos canais (WhatsApp, Email, Instagram) sem necessidade de refatoração.

### Tabelas

- `channels` — Tipos de canais de comunicação (internal, whatsapp, email, instagram)
  - Constraint `UNIQUE(tenant_id, type, name)` para evitar duplicatas
  - Canal "Interno" criado automaticamente ao criar um tenant
- `threads` — Conversas com status (open/closed/archived), responsável e vínculo com entidades CRM
  - Suporte a `related_entity` (lead/deal/company) para integração CRM
  - `last_message_at` para ordenação por última atividade
- `thread_participants` — Participantes internos das conversas
  - Constraint `UNIQUE(thread_id, user_id)`
- `messages` — Mensagens com `sender_type` (user/system/external)
  - Realtime habilitado para atualização ao vivo no ThreadDetail
- `thread_reads` — Rastreia última leitura por usuário por thread
  - Constraint `UNIQUE(thread_id, user_id)`
  - Usado para calcular contadores de mensagens não lidas

### Mensagens Não Lidas

- **`get_unread_counts(_tenant_id)`** — RPC que retorna `(thread_id, unread_count)` para o usuário autenticado (exclui mensagens próprias)
- **`mark_thread_read(_tenant_id, _thread_id)`** — RPC que marca thread como lida (upsert em `thread_reads`)
- **Sidebar**: badge com total de não lidas no link "Conversas"
- **Lista de threads**: badge individual por thread + destaque visual (negrito + fundo sutil)
- **Auto-mark**: ao abrir thread e ao receber mensagens via Realtime enquanto visualiza

### RLS Inbox

- **channels**: SELECT para membros; INSERT/UPDATE/DELETE apenas admin
- **threads**: SELECT para membros; INSERT/UPDATE admin+manager+agent (agent limitado a assigned_user_id = ele ou NULL); DELETE admin+manager
- **messages**: SELECT para membros; INSERT para membros; UPDATE/DELETE admin+manager
- **thread_participants**: SELECT para membros; INSERT/DELETE admin+manager

### RPCs

- `log_message_event` — SECURITY DEFINER que registra `message.sent` na `activity_timeline` com metadata `{ message_id, sender_type }`

### Eventos de Auditoria e Timeline

- `thread.created` — ao criar conversa
- `message.sent` — ao enviar mensagem (via RPC `log_message_event`)
- `thread.assigned` — ao atribuir responsável
- `thread.closed` — ao fechar conversa
- `thread.reopened` — ao reabrir conversa

### Extensibilidade Futura

Para adicionar um novo canal (ex: WhatsApp):
1. Criar um novo registro em `channels` com `type = 'whatsapp'`
2. Implementar integração via Edge Function que cria mensagens com `sender_type = 'external'`
3. O fluxo de UI já suporta filtro por canal e exibição de mensagens externas
4. Nenhuma alteração de schema necessária

### Validações Zod

- `createThreadSchema`: `channel_id` (uuid obrigatório), `subject` (max 200), `related_entity` (enum lead/deal/company), `related_entity_id` (uuid)
- `sendMessageSchema`: `content` (string, min 1, max 5000, trimmed)

## Auditoria e Timeline

Operações principais que geram registros:
- `deal.created`, `deal.stage_changed`
- `lead.created`
- `task.created`, `task.completed`
- `tag.created`
- `thread.created`, `thread.assigned`, `thread.closed`, `thread.reopened`
- `message.sent`

## Tenant Ativo

A persistência do tenant ativo usa `profiles.active_tenant_id` (com fallback temporário para localStorage).
