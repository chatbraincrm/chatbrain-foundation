/**
 * Seed script para ambiente de desenvolvimento.
 *
 * Cria um tenant demo completo com:
 *  - Canal "Interno"
 *  - Pipeline padrão com 5 estágios
 *  - Lead demo
 *  - Thread demo vinculada ao lead
 *  - Mensagem demo
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/seed-dev.ts
 *
 * ⚠️  Usa service_role key — nunca exponha em produção.
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '❌  Variáveis obrigatórias não definidas.\n' +
    '   SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias.\n\n' +
    '   Exemplo:\n' +
    '   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/seed-dev.ts'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEMO_TENANT_SLUG = 'demo';
const DEMO_TENANT_NAME = 'Tenant Demo';

const PIPELINE_STAGES = [
  { name: 'Novo', position: 0, color: '#6366f1' },
  { name: 'Contato feito', position: 1, color: '#3b82f6' },
  { name: 'Proposta', position: 2, color: '#f59e0b' },
  { name: 'Negociação', position: 3, color: '#f97316' },
  { name: 'Fechado', position: 4, color: '#22c55e' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsertTenant() {
  // Check if demo tenant already exists
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', DEMO_TENANT_SLUG)
    .maybeSingle();

  if (existing) {
    console.log(`✅  Tenant "${DEMO_TENANT_NAME}" já existe (${existing.id})`);
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from('tenants')
    .insert({ name: DEMO_TENANT_NAME, slug: DEMO_TENANT_SLUG })
    .select('id')
    .single();

  if (error) throw new Error(`Falha ao criar tenant: ${error.message}`);
  console.log(`✅  Tenant criado: ${data.id}`);
  return data.id as string;
}

async function ensureChannel(tenantId: string) {
  const { data: existing } = await supabase
    .from('channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('type', 'internal')
    .eq('name', 'Interno')
    .maybeSingle();

  if (existing) {
    console.log(`✅  Canal "Interno" já existe (${existing.id})`);
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from('channels')
    .insert({ tenant_id: tenantId, type: 'internal', name: 'Interno' })
    .select('id')
    .single();

  if (error) throw new Error(`Falha ao criar canal: ${error.message}`);
  console.log(`✅  Canal "Interno" criado: ${data.id}`);
  return data.id as string;
}

async function ensurePipeline(tenantId: string) {
  const { data: existing } = await supabase
    .from('pipelines')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .maybeSingle();

  if (existing) {
    console.log(`✅  Pipeline padrão já existe (${existing.id})`);
    return existing.id as string;
  }

  const { data: pipeline, error: pipelineError } = await supabase
    .from('pipelines')
    .insert({ tenant_id: tenantId, name: 'Pipeline Padrão', is_default: true })
    .select('id')
    .single();

  if (pipelineError) throw new Error(`Falha ao criar pipeline: ${pipelineError.message}`);

  const stages = PIPELINE_STAGES.map(s => ({
    tenant_id: tenantId,
    pipeline_id: pipeline.id,
    ...s,
  }));

  const { error: stagesError } = await supabase
    .from('pipeline_stages')
    .insert(stages);

  if (stagesError) throw new Error(`Falha ao criar estágios: ${stagesError.message}`);

  console.log(`✅  Pipeline padrão criado com ${PIPELINE_STAGES.length} estágios: ${pipeline.id}`);
  return pipeline.id as string;
}

async function ensureLead(tenantId: string) {
  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', 'Maria Silva (Demo)')
    .maybeSingle();

  if (existing) {
    console.log(`✅  Lead demo já existe (${existing.id})`);
    return existing.id as string;
  }

  const { data, error } = await supabase
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
  return data.id as string;
}

async function ensureThread(tenantId: string, channelId: string, leadId: string) {
  const { data: existing } = await supabase
    .from('threads')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('subject', 'Conversa Demo')
    .maybeSingle();

  if (existing) {
    console.log(`✅  Thread demo já existe (${existing.id})`);
    return existing.id as string;
  }

  const { data, error } = await supabase
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
  return data.id as string;
}

async function ensureMessage(tenantId: string, threadId: string) {
  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('thread_id', threadId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log(`✅  Mensagem demo já existe (${existing.id})`);
    return;
  }

  const { error } = await supabase
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

  const tenantId = await upsertTenant();
  const channelId = await ensureChannel(tenantId);
  await ensurePipeline(tenantId);
  const leadId = await ensureLead(tenantId);
  const threadId = await ensureThread(tenantId, channelId, leadId);
  await ensureMessage(tenantId, threadId);

  console.log('\n✨ Seed concluído com sucesso!');
  console.log(`   Tenant ID: ${tenantId}`);
  console.log(`   Slug: ${DEMO_TENANT_SLUG}`);
  console.log('\n   Para acessar, crie um usuário e adicione uma membership manual:');
  console.log(`   INSERT INTO memberships (tenant_id, user_id, role) VALUES ('${tenantId}', '<USER_ID>', 'admin');\n`);
}

main().catch((err) => {
  console.error('\n❌ Erro no seed:', err.message);
  process.exit(1);
});
