/**
 * Simple in-memory rate limit by IP.
 * Use for webhook endpoint only; resets on process restart.
 */
const windowMs = 60 * 1000; // 1 minute
const maxPerWindow = 120;   // max requests per IP per minute

const store = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return (forwarded[0] ?? '').trim();
  return req.ip ?? 'unknown';
}

export function webhookRateLimit(
  req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  res: { status: (n: number) => { json: (o: object) => void }; setHeader: (k: string, v: string) => void },
  next: () => void
): void {
  const ip = getClientIp(req);
  const now = Date.now();
  let entry = store.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(ip, entry);
  }
  entry.count += 1;
  if (entry.count > maxPerWindow) {
    res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    res.status(429).json({ error: 'Too many requests' });
    return;
  }
  next();
}
