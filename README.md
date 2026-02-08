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
│   └── index.ts
├── lib/                # Infraestrutura (auth, tenant, rbac, validators)
├── modules/            # Camada de dados (API/repository por domínio)
│   ├── audit/
│   ├── invites/
│   ├── memberships/
│   ├── tenants/
│   └── crm/            # CRM repositories
│       ├── pipelines-api.ts
│       ├── companies-api.ts
│       ├── leads-api.ts
│       ├── deals-api.ts
│       ├── tasks-api.ts
│       ├── tags-api.ts
│       └── timeline-api.ts
├── components/         # Componentes de UI
├── pages/              # Rotas/telas
│   ├── crm/            # CRM pages
│   │   ├── Pipelines.tsx
│   │   ├── Leads.tsx
│   │   ├── LeadDetail.tsx
│   │   ├── Companies.tsx
│   │   ├── CompanyDetail.tsx
│   │   ├── DealsKanban.tsx
│   │   ├── DealDetail.tsx
│   │   └── Tasks.tsx
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

## Segurança

- **RLS** habilitado em todas as tabelas com políticas por tenant
- **RBAC** com papéis: `admin`, `manager`, `agent`
  - `admin`: acesso total
  - `manager`: leitura de membros/convites/audit + CRM completo
  - `agent`: CRM (leitura + escrita própria, sem delete) + leitura básica
- **RPCs SECURITY DEFINER** para operações sensíveis:
  - `create_tenant_with_admin` — cria tenant + membership admin + pipeline padrão atomicamente
  - `accept_invite` — aceita convite com validação de token/expiração
  - `create_invite` — cria convite com validação, geração de token e audit log
  - `log_audit_event` — registra evento de auditoria (único caminho para INSERT em audit_logs)
  - `log_activity_event` — registra evento na timeline de atividades (único caminho para INSERT em activity_timeline)
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

### Auditoria e Timeline

Operações principais que geram registros:
- `deal.created`, `deal.stage_changed`
- `lead.created`
- `task.created`, `task.completed`
- `tag.created`

## Tenant Ativo

A persistência do tenant ativo usa `profiles.active_tenant_id` (com fallback temporário para localStorage).
