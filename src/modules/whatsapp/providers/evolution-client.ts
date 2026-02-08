/**
 * Evolution API v2 client for sending messages.
 * Docs: https://doc.evolution-api.com/v2/api-reference/message-controller/send-text
 *
 * Sempre envia o header apikey com a chave (do banco por tenant ou env EVOLUTION_API_KEY no server).
 */

export interface EvolutionSendTextResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send plain text. "to" is the remote number (e.g. 5511999999999 or 5511999999999@s.whatsapp.net).
 * Evolution accepts number with or without @s.whatsapp.net.
 */
export async function sendTextMessage(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  to: string,
  content: string
): Promise<EvolutionSendTextResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`;
  const number = to.includes('@') ? to.split('@')[0]! : to;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey, // Evolution exige header apikey
    },
    body: JSON.stringify({ number, text: content }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `${res.status} ${text.slice(0, 200)}` };
  }
  const data = (await res.json()) as { key?: { id?: string }; messageId?: string };
  return { ok: true, messageId: data?.key?.id ?? data?.messageId };
}

export interface EvolutionSendMediaResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send media (image, audio, document, video). type: image | audio | document | video
 */
export async function sendMediaMessage(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  to: string,
  mediaUrl: string,
  caption?: string,
  type: 'image' | 'audio' | 'document' | 'video' = 'image'
): Promise<EvolutionSendMediaResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/message/sendMedia/${instanceName}`;
  const number = to.includes('@') ? to.split('@')[0]! : to;
  const body: Record<string, string> = {
    number,
    mediatype: type,
    media: mediaUrl,
  };
  if (caption) body.caption = caption;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey, // Evolution exige header apikey
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `${res.status} ${text.slice(0, 200)}` };
  }
  const data = (await res.json()) as { key?: { id?: string }; messageId?: string };
  return { ok: true, messageId: data?.key?.id ?? data?.messageId };
}
