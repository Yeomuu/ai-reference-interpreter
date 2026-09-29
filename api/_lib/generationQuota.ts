import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

export const QUOTA_PATH = 'generation-quota/v1.json'; // Retain the existing shared ledger and ETag through migration.
export const TOTAL_LIMIT = 60; // All browsers per Korea day.
export const DAILY_LIMIT = 20; // One anonymous browser per Korea day.
const LEASE_MS = 240_000;
export interface QuotaState {
  version: 2; totalLimit: number; dailyLimit: number; day: string;
  reservations: { id: string; userId: string; at: number }[];
  legacyIds: string[];
  active: { id: string; until: number } | null;
}
export interface QuotaSnapshot { totalLimit: number; used: number; remaining: number; dailyLimit: number; dailyRemaining: number; busy: boolean; resetsAt?: string }
export interface QuotaStore {
  read(): Promise<{ state: QuotaState; etag: string }>;
  compareAndSwap(state: QuotaState, etag: string): Promise<boolean>;
  claimRequest(id: string, day: string): Promise<boolean>;
}
export class QuotaError extends Error { constructor(message: string, public status: number) { super(message); } }
export const validRequestId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export const dayInKorea = (now: number) => new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
const validUser = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id);
const validDay = (day: unknown): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day));
/** Version 1 keeps every previous UUID and same-day usage; no reset on deployment. */
export function validateQuota(value: unknown): QuotaState {
  if (!value || typeof value !== 'object') throw new Error('Invalid quota');
  const old = value as { version?: number; totalLimit?: number; dailyLimit?: number; reservations?: {id:string;day:string;at:number}[]; active?: {id:string;until:number}|null };
  if (old.version === 1) {
    if (!Number.isInteger(old.totalLimit) || old.totalLimit! < 1 || old.totalLimit! > TOTAL_LIMIT || !Number.isInteger(old.dailyLimit) || old.dailyLimit! < 1 || old.dailyLimit! > DAILY_LIMIT || !Array.isArray(old.reservations) || old.reservations.length > old.totalLimit! || old.reservations.some(r => !r || !validRequestId(r.id) || !validDay(r.day) || !Number.isSafeInteger(r.at) || r.at < 0) || new Set(old.reservations.map(r => r.id)).size !== old.reservations.length || old.active !== null && (!old.active || !validRequestId(old.active.id) || !Number.isSafeInteger(old.active.until) || !old.reservations.some(r => r.id === old.active?.id))) throw new Error('Invalid quota');
    const previousDays = old.reservations.map(r => r.day).sort();
    const day = previousDays[previousDays.length - 1] ?? '1970-01-01';
    return { version:2, totalLimit:old.totalLimit!, dailyLimit:old.dailyLimit!, day, legacyIds:old.reservations.map(r=>r.id), reservations:old.reservations.filter(r=>r.day===day).map(r=>({id:r.id,at:r.at,userId:'0'.repeat(64)})),active:old.active! };
  }
  const state = value as QuotaState;
  if (state.version !== 2 || !validDay(state.day) || !Number.isInteger(state.totalLimit) || state.totalLimit < 1 || state.totalLimit > TOTAL_LIMIT || !Number.isInteger(state.dailyLimit) || state.dailyLimit < 1 || state.dailyLimit > DAILY_LIMIT || !Array.isArray(state.legacyIds) || state.legacyIds.length > TOTAL_LIMIT || state.legacyIds.some(id=>!validRequestId(id)) || new Set(state.legacyIds).size !== state.legacyIds.length || !Array.isArray(state.reservations) || state.reservations.length > state.totalLimit || state.reservations.some(r=>!r || !validRequestId(r.id) || !validUser(r.userId) || !Number.isSafeInteger(r.at) || r.at < 0 || dayInKorea(r.at)!==state.day) || new Set(state.reservations.map(r=>r.id)).size !== state.reservations.length || state.active !== null && (!state.active || !validRequestId(state.active.id) || !Number.isSafeInteger(state.active.until) || !state.reservations.some(r=>r.id===state.active?.id))) throw new Error('Invalid quota');
  return state;
}
export function quotaConfigured(): boolean { return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN); }
const blobStore: QuotaStore = {
  async read() {
    const value = await get(QUOTA_PATH, {access:'private',useCache:false,abortSignal:AbortSignal.timeout(8_000)});
    if (!value?.stream || !value.blob.size || value.blob.size > 65_000) throw new Error('Quota unavailable');
    return {state:validateQuota(await new Response(value.stream).json()),etag:value.blob.etag};
  },
  async compareAndSwap(state, etag) {
    try { await put(QUOTA_PATH,JSON.stringify(state),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:etag,contentType:'application/json',abortSignal:AbortSignal.timeout(8_000)}); return true; }
    catch(error) { if (error instanceof BlobPreconditionFailedError) return false; throw error; }
  },
  async claimRequest(id, day) {
    const path = `generation-quota/requests/${id}.json`;
    try { await put(path,JSON.stringify({id,day}),{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',abortSignal:AbortSignal.timeout(8_000)}); return true; }
    catch(error) {
      // Distinguish an existing immutable claim from a storage failure. Never overwrite or delete claims.
      const existing = await get(path,{access:'private',useCache:false,abortSignal:AbortSignal.timeout(8_000)});
      if (existing?.stream && existing.blob.size < 1000) { const body:unknown = await new Response(existing.stream).json(); if (body && typeof body === 'object' && 'id' in body && body.id === id) return false; }
      throw error;
    }
  },
};
export class GenerationQuota {
  constructor(private store: QuotaStore) {}
  async status(userId: string, now = Date.now()): Promise<QuotaSnapshot> {
    const {state} = await this.store.read(); const day = dayInKorea(now), today = state.day === day ? state.reservations : [];
    return {totalLimit:state.totalLimit,used:today.length,remaining:state.totalLimit-today.length,dailyLimit:state.dailyLimit,dailyRemaining:Math.max(0,state.dailyLimit-today.filter(r=>r.userId===userId).length),busy:Boolean(state.active && state.active.until>now),resetsAt:new Date(Date.parse(`${day}T15:00:00Z`)).toISOString()};
  }
  async reserve(id: string, userId: string, now = Date.now()): Promise<void> {
    if (!validRequestId(id) || !validUser(userId)) throw new QuotaError('생성 요청과 익명 사용자 식별을 확인해 주세요.',400);
    let claimed = false; const day = dayInKorea(now);
    for(let attempt=0;attempt<6;attempt++) {
      const {state,etag}=await this.store.read(); const today=state.day===day?state.reservations:[];
      if(state.legacyIds.includes(id) || state.reservations.some(r=>r.id===id)) throw new QuotaError('이미 접수한 생성 요청입니다. 같은 요청을 다시 실행하지 않습니다.',409);
      if(today.length>=state.totalLimit) throw new QuotaError('오늘 서비스 전체 생성 한도를 모두 사용했습니다. 한국 시간 자정 이후 다시 사용할 수 있습니다.',429);
      if(today.filter(r=>r.userId===userId).length>=state.dailyLimit) throw new QuotaError('오늘 내 생성 횟수를 모두 사용했습니다. 한국 시간 자정 이후 다시 사용할 수 있습니다.',429);
      if(state.active && state.active.until>now) throw new QuotaError('현재 다른 이미지가 생성 중입니다. 완료 후 상태를 확인해 주세요.',409);
      if(!claimed) { if(!await this.store.claimRequest(id,day)) throw new QuotaError('이미 접수한 생성 요청입니다. 같은 요청을 다시 실행하지 않습니다.',409); claimed=true; }
      if(await this.store.compareAndSwap({...state,day,reservations:[...today,{id,userId,at:now}],active:{id,until:now+LEASE_MS}},etag)) return;
    }
    throw new QuotaError('다른 생성 요청이 접수 중입니다. 잠시 후 상태를 확인해 주세요.',409);
  }
  async finish(id: string): Promise<void> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const { state, etag } = await this.store.read();
      if (state.active?.id !== id) return;
      if (await this.store.compareAndSwap({ ...state, active: null }, etag)) return;
    }
    throw new QuotaError('생성 완료 상태를 저장하지 못했습니다. 잠시 후 생성 가능 여부를 확인해 주세요.', 503);
  }
}
export const generationQuota = new GenerationQuota(blobStore);
