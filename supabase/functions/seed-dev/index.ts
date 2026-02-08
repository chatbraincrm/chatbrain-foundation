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

// External Supabase credentials from custom secrets
const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const EXTERNAL_SERVICE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
// Anon key is public — safe to hardcode
const EXTERNAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxYW56Zm54dm1ocHBicHh5aGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MjQ5NDYsImV4cCI6MjA4NjEwMDk0Nn0.m6mFIKf86lbyuT0aVLlpQ008w5M52pMMdFImPahUE6g";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!EXTERNAL_URL || !EXTERNAL_SERVICE_KEY || !EXTERNAL_ANON_KEY) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing EXTERNAL_SUPABASE_URL or EXTERNAL_SUPABASE_SERVICE_ROLE_KEY secrets",
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
    const admin = createClient(EXTERNAL_URL, EXTERNAL_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // -----------------------------------------------------------------------
    // 1. Create or find demo user
    // -----------------------------------------------------------------------
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === DEMO_EMAIL);

    let userId: string;

    if (existing) {
      userId = existing.id;
      addLog(`✅ Usuário demo já existe (${userId})`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name: DEMO_NAME },
      });
      if (error) throw new Error(`Falha ao criar usuário: ${error.message}`);
      userId = data.user.id;
      addLog(`✅ Usuário demo criado: ${userId}`);
    }

    // -----------------------------------------------------------------------
    // 2. Ensure profile exists
    // -----------------------------------------------------------------------
    const { data: profileExists } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!profileExists) {
      const { error } = await admin
        .from("profiles")
        .insert({ id: userId, email: DEMO_EMAIL, name: DEMO_NAME });
      if (error) addLog(`⚠️ Profile insert: ${error.message}`);
      else addLog(`✅ Profile criado`);
    } else {
      await admin
        .from("profiles")
        .update({ name: DEMO_NAME, email: DEMO_EMAIL })
        .eq("id", userId);
      addLog(`✅ Profile já existe`);
    }

    // -----------------------------------------------------------------------
    // 3. Create tenant via RPC (needs auth.uid())
    // -----------------------------------------------------------------------
    const { data: tenantExists } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", DEMO_TENANT_SLUG)
      .maybeSingle();

    let tenantId: string;

    if (tenantExists) {
      tenantId = tenantExists.id;
      addLog(`✅ Tenant "${DEMO_TENANT_NAME}" já existe (${tenantId})`);
    } else {
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

    // -----------------------------------------------------------------------
    // 4. Ensure membership
    // -----------------------------------------------------------------------
    const { data: memberExists } = await admin
      .from("memberships")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!memberExists) {
      await admin.from("memberships").insert({
        tenant_id: tenantId,
        user_id: userId,
        role: "admin",
      });
      addLog(`✅ Membership admin criada`);
    } else {
      addLog(`✅ Membership admin já existe`);
    }

    // -----------------------------------------------------------------------
    // 5. Find channel
    // -----------------------------------------------------------------------
    const { data: channel } = await admin
      .from("channels")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("type", "internal")
      .maybeSingle();

    const channelId = channel?.id;
    if (channelId) addLog(`✅ Canal Interno encontrado (${channelId})`);
    else addLog(`⚠️ Canal Interno não encontrado`);

    // -----------------------------------------------------------------------
    // 6. Companies
    // -----------------------------------------------------------------------
    const companies = [
      { name: "Acme Corp", website: "https://acme.com" },
      { name: "TechNova Ltda", website: "https://technova.com.br" },
      { name: "Importadora Global", website: "https://importadoraglobal.com.br" },
    ];

    const companyIds: string[] = [];
    for (const c of companies) {
      const { data: exists } = await admin
        .from("companies")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", c.name)
        .maybeSingle();

      if (exists) {
        companyIds.push(exists.id);
        addLog(`✅ Empresa "${c.name}" já existe`);
      } else {
        const { data, error } = await admin
          .from("companies")
          .insert({ tenant_id: tenantId, name: c.name, website: c.website })
          .select("id")
          .single();
        if (error) { addLog(`⚠️ Empresa "${c.name}": ${error.message}`); continue; }
        companyIds.push(data.id);
        addLog(`✅ Empresa "${c.name}" criada`);
      }
    }

    // -----------------------------------------------------------------------
    // 7. Leads
    // -----------------------------------------------------------------------
    const leads = [
      { name: "Maria Silva (Demo)", email: "maria.silva@exemplo.com", phone: "+55 11 99999-0000", source: "seed", status: "open", company_idx: 0 },
      { name: "João Oliveira", email: "joao@technova.com.br", phone: "+55 21 98888-1111", source: "website", status: "open", company_idx: 1 },
      { name: "Ana Costa", email: "ana.costa@gmail.com", phone: "+55 31 97777-2222", source: "indicação", status: "open", company_idx: null },
      { name: "Carlos Mendes", email: "carlos@importadoraglobal.com.br", phone: "+55 11 96666-3333", source: "linkedin", status: "contacted", company_idx: 2 },
      { name: "Fernanda Rocha", email: "fernanda.rocha@acme.com", phone: "+55 41 95555-4444", source: "cold_call", status: "qualified", company_idx: 0 },
    ];

    const leadIds: string[] = [];
    for (const l of leads) {
      const { data: exists } = await admin
        .from("leads")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", l.name)
        .maybeSingle();

      if (exists) {
        leadIds.push(exists.id);
        addLog(`✅ Lead "${l.name}" já existe`);
      } else {
        const { data, error } = await admin
          .from("leads")
          .insert({
            tenant_id: tenantId,
            name: l.name,
            email: l.email,
            phone: l.phone,
            source: l.source,
            status: l.status,
            company_id: l.company_idx !== null ? companyIds[l.company_idx] : null,
          })
          .select("id")
          .single();
        if (error) { addLog(`⚠️ Lead "${l.name}": ${error.message}`); continue; }
        leadIds.push(data.id);
        addLog(`✅ Lead "${l.name}" criado`);
      }
    }

    // -----------------------------------------------------------------------
    // 8. Pipeline & Stages (fetch existing)
    // -----------------------------------------------------------------------
    const { data: pipeline } = await admin
      .from("pipelines")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .maybeSingle();

    let pipelineId = pipeline?.id;
    let stageIds: string[] = [];

    if (pipelineId) {
      const { data: stages } = await admin
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_id", pipelineId)
        .order("position", { ascending: true });
      stageIds = (stages || []).map((s: any) => s.id);
      addLog(`✅ Pipeline padrão encontrado com ${stageIds.length} estágios`);
    } else {
      addLog(`⚠️ Pipeline padrão não encontrado – deals não serão criados`);
    }

    // -----------------------------------------------------------------------
    // 9. Deals
    // -----------------------------------------------------------------------
    if (pipelineId && stageIds.length >= 5) {
      const deals = [
        { title: "Projeto ERP Acme", value_cents: 4500000, stage_idx: 2, lead_idx: 4, company_idx: 0 },
        { title: "Consultoria TechNova", value_cents: 1200000, stage_idx: 1, lead_idx: 1, company_idx: 1 },
        { title: "Importação Equipamentos", value_cents: 8700000, stage_idx: 3, lead_idx: 3, company_idx: 2 },
        { title: "Automação Marketing", value_cents: 350000, stage_idx: 0, lead_idx: 2, company_idx: null },
        { title: "Licença SaaS Anual", value_cents: 960000, stage_idx: 4, lead_idx: 0, company_idx: 0 },
      ];

      for (const d of deals) {
        const { data: exists } = await admin
          .from("deals")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("title", d.title)
          .maybeSingle();

        if (exists) {
          addLog(`✅ Deal "${d.title}" já existe`);
        } else {
          const { error } = await admin.from("deals").insert({
            tenant_id: tenantId,
            title: d.title,
            value_cents: d.value_cents,
            currency: "BRL",
            pipeline_id: pipelineId,
            stage_id: stageIds[d.stage_idx],
            lead_id: leadIds[d.lead_idx] || null,
            company_id: d.company_idx !== null ? companyIds[d.company_idx] : null,
            owner_user_id: userId,
          });
          if (error) addLog(`⚠️ Deal "${d.title}": ${error.message}`);
          else addLog(`✅ Deal "${d.title}" criado`);
        }
      }
    }

    // -----------------------------------------------------------------------
    // 10. Tasks
    // -----------------------------------------------------------------------
    const tasks = [
      { title: "Ligar para Maria Silva", description: "Retornar ligação sobre proposta ERP", status: "open", due_days: 1, lead_idx: 0 },
      { title: "Enviar contrato TechNova", description: "Preparar e enviar contrato de consultoria", status: "open", due_days: 3, lead_idx: 1 },
      { title: "Follow-up Ana Costa", description: "Verificar interesse no plano de automação", status: "open", due_days: 2, lead_idx: 2 },
      { title: "Reunião com Importadora Global", description: "Apresentação de catálogo de equipamentos", status: "done", due_days: -1, lead_idx: 3 },
      { title: "Renovar licença Acme", description: "Negociar renovação SaaS anual", status: "open", due_days: 7, lead_idx: 4 },
    ];

    for (const t of tasks) {
      const { data: exists } = await admin
        .from("tasks")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("title", t.title)
        .maybeSingle();

      if (exists) {
        addLog(`✅ Tarefa "${t.title}" já existe`);
      } else {
        const dueAt = new Date();
        dueAt.setDate(dueAt.getDate() + t.due_days);

        const { error } = await admin.from("tasks").insert({
          tenant_id: tenantId,
          title: t.title,
          description: t.description,
          status: t.status,
          due_at: dueAt.toISOString(),
          assigned_user_id: userId,
          lead_id: leadIds[t.lead_idx] || null,
        });
        if (error) addLog(`⚠️ Tarefa "${t.title}": ${error.message}`);
        else addLog(`✅ Tarefa "${t.title}" criada`);
      }
    }

    // -----------------------------------------------------------------------
    // 11. Tags
    // -----------------------------------------------------------------------
    const tags = [
      { name: "VIP", color: "#f59e0b" },
      { name: "Urgente", color: "#ef4444" },
      { name: "Parceiro", color: "#3b82f6" },
    ];

    for (const tag of tags) {
      const { data: exists } = await admin
        .from("tags")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", tag.name)
        .maybeSingle();

      if (exists) {
        addLog(`✅ Tag "${tag.name}" já existe`);
      } else {
        const { error } = await admin.from("tags").insert({
          tenant_id: tenantId,
          name: tag.name,
          color: tag.color,
        });
        if (error) addLog(`⚠️ Tag "${tag.name}": ${error.message}`);
        else addLog(`✅ Tag "${tag.name}" criada`);
      }
    }

    // -----------------------------------------------------------------------
    // 12. Thread + message
    // -----------------------------------------------------------------------
    if (channelId) {
      const { data: threadExists } = await admin
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
        const { data, error } = await admin
          .from("threads")
          .insert({
            tenant_id: tenantId,
            channel_id: channelId,
            subject: "Conversa Demo",
            status: "open",
            related_entity: "lead",
            related_entity_id: leadIds[0] || null,
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw new Error(`Thread: ${error.message}`);
        threadId = data.id;
        addLog(`✅ Thread demo criada: ${threadId}`);
      }

      const { data: msgExists } = await admin
        .from("messages")
        .select("id")
        .eq("thread_id", threadId)
        .limit(1)
        .maybeSingle();

      if (!msgExists) {
        await admin.from("messages").insert({
          tenant_id: tenantId,
          thread_id: threadId,
          sender_type: "system",
          content: "👋 Bem-vindo ao ChatBrain! Esta é uma conversa de demonstração.",
        });
        addLog(`✅ Mensagem demo criada`);
      } else {
        addLog(`✅ Mensagem demo já existe`);
      }

      // Second thread linked to a deal
      const { data: thread2Exists } = await admin
        .from("threads")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("subject", "Negociação ERP")
        .maybeSingle();

      if (!thread2Exists) {
        const { data: t2, error: t2err } = await admin
          .from("threads")
          .insert({
            tenant_id: tenantId,
            channel_id: channelId,
            subject: "Negociação ERP",
            status: "open",
            related_entity: "company",
            related_entity_id: companyIds[0] || null,
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (!t2err && t2) {
          await admin.from("messages").insert({
            tenant_id: tenantId,
            thread_id: t2.id,
            sender_type: "system",
            content: "📋 Thread criada para acompanhar a negociação do projeto ERP com Acme Corp.",
          });
          addLog(`✅ Thread "Negociação ERP" criada`);
        }
      } else {
        addLog(`✅ Thread "Negociação ERP" já existe`);
      }
    }

    // -----------------------------------------------------------------------
    // 13. Set active tenant
    // -----------------------------------------------------------------------
    await admin
      .from("profiles")
      .update({ active_tenant_id: tenantId })
      .eq("id", userId);
    addLog(`✅ active_tenant_id definido`);

    addLog(`\n✨ Seed concluído!`);
    addLog(`📧 Email: ${DEMO_EMAIL}`);
    addLog(`🔑 Senha: ${DEMO_PASSWORD}`);
    addLog(`🏢 Tenant: ${DEMO_TENANT_NAME}`);
    addLog(`🏗️ ${companyIds.length} empresas, ${leadIds.length} leads`);

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
