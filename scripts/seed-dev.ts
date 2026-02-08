/**
 * Seed script para ambiente de desenvolvimento.
 *
 * Cria automaticamente:
 *  - Usuário demo (demo@chatbrain.dev / Demo12345!)
 *  - Tenant demo via RPC create_tenant_with_admin (pipeline + canal Interno)
 *  - Membership admin para o usuário demo
 *  - Lead demo
 *  - Thread demo vinculada ao lead
 *  - Mensagem demo
 *
 * Uso:
 *   LOVABLE_SUPABASE_URL=https://xxx.supabase.co LOVABLE_SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/seed-dev.ts
 *
 * ⚠️  Usa service_role key — nunca exponha em produção.
 * ⚠️  Aborta se NODE_ENV === 'production'.
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV === 'production') {
  console.error('❌  Este script não pode ser executado em produção (NODE_ENV=production).');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.LOVABLE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.LOVABLE_SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.LOVABLE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '❌  Variáveis obrigatórias não definidas.\n' +
    '   LOVABLE_SUPABASE_URL e LOVABLE_SUPABASE_SERVICE_ROLE_KEY são necessárias.\n\n' +
    '   Exemplo:\n' +
    '   LOVABLE_SUPABASE_URL=https://xxx.supabase.co LOVABLE_SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/seed-dev.ts'
  );
  process.exit(1);
}

if (!ANON_KEY) {
  console.error(
    '❌  LOVABLE_SUPABASE_ANON_KEY é necessária para chamar RPCs autenticadas.'
  );
  process.exit(1);
}

// Service-role client (bypasses RLS)
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEMO_EMAIL = 'demo@chatbrain.dev';
const DEMO_PASSWORD = 'Demo12345!';
const DEMO_NAME = 'CRM Demo';
const DEMO_TENANT_SLUG = 'demo';
const DEMO_TENANT_NAME = 'Tenant Demo';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureDemoUser(): Promise<string> {
  // Check if user already exists
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email === DEMO_EMAIL);

  if (existing) {
    console.log(`✅  Usuário demo já existe (${existing.id})`);
    await ensureProfile(existing.id);
    return existing.id;
  }

  // Create user via admin API (auto-confirmed)
  const { data, error } = await adminClient.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name: DEMO_NAME },
  });

  if (error) throw new Error(`Falha ao criar usuário demo: ${error.message}`);
  console.log(`✅  Usuário demo criado: ${data.user.id}`);

  // Profile should be created by the handle_new_user trigger,
  // but ensure it exists just in case
  await ensureProfile(data.user.id);
  return data.user.id;
}

async function ensureProfile(userId: string): Promise<void> {
  const { data: existing } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) {
    // Update name if needed
    await adminClient
      .from('profiles')
      .update({ name: DEMO_NAME, email: DEMO_EMAIL })
      .eq('id', userId);
    return;
  }

  // Create profile manually if trigger didn't fire
  const { error } = await adminClient
    .from('profiles')
    .insert({ id: userId, email: DEMO_EMAIL, name: DEMO_NAME });

  if (error) throw new Error(`Falha ao criar profile: ${error.message}`);
  console.log(`✅  Profile criado para o usuário demo`);
}

async function ensureTenant(userId: string): Promise<string> {
  // Check if demo tenant already exists
  const { data: existing } = await adminClient
    .from('tenants')
    .select('id')
    .eq('slug', DEMO_TENANT_SLUG)
    .maybeSingle();

  if (existing) {
    console.log(`✅  Tenant "${DEMO_TENANT_NAME}" já existe (${existing.id})`);
    await ensureMembership(existing.id, userId);
    return existing.id;
  }

  // Create tenant via RPC (creates pipeline + channel + membership automatically)
  // The RPC requires auth.uid(), so we need to sign in as the demo user
  const anonClient = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: signInError } = await anonClient.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (signInError) throw new Error(`Falha ao autenticar usuário demo: ${signInError.message}`);

  const { data, error } = await anonClient.rpc('create_tenant_with_admin', {
    _name: DEMO_TENANT_NAME,
    _slug: DEMO_TENANT_SLUG,
  });

  if (error) throw new Error(`Falha ao criar tenant via RPC: ${error.message}`);

  const result = data as { ok: boolean; data?: { tenant_id: string }; error?: { message: string } };

  if (!result.ok) {
    throw new Error(`RPC retornou erro: ${result.error?.message || 'Erro desconhecido'}`);
  }

  const tenantId = result.data!.tenant_id;
  console.log(`✅  Tenant criado via RPC: ${tenantId}`);
  console.log(`   ↳ Pipeline padrão + Canal Interno criados automaticamente`);

  // Sign out anon client
  await anonClient.auth.signOut();

  return tenantId;
}

async function ensureMembership(tenantId: string, userId: string): Promise<void> {
  const { data: existing } = await adminClient
    .from('memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    console.log(`✅  Membership admin já existe`);
    return;
  }

  const { error } = await adminClient
    .from('memberships')
    .insert({ tenant_id: tenantId, user_id: userId, role: 'admin' });

  if (error) throw new Error(`Falha ao criar membership: ${error.message}`);
  console.log(`✅  Membership admin criada`);
}

async function getChannelId(tenantId: string): Promise<string> {
  const { data, error } = await adminClient
    .from('channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('type', 'internal')
    .eq('name', 'Interno')
    .maybeSingle();

  if (error || !data) throw new Error('Canal Interno não encontrado — deveria ter sido criado pela RPC');
  console.log(`✅  Canal "Interno" encontrado (${data.id})`);
  return data.id;
}

async function getPipelineId(tenantId: string): Promise<string> {
  const { data, error } = await adminClient
    .from('pipelines')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .maybeSingle();

  if (error || !data) throw new Error('Pipeline padrão não encontrado — deveria ter sido criado pela RPC');
  console.log(`✅  Pipeline padrão encontrado (${data.id})`);
  return data.id;
}

async function ensureLead(tenantId: string): Promise<string> {
  const { data: existing } = await adminClient
    .from('leads')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', 'Maria Silva (Demo)')
    .maybeSingle();

  if (existing) {
    console.log(`✅  Lead demo já existe (${existing.id})`);
    return existing.id;
  }

  const { data, error } = await adminClient
    .from('leads')
    .insert({
      tenant_id: tenantId,
      name: 'Maria Silva (Demo)',
      email: 'maria.silva@exemplo.com',
      phone: '+55 11 99999-0000',
      source: 'seed',
      status: 'open',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Falha ao criar lead: ${error.message}`);
  console.log(`✅  Lead demo criado: ${data.id}`);
  return data.id;
}

async function ensureThread(tenantId: string, channelId: string, leadId: string): Promise<string> {
  const { data: existing } = await adminClient
    .from('threads')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('subject', 'Conversa Demo')
    .maybeSingle();

  if (existing) {
    console.log(`✅  Thread demo já existe (${existing.id})`);
    return existing.id;
  }

  const { data, error } = await adminClient
    .from('threads')
    .insert({
      tenant_id: tenantId,
      channel_id: channelId,
      subject: 'Conversa Demo',
      status: 'open',
      related_entity: 'lead',
      related_entity_id: leadId,
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw new Error(`Falha ao criar thread: ${error.message}`);
  console.log(`✅  Thread demo criada: ${data.id}`);
  return data.id;
}

async function ensureMessage(tenantId: string, threadId: string): Promise<void> {
  const { data: existing } = await adminClient
    .from('messages')
    .select('id')
    .eq('thread_id', threadId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log(`✅  Mensagem demo já existe (${existing.id})`);
    return;
  }

  const { error } = await adminClient
    .from('messages')
    .insert({
      tenant_id: tenantId,
      thread_id: threadId,
      sender_type: 'system',
      content: '👋 Bem-vindo ao ChatBrain! Esta é uma conversa de demonstração vinculada à lead Maria Silva.',
    });

  if (error) throw new Error(`Falha ao criar mensagem: ${error.message}`);
  console.log(`✅  Mensagem demo criada`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n🌱 Iniciando seed de desenvolvimento...\n');

  // 1. Create demo user + profile
  const userId = await ensureDemoUser();

  // 2. Create tenant via RPC (pipeline + channel created automatically)
  const tenantId = await ensureTenant(userId);

  // 3. Fetch resources created by RPC
  const channelId = await getChannelId(tenantId);
  await getPipelineId(tenantId); // just validate it exists

  // 4. Create demo CRM data
  const leadId = await ensureLead(tenantId);

  // 5. Create demo Inbox data
  const threadId = await ensureThread(tenantId, channelId, leadId);
  await ensureMessage(tenantId, threadId);

  // 6. Set active tenant for the demo user
  await adminClient
    .from('profiles')
    .update({ active_tenant_id: tenantId })
    .eq('id', userId);

  console.log('\n' + '═'.repeat(50));
  console.log('✨ Seed concluído com sucesso!');
  console.log('═'.repeat(50));
  console.log(`\n   📧 Email:    ${DEMO_EMAIL}`);
  console.log(`   🔑 Senha:    ${DEMO_PASSWORD}`);
  console.log(`   🏢 Tenant:   ${DEMO_TENANT_NAME} (${DEMO_TENANT_SLUG})`);
  console.log(`   🆔 Tenant ID: ${tenantId}`);
  console.log(`\n   Faça login com as credenciais acima para acessar o sistema.\n`);
}

main().catch((err) => {
  console.error('\n❌ Erro no seed:', err.message);
  process.exit(1);
});
