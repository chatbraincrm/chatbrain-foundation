import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEMO_EMAIL = "demo@chatbrain.dev";
const DEMO_PASSWORD = "Demo12345!";
const DEMO_NAME = "CRM Demo";
const DEMO_TENANT_SLUG = "demo";
const DEMO_TENANT_NAME = "Tenant Demo";

// External Supabase credentials from secrets
const EXTERNAL_URL = Deno.env.get("SUPABASE_URL")!;
const EXTERNAL_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXTERNAL_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!EXTERNAL_URL || !EXTERNAL_SERVICE_KEY || !EXTERNAL_ANON_KEY) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY secrets",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const log: string[] = [];
    const addLog = (msg: string) => {
      log.push(msg);
      console.log(msg);
    };

    addLog(`🌱 Seed: connecting to ${EXTERNAL_URL}`);

    // Admin client (bypasses RLS)
    const adminClient = createClient(EXTERNAL_URL, EXTERNAL_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Create or find demo user
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === DEMO_EMAIL);

    let userId: string;

    if (existing) {
      userId = existing.id;
      addLog(`✅ Usuário demo já existe (${userId})`);
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name: DEMO_NAME },
      });
      if (error) throw new Error(`Falha ao criar usuário: ${error.message}`);
      userId = data.user.id;
      addLog(`✅ Usuário demo criado: ${userId}`);
    }

    // 2. Ensure profile exists
    const { data: profileExists } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!profileExists) {
      const { error } = await adminClient
        .from("profiles")
        .insert({ id: userId, email: DEMO_EMAIL, name: DEMO_NAME });
      if (error) addLog(`⚠️ Profile insert: ${error.message}`);
      else addLog(`✅ Profile criado`);
    } else {
      await adminClient
        .from("profiles")
        .update({ name: DEMO_NAME, email: DEMO_EMAIL })
        .eq("id", userId);
      addLog(`✅ Profile já existe`);
    }

    // 3. Create tenant via RPC (needs auth.uid())
    const { data: tenantExists } = await adminClient
      .from("tenants")
      .select("id")
      .eq("slug", DEMO_TENANT_SLUG)
      .maybeSingle();

    let tenantId: string;

    if (tenantExists) {
      tenantId = tenantExists.id;
      addLog(`✅ Tenant "${DEMO_TENANT_NAME}" já existe (${tenantId})`);
    } else {
      // Sign in as demo user to call RPC with auth.uid()
      const anonClient = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { error: signInError } = await anonClient.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (signInError) throw new Error(`Falha ao autenticar: ${signInError.message}`);

      const { data, error } = await anonClient.rpc("create_tenant_with_admin", {
        _name: DEMO_TENANT_NAME,
        _slug: DEMO_TENANT_SLUG,
      });
      if (error) throw new Error(`RPC create_tenant: ${error.message}`);

      const result = data as { ok: boolean; data?: { tenant_id: string }; error?: { message: string } };
      if (!result.ok) throw new Error(`RPC error: ${result.error?.message}`);

      tenantId = result.data!.tenant_id;
      addLog(`✅ Tenant criado via RPC: ${tenantId}`);
      await anonClient.auth.signOut();
    }

    // 4. Ensure membership
    const { data: memberExists } = await adminClient
      .from("memberships")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!memberExists) {
      await adminClient.from("memberships").insert({
        tenant_id: tenantId,
        user_id: userId,
        role: "admin",
      });
      addLog(`✅ Membership admin criada`);
    } else {
      addLog(`✅ Membership admin já existe`);
    }

    // 5. Find channel
    const { data: channel } = await adminClient
      .from("channels")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("type", "internal")
      .maybeSingle();

    const channelId = channel?.id;
    if (channelId) addLog(`✅ Canal Interno encontrado (${channelId})`);
    else addLog(`⚠️ Canal Interno não encontrado`);

    // 6. Create lead
    const { data: leadExists } = await adminClient
      .from("leads")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("name", "Maria Silva (Demo)")
      .maybeSingle();

    let leadId: string;
    if (leadExists) {
      leadId = leadExists.id;
      addLog(`✅ Lead demo já existe (${leadId})`);
    } else {
      const { data, error } = await adminClient
        .from("leads")
        .insert({
          tenant_id: tenantId,
          name: "Maria Silva (Demo)",
          email: "maria.silva@exemplo.com",
          phone: "+55 11 99999-0000",
          source: "seed",
          status: "open",
        })
        .select("id")
        .single();
      if (error) throw new Error(`Lead: ${error.message}`);
      leadId = data.id;
      addLog(`✅ Lead demo criado: ${leadId}`);
    }

    // 7. Create thread + message
    if (channelId) {
      const { data: threadExists } = await adminClient
        .from("threads")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("subject", "Conversa Demo")
        .maybeSingle();

      let threadId: string;
      if (threadExists) {
        threadId = threadExists.id;
        addLog(`✅ Thread demo já existe (${threadId})`);
      } else {
        const { data, error } = await adminClient
          .from("threads")
          .insert({
            tenant_id: tenantId,
            channel_id: channelId,
            subject: "Conversa Demo",
            status: "open",
            related_entity: "lead",
            related_entity_id: leadId,
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw new Error(`Thread: ${error.message}`);
        threadId = data.id;
        addLog(`✅ Thread demo criada: ${threadId}`);
      }

      const { data: msgExists } = await adminClient
        .from("messages")
        .select("id")
        .eq("thread_id", threadId)
        .limit(1)
        .maybeSingle();

      if (!msgExists) {
        await adminClient.from("messages").insert({
          tenant_id: tenantId,
          thread_id: threadId,
          sender_type: "system",
          content: "👋 Bem-vindo ao ChatBrain! Esta é uma conversa de demonstração.",
        });
        addLog(`✅ Mensagem demo criada`);
      } else {
        addLog(`✅ Mensagem demo já existe`);
      }
    }

    // 8. Set active tenant
    await adminClient
      .from("profiles")
      .update({ active_tenant_id: tenantId })
      .eq("id", userId);
    addLog(`✅ active_tenant_id definido`);

    addLog(`\n✨ Seed concluído!`);
    addLog(`📧 Email: ${DEMO_EMAIL}`);
    addLog(`🔑 Senha: ${DEMO_PASSWORD}`);
    addLog(`🏢 Tenant: ${DEMO_TENANT_NAME}`);

    return new Response(
      JSON.stringify({ ok: true, log }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Seed error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
