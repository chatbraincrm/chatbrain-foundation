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
LOVABLE_SUPABASE_URL=https://xxx.supabase.co \
LOVABLE_SUPABASE_SERVICE_ROLE_KEY=xxx \
LOVABLE_SUPABASE_ANON_KEY=xxx \
npx tsx scripts/seed-dev.ts

# Opção 2: Via shell script (carrega .env.local automaticamente)
chmod +x scripts/seed-dev.sh
./scripts/seed-dev.sh
```

### Variáveis de ambiente necessárias

| Variável | Obrigatória |
|----------|-------------|
| `LOVABLE_SUPABASE_URL` | ✅ |
| `LOVABLE_SUPABASE_SERVICE_ROLE_KEY` | ✅ |
| `LOVABLE_SUPABASE_ANON_KEY` | ✅ |

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

## WhatsApp V1 (Evolution API)

Integração opcional com **Evolution API** para WhatsApp real: um tenant pode ter uma conexão ativa; inbound cria/reaproveita threads no Inbox e outbound envia mensagens quando a thread for WhatsApp e houver conexão ativa.

### Arquitetura

- **Persistência**: `whatsapp_connections` (uma por tenant; `base_url`, `api_key`, `instance_name`, `webhook_secret`, `is_active`) e `whatsapp_thread_links` (vínculo thread ↔ `wa_chat_id`).
- **Webhook**: POST `/api/webhooks/evolution` — validar header `x-webhook-secret`; parse do payload Evolution; criar/achar thread; inserir mensagem; rodar agente em background; responder 200 rápido.
- **Outbound**: cliente Evolution (`sendTextMessage` / `sendMediaMessage`); usado ao enviar mensagem pelo Inbox em thread WhatsApp e, se `ENABLE_WHATSAPP_OUTBOUND=true`, quando o agente insere mensagem em thread WhatsApp.

### Servidor de webhook

O webhook da Evolution precisa ser servido por um servidor Node (o front Vite não expõe essa rota em produção).

```bash
# Desenvolvimento (na raiz do projeto)
npm run server
```

O servidor sobe por padrão em `http://localhost:3001` e expõe `POST /api/webhooks/evolution`.

**Variáveis de ambiente (servidor)**:

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role (bypass RLS no webhook) |
| `OPENAI_API_KEY` | Para agente | Chave OpenAI para respostas do agente |
| `ENABLE_WHATSAPP_OUTBOUND` | Não | `true` para o agente enviar no WhatsApp (default: `false`) |
| `EVOLUTION_DEFAULT_BASE_URL` | Não | URL padrão da Evolution (ex.: `https://evolution.example.com`) |

**Configuração no painel Evolution**:

1. URL do webhook: `https://seu-dominio.com/api/webhooks/evolution` (em dev use um tunnel, ex. ngrok).
2. Header: `x-webhook-secret` = valor do campo "Webhook secret" em Configurações → WhatsApp no CHATBRAIN (gerar e salvar na tela).
3. Eventos: habilitar pelo menos **MESSAGES_UPSERT** para receber mensagens.

### Regras

- Sem credenciais/configuração o app continua igual; nada do Inbox interno quebra.
- Handoff humano interrompe respostas do agente e impede outbound do agente.
- Agente responde no WhatsApp apenas se o canal WhatsApp estiver habilitado no agente e houver `OPENAI_API_KEY`.
- `api_key` fica apenas no banco (não em variáveis VITE); na UI só admin/manager veem e só para preencher; ao salvar, campo vazio mantém a chave existente.

---

## Convites por email (Resend)

Convites criados no app podem ter o link enviado por email automaticamente.

