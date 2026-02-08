/**
 * Express server: WhatsApp Evolution webhook + invite email API.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, [SUPABASE_ANON_KEY], [OPENAI_API_KEY], [PORT=3001], [APP_BASE_URL], [RESEND_*], [EMAIL_PROVIDER], [SENTRY_DSN]
 * Evolution: webhook valida header x-webhook-secret com webhook_secret da conexão no banco; credenciais por tenant (base_url, api_key, instance_name) ou fallback EVOLUTION_BASE_URL, EVOLUTION_API_KEY.
 */
import express from 'express';
import cors from 'cors';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { handleWebhookRequest, buildWebhookRequest } from '../src/modules/whatsapp/webhook-handler';
import { sendInviteEmail } from '../src/modules/email/send-invite-email';
import { webhookRateLimit } from './rate-limit';

const PORT = Number(process.env.PORT) || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const isDev = process.env.NODE_ENV !== 'production';

if (process.env.SENTRY_DSN) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? 'development' });
  } catch {
    // @sentry/node not installed; run without Sentry
  }
}

function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
  const payload = { level, message, ...meta, timestamp: new Date().toISOString() };
  console[level](JSON.stringify(payload));
}

const appBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/$/, '') || null;

const app = express();

const corsOptions: cors.CorsOptions = {
  credentials: true,
  origin: isDev
    ? true
    : (appBaseUrl
        ? (origin, cb) => {
            const o = (origin || '').replace(/\/$/, '');
            if (o === appBaseUrl) {
              cb(null, origin);
            } else {
              cb(null, false);
            }
          }
        : (_, cb) => cb(null, true)),
};
app.use(cors(corsOptions));
app.use(express.json());

// ---------------------------------------------------------------------------
// Health (for Docker / load balancers)
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Invite email: send or resend (requires auth)
// ---------------------------------------------------------------------------
app.post('/api/invites/send-email', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const inviteId = typeof req.body?.invite_id === 'string' ? req.body.invite_id.trim() : null;
  if (!inviteId) {
    res.status(400).json({ error: 'invite_id required' });
    return;
  }

  const anonKey = SUPABASE_ANON_KEY;
  if (!anonKey) {
    log('warn', 'invites/send-email: SUPABASE_ANON_KEY not set');
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const authClient = createClient(SUPABASE_URL, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SupabaseClient;

  const { data: invite, error: inviteError } = await adminClient
    .from('invites')
    .select('id, tenant_id, email, token, role')
    .eq('id', inviteId)
    .maybeSingle();

  if (inviteError || !invite) {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }

  const { data: membership } = await adminClient
    .from('memberships')
    .select('role')
    .eq('tenant_id', invite.tenant_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role !== 'admin') {
    res.status(403).json({ error: 'Only tenant admins can send invite emails' });
    return;
  }

  const { data: tenant } = await adminClient
    .from('tenants')
    .select('name')
    .eq('id', invite.tenant_id)
    .single();

  const tenantName = tenant?.name ?? 'Tenant';

  const result = await sendInviteEmail({
    to: invite.email,
    token: invite.token,
    tenantName,
    role: invite.role,
  });

  if (!result.sent) {
    res.status(500).json({ sent: false, error: result.error ?? 'Failed to send email' });
    return;
  }

  await adminClient
    .from('invites')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', inviteId);

  res.status(200).json({ sent: true });
});

app.post('/api/webhooks/evolution', webhookRateLimit, async (req, res) => {
  const secret =
    typeof req.headers['x-webhook-secret'] === 'string'
      ? req.headers['x-webhook-secret'].trim()
      : null;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    log('warn', 'webhook: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (!secret) {
    if (!isDev) {
      log('warn', 'webhook: missing x-webhook-secret in production');
      res.status(401).json({ error: 'Missing webhook secret' });
      return;
    }
    const { data: first } = await client
      .from('whatsapp_connections')
      .select('id')
      .limit(1)
      .maybeSingle();
    const connectionId = first?.id ?? null;
    if (!connectionId) {
      res.status(404).json({ error: 'No connection in dev' });
      return;
    }
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    const webhookReq = buildWebhookRequest({
      method: 'POST',
      url: req.originalUrl || '/api/webhooks/evolution',
      rawBody,
      body: req.body,
    });
    const result = await handleWebhookRequest(client, connectionId, webhookReq, {
      getOpenAiKey: () => process.env.OPENAI_API_KEY ?? null,
    });
    res.status(result.status).send(result.body ?? undefined);
    return;
  }

  const { data: conn, error } = await client
    .from('whatsapp_connections')
    .select('id')
    .eq('webhook_secret', secret)
    .maybeSingle();
  if (error) {
    log('warn', 'webhook: db error', { error: String(error) });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!conn) {
    log('warn', 'webhook: invalid x-webhook-secret');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const connectionId = conn.id;

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const webhookReq = buildWebhookRequest({
    method: 'POST',
    url: req.originalUrl || '/api/webhooks/evolution',
    rawBody,
    body: req.body,
  });

  const result = await handleWebhookRequest(client, connectionId, webhookReq, {
    getOpenAiKey: () => process.env.OPENAI_API_KEY ?? null,
  });

  res.status(result.status).send(result.body ?? undefined);
});

app.listen(PORT, () => {
  log('info', `Server listening on port ${PORT}`, { port: PORT });
});
