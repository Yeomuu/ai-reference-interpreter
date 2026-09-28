import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

export const QUOTA_PATH = 'generation-quota/v1.json';
export const TOTAL_LIMIT = 60;
export const DAILY_LIMIT = 20;
const LEASE_MS = 240_000; // Longer than the 180 s function and 170 s upstream deadline.
export interface QuotaState {
  version: 1; totalLimit: number; dailyLimit: number;
  reservations: { id: string; day: string; at: number }[];
  active: { id: string; until: number } | null;
}
export interface QuotaSnapshot { totalLimit: number; used: number; remaining: number; dailyLimit: number; dailyRemaining: number; busy: boolean }
export interface QuotaStore {
  read(): Promise<{ state: QuotaState; etag: string }>;
  compareAndSwap(state: QuotaState, etag: string): Promise<boolean>;
}
export class QuotaError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export const validRequestId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const dayInKorea = (now: number) => new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
export function validateQuota(value: unknown): QuotaState {
  if (!value || typeof value !== 'object') throw new Error('Invalid quota');
  const state = value as QuotaState;
  if (state.version !== 1 || !Number.isInteger(state.totalLimit) || state.totalLimit < 1 || state.totalLimit > TOTAL_LIMIT ||
      !Number.isInteger(state.dailyLimit) || state.dailyLimit < 1 || state.dailyLimit > DAILY_LIMIT ||
      !Array.isArray(state.reservations) || state.reservations.length > state.totalLimit ||
      state.reservations.some(r => !r || !validRequestId(r.id) || !/^\d{4}-\d{2}-\d{2}$/.test(r.day) || !Number.isSafeInteger(r.at) || r.at < 0) ||
      new Set(state.reservations.map(r => r.id)).size !== state.reservations.length ||
      (state.active !== null && (!state.active || !validRequestId(state.active.id) ||
        !Number.isSafeInteger(state.active.until) || !state.reservations.some(r => r.id === state.active?.id)))) throw new Error('Invalid quota');
  return state;
}
export function quotaConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
}
const blobStore: QuotaStore = {
  async read() {
    const value = await get(QUOTA_PATH, { access: 'private', useCache: false, abortSignal: AbortSignal.timeout(8_000) });
    // Never initialize/reset in the public endpoint. Missing or corrupt state fails closed.
    if (!value?.stream || !value.blob.size || value.blob.size > 65_000) throw new Error('Quota unavailable');
    return { state: validateQuota(await new Response(value.stream).json()), etag: value.blob.etag };
  },
  async compareAndSwap(state, etag) {
    try {
      await put(QUOTA_PATH, JSON.stringify(state), { access: 'private', addRandomSuffix: false,
        allowOverwrite: true, ifMatch: etag, contentType: 'application/json', abortSignal: AbortSignal.timeout(8_000) });
      return true;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) return false;
      throw error;
    }
  },
};
/** One durable counter is shared by all users, function instances, Production and Preview. */
export class GenerationQuota {
  constructor(private store: QuotaStore) {}
  async status(now = Date.now()): Promise<QuotaSnapshot> {
    const { state } = await this.store.read();
    return { totalLimit: state.totalLimit, used: state.reservations.length,
      remaining: state.totalLimit - state.reservations.length, dailyLimit: state.dailyLimit,
      dailyRemaining: Math.max(0, state.dailyLimit - state.reservations.filter(r => r.day === dayInKorea(now)).length),
      busy: Boolean(state.active && state.active.until > now) };
  }
  async reserve(id: string, now = Date.now()): Promise<void> {
    if (!validRequestId(id)) throw new QuotaError('생성 요청 번호를 확인해 주세요.', 400);
    for (let attempt = 0; attempt < 6; attempt++) {
      const { state, etag } = await this.store.read();
      if (state.reservations.some(r => r.id === id)) throw new QuotaError('이미 접수한 생성 요청입니다. 같은 요청을 다시 실행하지 않습니다.', 409);
      if (state.reservations.length >= state.totalLimit) throw new QuotaError('전체 AI 생성 횟수를 모두 사용했습니다. 무료 샘플과 편집은 계속 사용할 수 있습니다.', 429);
      const day = dayInKorea(now);
      if (state.reservations.filter(r => r.day === day).length >= state.dailyLimit) throw new QuotaError('오늘의 AI 생성 횟수를 모두 사용했습니다. 한국 시간 자정 이후 다시 사용할 수 있습니다.', 429);
      if (state.active && state.active.until > now) throw new QuotaError('현재 다른 이미지가 생성 중입니다. 완료 후 상태를 확인해 주세요.', 409);
      const next: QuotaState = { ...state, reservations: [...state.reservations, { id, day, at: now }], active: { id, until: now + LEASE_MS } };
      if (await this.store.compareAndSwap(next, etag)) return;
    }
    throw new QuotaError('다른 생성 요청이 접수 중입니다. 잠시 후 상태를 확인해 주세요.', 409);
  }
  async finish(id: string): Promise<void> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const { state, etag } = await this.store.read();
      if (state.active?.id !== id) return;
      if (await this.store.compareAndSwap({ ...state, active: null }, etag)) return;
    }
    // A failed release retains the lease until expiry; reservations are never refunded.
  }
}
export const generationQuota = new GenerationQuota(blobStore);
