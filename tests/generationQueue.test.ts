import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGenerationStatus } from '../src/services/imageProvider';
import { waitForGenerationSlot } from '../src/services/generationQueue';
import type { GenerationStatus } from '../src/services/generationContract';

vi.mock('../src/services/imageProvider', () => ({ getGenerationStatus: vi.fn() }));

const ready = {
  available: true,
  quota: { totalLimit: 60, used: 1, remaining: 59, dailyLimit: 20, dailyRemaining: 19, busy: false },
} as GenerationStatus;

beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); });
afterEach(() => { vi.useRealTimers(); });

describe('read-only readiness between paid views', () => {
  it('waits for an active lease to finish, then continues without a paid request or retry', async () => {
    vi.mocked(getGenerationStatus).mockResolvedValueOnce({ ...ready, quota: { ...ready.quota!, busy: true } }).mockResolvedValueOnce(ready);
    const onStatus = vi.fn();
    let continued = false;
    const wait = waitForGenerationSlot(onStatus).then(() => { continued = true; });
    await vi.advanceTimersByTimeAsync(1999);
    expect(continued).toBe(false);
    expect(getGenerationStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await wait;
    expect(continued).toBe(true);
    expect(getGenerationStatus).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenLastCalledWith(ready);
  });
  it.each([
    { ...ready, available: false },
    { ...ready, quota: undefined },
    { ...ready, quota: { ...ready.quota!, busy: undefined } },
    { ...ready, quota: { ...ready.quota!, dailyRemaining: NaN } },
    { ...ready, quota: { ...ready.quota!, remaining: -1 } },
  ])('stops before another paid view on unavailable or malformed status %#', async status => {
    vi.mocked(getGenerationStatus).mockResolvedValue(status as GenerationStatus);
    await expect(waitForGenerationSlot(vi.fn())).rejects.toThrow('확인하지 못했습니다');
    expect(getGenerationStatus).toHaveBeenCalledTimes(1);
  });
  it.each(['remaining', 'dailyRemaining'] as const)('stops without another view when %s is exhausted', async field => {
    vi.mocked(getGenerationStatus).mockResolvedValue({ ...ready, quota: { ...ready.quota!, [field]: 0 } });
    await expect(waitForGenerationSlot(vi.fn())).rejects.toThrow('생성');
    expect(getGenerationStatus).toHaveBeenCalledTimes(1);
  });
  it('bounds readiness waiting to 20 seconds instead of restarting a paid request', async () => {
    vi.mocked(getGenerationStatus).mockResolvedValue({ ...ready, quota: { ...ready.quota!, busy: true } });
    const wait = expect(waitForGenerationSlot(vi.fn())).rejects.toThrow('나머지 시점');
    await vi.advanceTimersByTimeAsync(20_000);
    await wait;
    expect(getGenerationStatus).toHaveBeenCalledTimes(10);
    expect(vi.getTimerCount()).toBe(0);
  });
});
