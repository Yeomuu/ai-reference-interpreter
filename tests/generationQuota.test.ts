import { describe, it, expect } from 'vitest';
import { GenerationQuota, validateQuota, type QuotaState, type QuotaStore } from '../api/_lib/generationQuota';
const uuid = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const now = Date.UTC(2026, 8, 28, 1);
function memoryStore(totalLimit = 60, dailyLimit = 20) {
  let state: QuotaState = { version:1, totalLimit, dailyLimit, reservations:[], active:null }, revision = 0;
  const store: QuotaStore = {
    async read() { return { state: structuredClone(state), etag: String(revision) }; },
    async compareAndSwap(next, etag) { if (etag !== String(revision)) return false; state = structuredClone(next); revision++; return true; },
  };
  return { store, state: () => state };
}
describe('durable shared generation quota', () => {
  it('lets exactly one racing instance reserve, and rejects the same ID after release', async () => {
    const { store, state } = memoryStore();
    const one = new GenerationQuota(store), two = new GenerationQuota(store);
    const outcomes = await Promise.allSettled([one.reserve(uuid(1), now), two.reserve(uuid(2), now)]);
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
    expect(state().reservations).toHaveLength(1);
    const id = state().reservations[0].id; await two.finish(id);
    await expect(one.reserve(id, now + 1000)).rejects.toMatchObject({ status:409 });
    expect(state().reservations).toHaveLength(1);
  });
  it('never exceeds the lifetime cap through different days or instances', async () => {
    const { store, state } = memoryStore(3, 2);
    for (let n = 1; n <= 3; n++) {
      const instance = new GenerationQuota(store); await instance.reserve(uuid(n), now + n * 86400_000); await instance.finish(uuid(n));
    }
    await expect(new GenerationQuota(store).reserve(uuid(4), now + 10 * 86400_000)).rejects.toMatchObject({ status:429 });
    expect(state().reservations).toHaveLength(3);
  });
  it('uses Korean midnight for the daily cap while retaining total usage', async () => {
    const { store } = memoryStore(5, 2), quota = new GenerationQuota(store);
    const beforeMidnight = Date.UTC(2026, 8, 28, 14, 59);
    for (let n = 1; n <= 2; n++) { await quota.reserve(uuid(n), beforeMidnight); await quota.finish(uuid(n)); }
    await expect(quota.reserve(uuid(3), beforeMidnight)).rejects.toMatchObject({ status:429 });
    await quota.reserve(uuid(3), beforeMidnight + 60_000);
    expect(await quota.status(beforeMidnight + 60_000)).toMatchObject({ used:3, remaining:2, dailyRemaining:1 });
  });
  it('retains usage and waits for a lease after interruption, and a stale finish cannot release the next request', async () => {
    const { store } = memoryStore(), quota = new GenerationQuota(store);
    await quota.reserve(uuid(1), now);
    await expect(quota.reserve(uuid(2), now + 180_000)).rejects.toMatchObject({ status:409 });
    await quota.reserve(uuid(2), now + 241_000); await quota.finish(uuid(1));
    expect(await quota.status(now + 241_000)).toMatchObject({ used:2, busy:true });
    await quota.finish(uuid(2)); expect(await quota.status(now + 241_000)).toMatchObject({ used:2, busy:false });
  });
  it('rejects corrupt, duplicate or expanded quota state', () => {
    const state: QuotaState = { version:1, totalLimit:60, dailyLimit:20, reservations:[], active:null };
    expect(() => validateQuota({ ...state, totalLimit:61 })).toThrow();
    expect(() => validateQuota({ ...state, reservations:[{ id:uuid(1), day:'2026-09-28', at:now }, { id:uuid(1), day:'2026-09-28', at:now }] })).toThrow();
    expect(() => validateQuota(null)).toThrow();
    expect(() => validateQuota(state)).not.toThrow();
  });
});
