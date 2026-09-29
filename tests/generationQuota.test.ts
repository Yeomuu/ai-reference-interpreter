import { describe, it, expect } from 'vitest';
import { GenerationQuota, validateQuota, dayInKorea, type QuotaState, type QuotaStore } from '../api/_lib/generationQuota';
const uuid = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const userA = 'a'.repeat(64), userB = 'b'.repeat(64), userC = 'c'.repeat(64);
const now = Date.UTC(2026, 8, 28, 1);
function memoryStore(totalLimit = 60, dailyLimit = 20, initial?: QuotaState) {
  let state: QuotaState = initial ?? { version:2, totalLimit, dailyLimit, day:dayInKorea(now), reservations:[], legacyIds:[], active:null }, revision = 0;
  const claims = new Set<string>();
  const store: QuotaStore = {
    async read() { return { state: structuredClone(state), etag: String(revision) }; },
    async compareAndSwap(next, etag) { if (etag !== String(revision)) return false; state = structuredClone(next); revision++; return true; },
    async claimRequest(id) { if (claims.has(id)) return false; claims.add(id); return true; },
  };
  return { store, state: () => state };
}
describe('durable daily browser and service quotas', () => {
  it('lets one racing instance reserve and rejects the same ID after release', async () => {
    const { store, state } = memoryStore();
    const one = new GenerationQuota(store), two = new GenerationQuota(store);
    const outcomes = await Promise.allSettled([one.reserve(uuid(1), userA, now), two.reserve(uuid(2), userB, now)]);
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
    expect(state().reservations).toHaveLength(1);
    const id = state().reservations[0].id; await two.finish(id);
    await expect(one.reserve(id, userA, now + 1000)).rejects.toMatchObject({ status:409 });
    expect(state().reservations).toHaveLength(1);
  });
  it('enforces 20 per browser independently and 60 across all browsers', async () => {
    const { store } = memoryStore(), quota = new GenerationQuota(store);
    for (let n=0; n<60; n++) {
      const id=uuid(n+1), user=[userA,userB,userC][Math.floor(n/20)];
      await quota.reserve(id,user,now); await quota.finish(id);
      if (n===19) {
        expect(await quota.status(userA,now)).toMatchObject({remaining:40,dailyRemaining:0});
        expect(await quota.status(userB,now)).toMatchObject({remaining:40,dailyRemaining:20});
        await expect(quota.reserve(uuid(100),userA,now)).rejects.toMatchObject({status:429});
      }
    }
    await expect(quota.reserve(uuid(100), 'd'.repeat(64),now)).rejects.toMatchObject({status:429});
    expect(await quota.status(userA,now)).toMatchObject({used:60,remaining:0,dailyRemaining:0});
  });
  it('resets both limits at Korean midnight but rejects a previous-day replay', async () => {
    const { store } = memoryStore(3,2), quota = new GenerationQuota(store);
    const beforeMidnight=Date.UTC(2026,8,28,14,59), afterMidnight=beforeMidnight+60_000;
    for (let n=1;n<=2;n++) { await quota.reserve(uuid(n),userA,beforeMidnight); await quota.finish(uuid(n)); }
    await quota.reserve(uuid(3),userB,beforeMidnight); await quota.finish(uuid(3));
    expect(await quota.status(userA,beforeMidnight)).toMatchObject({remaining:0,dailyRemaining:0,resetsAt:'2026-09-28T15:00:00.000Z'});
    expect(await quota.status(userA,afterMidnight)).toMatchObject({used:0,remaining:3,dailyRemaining:2});
    await quota.reserve(uuid(4),userA,afterMidnight); await quota.finish(uuid(4));
    await expect(quota.reserve(uuid(1),userA,afterMidnight)).rejects.toMatchObject({status:409});
    expect(await quota.status(userA,afterMidnight)).toMatchObject({used:1,remaining:2,dailyRemaining:1});
  });
  it('retains reservations on failure; a stale finish cannot release a later request', async () => {
    const { store } = memoryStore(), quota=new GenerationQuota(store);
    await quota.reserve(uuid(1),userA,now);
    await expect(quota.reserve(uuid(2),userB,now+180_000)).rejects.toMatchObject({status:409});
    await quota.reserve(uuid(2),userB,now+241_000); await quota.finish(uuid(1));
    expect(await quota.status(userA,now+241_000)).toMatchObject({used:2,busy:true,dailyRemaining:19});
    await quota.finish(uuid(2)); expect(await quota.status(userB,now+241_000)).toMatchObject({used:2,busy:false,dailyRemaining:19});
  });
  it('preserves old usage and IDs when migrating the deployed lifetime ledger', async () => {
    const initial=validateQuota({version:1,totalLimit:60,dailyLimit:20,reservations:[{id:uuid(1),day:'2026-09-27',at:now-86400_000},{id:uuid(2),day:'2026-09-28',at:now}],active:null});
    const {store}=memoryStore(60,20,initial), quota=new GenerationQuota(store);
    expect(await quota.status(userA,now)).toMatchObject({used:1,remaining:59,dailyRemaining:20});
    await expect(quota.reserve(uuid(1),userA,now+86400_000)).rejects.toMatchObject({status:409});
    await quota.reserve(uuid(3),userA,now); await quota.finish(uuid(3));
    expect(await quota.status(userA,now)).toMatchObject({used:2,dailyRemaining:19});
  });
  it('fails closed on read, claim and compare-and-swap storage faults', async () => {
    for (const operation of ['read','claimRequest','compareAndSwap'] as const) {
      const {store,state}=memoryStore(); store[operation]=async () => { throw new Error('storage unavailable'); };
      await expect(new GenerationQuota(store).reserve(uuid(1),userA,now)).rejects.toThrow('storage unavailable');
      expect(state().reservations).toHaveLength(0);
    }
  });
  it('cannot reuse a claimed ID after all write races fail', async () => {
    const {store,state}=memoryStore(); store.compareAndSwap=async()=>false;
    const quota=new GenerationQuota(store);
    await expect(quota.reserve(uuid(1),userA,now)).rejects.toMatchObject({status:409});
    await expect(quota.reserve(uuid(1),userA,now+1000)).rejects.toMatchObject({status:409});
    expect(state().reservations).toHaveLength(0);
  });
  it('reports failed lease release and keeps the reservation and active lock after write races', async () => {
    const { store, state } = memoryStore(), quota = new GenerationQuota(store);
    await quota.reserve(uuid(1), userA, now);
    store.compareAndSwap = async () => false;
    await expect(quota.finish(uuid(1))).rejects.toMatchObject({ status: 503 });
    expect(state().reservations).toHaveLength(1);
    expect(state().active?.id).toBe(uuid(1));
    await expect(quota.reserve(uuid(2), userB, now + 1000)).rejects.toMatchObject({ status: 409 });
  });
  it('rejects corrupt, duplicate or expanded state', () => {
    const {state}=memoryStore();
    expect(()=>validateQuota({...state(),totalLimit:61})).toThrow();
    expect(()=>validateQuota({...state(),reservations:[{id:uuid(1),userId:userA,at:now},{id:uuid(1),userId:userB,at:now}]})).toThrow();
    expect(()=>validateQuota({...state(),day:'2026-09-27',reservations:[{id:uuid(1),userId:userA,at:now}]})).toThrow();
    expect(()=>validateQuota(null)).toThrow();
    expect(()=>validateQuota(state())).not.toThrow();
  });
});
