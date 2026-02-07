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
│   └── index.ts
├── lib/                # Infraestrutura (auth, tenant, rbac, validators)
├── modules/            # Camada de dados (API/repository por domínio)
│   ├── audit/
│   ├── invites/
│   ├── memberships/
│   └── tenants/
├── components/         # Componentes de UI
├── pages/              # Rotas/telas
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
- **RPCs SECURITY DEFINER** para operações sensíveis:
  - `create_tenant_with_admin` — cria tenant + membership admin atomicamente
  - `accept_invite` — aceita convite com validação de token/expiração
  - `create_invite` — cria convite com validação, geração de token e audit log
  - `log_audit_event` — registra evento de auditoria (único caminho para INSERT em audit_logs)
- Writes em `invites` e `audit_logs` **não possuem** políticas de INSERT direto; toda escrita passa por RPCs

## Tenant Ativo

A persistência do tenant ativo usa `profiles.active_tenant_id` (com fallback temporário para localStorage).