- **Provider**: Resend (produção) ou Mock (dev/testes). Definido por `EMAIL_PROVIDER=resend` ou `mock`.
- **Variáveis**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_BASE_URL`. Sem config, a criação do convite não quebra; o link pode ser copiado manualmente.
- **Fluxo**: Ao criar convite (RPC), o front chama `POST /api/invites/send-email` no servidor com o `invite_id`; o servidor valida JWT, envia o email via Resend e atualiza `invites.email_sent_at`.
- **Reenviar**: Na tela de convites, botão para reenviar o email usando o mesmo token.

---

## Deploy em produção

O app precisa de **dois componentes**: front estático (build Vite) e **servidor Node** (webhook WhatsApp + API de convites). A solução recomendada é um **container Docker** com Nginx + Node.

### Rodar local com Docker Compose

1. **Copie o exemplo de env** (frontend + servidor):
   ```bash
   cp .env.local.example .env
   ```
2. **Edite `.env`** e preencha pelo menos:
   - **Frontend**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Supabase do seu projeto).
   - **Servidor**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `APP_BASE_URL=http://localhost:8080`.
   - **Email**: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` para envio real de convites.
3. **Suba os serviços**:
   ```bash
   docker compose up --build
   ```
4. Acesse **http://localhost:8080**. O Nginx faz proxy de `/api/*` para o Node.
5. **Health**: `curl http://localhost:8080/api/health` deve retornar `{"status":"ok",...}`.

### Variáveis de ambiente no deploy

| Variável | Obrigatória | Uso |
|----------|-------------|-----|
| `SUPABASE_URL` | ✅ | Servidor (webhook + invite email) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Servidor |
| `SUPABASE_ANON_KEY` | ✅ | Servidor (validação JWT para /api/invites/send-email) |
| `PORT` | Não | Porta do Node (default 3001) |
| `APP_BASE_URL` | Para email | URL pública do app (ex.: https://app.seudominio.com) |
| `OPENAI_API_KEY` | Para agente | Respostas do agente no webhook |
| `EMAIL_PROVIDER` | Não | `resend` ou `mock` |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Se resend | Envio de convites |
| `SENTRY_DSN` | Não | Se definida, instale `@sentry/node` para erros |

No **frontend** (build Vite), use as mesmas variáveis `VITE_*`; em produção atrás do mesmo host, `VITE_API_URL` pode ficar vazio (same origin).

### Deploy em Render / Fly.io / Railway

1. **Build**: Use o `Dockerfile` com target `web` para o serviço de front (Nginx) e target `api` para o serviço Node.
2. **Render**: Crie dois Web Services — um com Dockerfile target `web` (porta 80), outro target `api` (porta 3001). Ou um único serviço que rode ambos (script custom).
3. **Fly.io**: Dois apps ou um Dockerfile multi-service; configure `fly.toml` com portas e envs.
4. **Railway**: Dois serviços a partir do mesmo repo: um Dockerfile target `web`, outro target `api`; defina envs em cada um.

Em todos os casos, configure a **URL pública** do front (ex.: https://seu-app.onrender.com) em `APP_BASE_URL` e, no painel Evolution, use essa mesma base para o webhook: `https://seu-app.onrender.com/api/webhooks/evolution`.

### Servidor (Node)

- **Porta**: `PORT` (default 3001).
- **Rotas**: `GET /api/health` (health check), `POST /api/invites/send-email` (auth JWT), `POST /api/webhooks/evolution` (header `x-webhook-secret`).
- **CORS**: Em dev aceita qualquer origin; em produção aceita apenas `APP_BASE_URL` quando definido.
- **Rate limit**: 120 req/min por IP no webhook. **Logs**: JSON estruturado, sem segredos.

### Teste manual local (Docker) — checklist

Use este passo a passo para validar o fluxo de convites e a app atrás do Nginx.

| Item | Como validar |
|------|----------------|
| **A** | `docker compose up --build` sobe web e api; app abre em http://localhost:8080 |
| **B** | `curl http://localhost:8080/api/health` responde `{"status":"ok",...}` |
| **C** | Criar convite envia email via Resend (verifique caixa de entrada e `EMAIL_PROVIDER=resend` + Resend configurado) |
| **D** | Reenviar convite (botão na linha do convite) funciona e atualiza "Email enviado" (e `email_sent_at` no banco) |
| **E** | Página `/invite/:token` funciona: abrir link do email → login/signup se necessário (redirect preservado) → aceitar convite → membership criada e redirecionamento para /select-tenant |

**Passo a passo resumido**

1. Subir stack: `cp .env.local.example .env`, preencher `.env`, `docker compose up --build`.
2. Criar conta: acesse http://localhost:8080 → Signup → confirmar email (Supabase Auth).
3. Criar workspace: após login, criar primeiro tenant (Onboarding ou Select Tenant).
4. Criar convite: Configurações / Convites → Novo Convite (email do convidado + papel) → Criar. Verificar "Email enviado" ou falha (e link para copiar).
5. Receber email: conferir caixa de entrada (ou mock se `EMAIL_PROVIDER=mock`); copiar link se não tiver Resend.
6. Aceitar em janela anônima: abrir o link (ex.: http://localhost:8080/invite/TOKEN) em aba anônima → fazer login ou criar conta (redirect volta para `/invite/TOKEN`) → clicar "Aceitar Convite".
7. Confirmar: redirecionamento para /select-tenant; escolher o workspace; verificar que o usuário tem o papel correto (Members).

---

## Auditoria

Operações que geram registros:
`deal.created`, `deal.stage_changed`, `lead.created`, `task.created`, `task.completed`,
`tag.created`, `thread.created`, `thread.assigned`, `thread.closed`, `thread.reopened`, `message.sent`

## Tenant Ativo

Persistência via `profiles.active_tenant_id` (com fallback temporário para localStorage).
