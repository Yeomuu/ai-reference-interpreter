import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
export const IDENTITY_COOKIE = 'ari-generation-user';
function signature(id: string): string {
  const secret = process.env.GENERATION_IDENTITY_SECRET || process.env.OPENAI_API_KEY;
  if (!secret) throw new Error('Generation identity unavailable');
  return createHmac('sha256', secret).update(`generation-browser:v1:${id}`).digest('hex');
}
export function signedIdentity(id: string): string { return `${id}.${signature(id)}`; }
/** An anonymous signed browser identity; never an account, IP address or study participant ID. */
export function generationIdentity(request: IncomingMessage, response?: ServerResponse): string | null {
  const raw = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${IDENTITY_COOKIE}=`))?.slice(IDENTITY_COOKIE.length + 1);
  const parts = raw?.split('.') ?? [], [id, sig] = parts;
  if (parts.length === 2 && id && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) && sig && /^[0-9a-f]{64}$/.test(sig) && timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(signature(id), 'hex'))) return createHash('sha256').update(id).digest('hex');
  if (!response) return null;
  const next = randomUUID();
  const secure = request.headers['x-forwarded-proto'] !== 'http' && !request.headers.host?.startsWith('localhost');
  response.setHeader('Set-Cookie', `${IDENTITY_COOKIE}=${signedIdentity(next)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure ? '; Secure' : ''}`);
  return createHash('sha256').update(next).digest('hex');
}
