// WhatsApp webhook receiver (Deno). Call with ?connection_id=<uuid>
// GET: verify (hub.verify_token, hub.challenge); POST: parse body and process inbound message.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_TOKEN_KEY = "webhook_secret";

function parseConnectionIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.searchParams.get("connection_id");
  } catch {
    return null;
  }
}

// Mock-style verify: GET, hub.verify_token === expectedToken, return hub.challenge
function verifyMock(searchParams: URLSearchParams, expectedToken: string): string | null {
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (token !== expectedToken || !challenge) return null;
  return challenge;
}

// Mock-style parse: POST, JSON body with wa_id, name?, text?, media?
function parseMockBody(body: unknown, connectionId: string): {
  connectionId: string;
  wa_id: string;
  name: string | null;
  text: string | null;
  media?: { type: string; url?: string }[];
} | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const wa_id = typeof o.wa_id === "string" ? o.wa_id : null;
  if (!wa_id) return null;
  return {
    connectionId,
    wa_id,
    name: typeof o.name === "string" ? o.name : null,
    text: typeof o.text === "string" ? o.text : null,
    media: Array.isArray(o.media) ? (o.media as { type?: string; url?: string }[]) : undefined,
  };
}

async function getOrCreateThread(
  client: ReturnType<typeof createClient>,
  tenantId: string,
  connectionId: string,
  waId: string,
  subjectName?: string
): Promise<{ id: string }> {
  const { data: existing } = await client
    .from("whatsapp_thread_links")
    .select("thread_id")
    .eq("tenant_id", tenantId)
    .eq("connection_id", connectionId)
    .eq("wa_id", waId)
    .maybeSingle();

  if (existing?.thread_id) return { id: existing.thread_id };

  const { data: channels } = await client
    .from("channels")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("type", "whatsapp");
  let channelId = channels?.[0]?.id;
  if (!channelId) {
    const { data: newChannel, error: chErr } = await client
      .from("channels")
      .insert({
        tenant_id: tenantId,
        type: "whatsapp",
        name: "WhatsApp",
        is_active: true,
      })
      .select("id")
      .single();
    if (chErr) throw chErr;
    channelId = newChannel.id;
  }

  const { data: thread, error: threadErr } = await client
    .from("threads")
    .insert({
      tenant_id: tenantId,
      channel_id: channelId,
      subject: subjectName ? `WhatsApp ${subjectName}` : `WhatsApp ${waId}`,
      status: "open",
    })
    .select("id")
    .single();
  if (threadErr) throw threadErr;

  await client.from("whatsapp_thread_links").upsert(
    {
      tenant_id: tenantId,
      connection_id: connectionId,
      wa_id: waId,
      thread_id: thread.id,
    },
    { onConflict: "tenant_id,connection_id,wa_id" }
  );

  return { id: thread.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const connectionId = parseConnectionIdFromUrl(req.url);
  if (!connectionId) {
    return new Response(JSON.stringify({ error: "missing connection_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: connection, error: connError } = await client
    .from("whatsapp_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();

  if (connError || !connection) {
    return new Response(null, { status: 404, headers: corsHeaders });
  }

  const tenantId = connection.tenant_id;
  const metadata = (connection.metadata ?? {}) as Record<string, unknown>;
  const token = typeof metadata[WEBHOOK_TOKEN_KEY] === "string" ? metadata[WEBHOOK_TOKEN_KEY] : "";

  if (req.method === "GET") {
    const searchParams = new URL(req.url).searchParams;
    const challenge = verifyMock(searchParams, token);
    return new Response(challenge ?? "", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  if (req.method === "POST") {
    let body: unknown = null;
    const rawBody = await req.text();
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        // leave body null
      }
    }

    const parsed = parseMockBody(body, connectionId);
    if (parsed) {
      try {
        await client.from("whatsapp_contacts").upsert(
          {
            tenant_id: tenantId,
            connection_id: connectionId,
            wa_id: parsed.wa_id,
            name: parsed.name ?? null,
            phone_e164: null,
          },
          { onConflict: "tenant_id,connection_id,wa_id" }
        );

        const thread = await getOrCreateThread(
          client,
          tenantId,
          connectionId,
          parsed.wa_id,
          parsed.name ?? undefined
        );

        let content: string;
        if (parsed.text?.trim()) {
          content = parsed.text.trim();
        } else if (parsed.media?.length) {
          content = parsed.media
            .map((m) => {
              if (m.type === "audio") return "[audio]";
              if (m.type === "image") return "[image]";
              if (m.type === "video") return "[video]";
              if (m.type === "document") return "[document]";
              return `[${m.type}]`;
            })
            .join(" ");
        } else {
          content = "(mensagem vazia)";
        }

        const { data: message, error: msgError } = await client
          .from("messages")
          .insert({
            tenant_id: tenantId,
            thread_id: thread.id,
            sender_type: "external",
            sender_subtype: "whatsapp",
            content,
          })
          .select("id, created_at")
          .single();

        if (msgError) throw msgError;

        await client.from("threads").update({ last_message_at: message.created_at }).eq("id", thread.id);

        await client
          .from("whatsapp_thread_links")
          .update({ last_inbound_at: message.created_at })
          .eq("tenant_id", tenantId)
          .eq("connection_id", connectionId)
          .eq("wa_id", parsed.wa_id);

        try {
          await client.rpc("log_message_event", {
            _tenant_id: tenantId,
            _thread_id: thread.id,
            _message_id: message.id,
            _sender_type: "external",
          });
        } catch {
          // ignore
        }
      } catch (err) {
        console.error("[whatsapp-webhook] process error:", err);
      }
    }

    return new Response(null, { status: 200, headers: corsHeaders });
  }

  return new Response(null, { status: 200, headers: corsHeaders });
});
