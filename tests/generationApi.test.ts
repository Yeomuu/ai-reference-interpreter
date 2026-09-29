import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import generate from '../api/generate';
import status from '../api/status';
import { IDENTITY_COOKIE, signedIdentity } from '../api/_lib/generationIdentity';
import { generationQuota, quotaConfigured, QuotaError, GenerationQuota, dayInKorea, type QuotaState, type QuotaStore } from '../api/_lib/generationQuota';
vi.mock('../api/_lib/generationQuota', async (original) => { const actual = await original<typeof import('../api/_lib/generationQuota')>(); return { ...actual, quotaConfigured: vi.fn(), generationQuota: { status: vi.fn(), reserve: vi.fn(), finish: vi.fn() } }; });
import { createSampleProject } from '../src/data/sample';
import { buildGenerationPrompt, referenceSheetGroups, type GenerationImage, type GenerationRequest } from '../src/services/generationContract';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]).toString('base64');
const dataUrl = `data:image/jpeg;base64,${jpeg}`;
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function responseStub() {
  const values: { statusCode: number; body: string; headers: Record<string, string> } = {
    statusCode: 200, body: '', headers: {},
  };
  const response = {
    get statusCode() { return values.statusCode; },
    set statusCode(value: number) { values.statusCode = value; },
    setHeader(name: string, value: string) { values.headers[name] = value; },
    end(body: string) { values.body = body; },
  } as unknown as ServerResponse;
  return { response, values };
}

function requestStub(body: unknown, id = requestId): IncomingMessage & { body: unknown } {
  return {
    method: 'POST',
    headers: {
      host: 'example.test', origin: 'https://example.test',
      cookie: `${IDENTITY_COOKIE}=${signedIdentity('cccccccc-cccc-4ccc-8ccc-cccccccccccc')}`,
      'content-type': 'application/json', 'x-generation-request-id': id,
    },
    body,
  } as unknown as IncomingMessage & { body: unknown };
}

function sampleRequest(): GenerationRequest {
  const project = createSampleProject();
  project.results = [];
  const images: GenerationImage[] = [
    { role: 'existing-space', sourceId: 'photo-existing', dataUrl },
    { role: 'inspiration', sourceId: 'photo-atmosphere', dataUrl },
    { role: 'inspiration', sourceId: 'photo-graphic', dataUrl },
    { role: 'product', sourceId: 'photo-product', dataUrl },
  ];
  return { project, cameraId: 'camera-entrance', images };
}

beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('OPENAI_API_KEY', 'test-key');
  vi.mocked(quotaConfigured).mockReturnValue(true);
  vi.mocked(generationQuota.status).mockResolvedValue({ totalLimit:60, used:0, remaining:60, dailyLimit:20, dailyRemaining:20, busy:false });
  vi.mocked(generationQuota.reserve).mockResolvedValue(); vi.mocked(generationQuota.finish).mockResolvedValue();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('image generation API boundary', () => {
  it('does not expose a finished image until its active server lease is released', async () => {
    let release!: () => void, entered!: () => void;
    const releaseGate = new Promise<void>(resolve => { release = resolve; });
    const enteredFinish = new Promise<void>(resolve => { entered = resolve; });
    vi.mocked(generationQuota.finish).mockImplementationOnce(async () => { entered(); await releaseGate; });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: jpeg }] }) })));
    const { response, values } = responseStub();
    const running = generate(requestStub(sampleRequest()), response);
    await enteredFinish;
    const beforeRelease = values.body;
    release();
    await running;
    expect(beforeRelease).toBe('');
    expect(values.statusCode).toBe(200);
    expect(JSON.parse(values.body).imageDataUrl).toBe(dataUrl);
  });
  it('accepts the next view immediately on receipt of the previous response with a real quota ledger', async () => {
    let state: QuotaState = { version: 2, totalLimit: 60, dailyLimit: 20, day: dayInKorea(Date.now()), reservations: [], legacyIds: [], active: null };
    let revision = 0;
    const claims = new Set<string>();
    const store: QuotaStore = {
      async read() { return { state: structuredClone(state), etag: String(revision) }; },
      async compareAndSwap(next, etag) { if (etag !== String(revision)) return false; state = structuredClone(next); revision++; return true; },
      async claimRequest(id) { if (claims.has(id)) return false; claims.add(id); return true; },
    };
    const quota = new GenerationQuota(store);
    vi.mocked(generationQuota.reserve).mockImplementation((id, userId) => quota.reserve(id, userId));
    vi.mocked(generationQuota.finish).mockImplementation(async id => {
      await new Promise(resolve => setTimeout(resolve, 10));
      await quota.finish(id);
    });
    const upstream = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: jpeg }] }) }));
    vi.stubGlobal('fetch', upstream);
    const nextRequestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const nextInput = sampleRequest();
    nextInput.project.cameras.push({ ...nextInput.project.cameras[0], id: 'camera-side', name: '추가 시점', x: 0.75, y: 0.7, primary: false });
    nextInput.cameraId = 'camera-side';
    const next = responseStub();
    let nextRunning: Promise<void> | undefined;
    const first = responseStub();
    const finishResponse = first.response.end.bind(first.response);
    first.response.end = ((body: string) => {
      finishResponse(body);
      nextRunning = generate(requestStub(nextInput, nextRequestId), next.response);
    }) as ServerResponse['end'];
    await generate(requestStub(sampleRequest()), first.response);
    await nextRunning;
    expect(first.values.statusCode).toBe(200);
    expect(next.values.statusCode).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(state.active).toBeNull();
    expect(state.reservations.map(item => item.id)).toEqual([requestId, nextRequestId]);
    const replay = responseStub();
    await generate(requestStub(sampleRequest()), replay.response);
    expect(replay.values.statusCode).toBe(409);
    expect(upstream).toHaveBeenCalledTimes(2);
  });
  it('retains the paid image response if completion storage is unavailable without another provider call', async () => {
    vi.mocked(generationQuota.finish).mockRejectedValueOnce(new Error('storage unavailable'));
    const upstream = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: jpeg }] }) }));
    vi.stubGlobal('fetch', upstream);
    const { response, values } = responseStub();
    await generate(requestStub(sampleRequest()), response);
    expect(values.statusCode).toBe(200);
    expect(JSON.parse(values.body).imageDataUrl).toBe(dataUrl);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(generationQuota.reserve).toHaveBeenCalledTimes(1);
    expect(generationQuota.finish).toHaveBeenCalledTimes(1);
  });
  it('bounds stalled completion storage so an already paid image still reaches the client', async () => {
    vi.useFakeTimers();
    let release!: () => void, entered!: () => void;
    const releaseGate = new Promise<void>(resolve => { release = resolve; });
    const enteredFinish = new Promise<void>(resolve => { entered = resolve; });
    vi.mocked(generationQuota.finish).mockImplementationOnce(async () => { entered(); await releaseGate; });
    const upstream = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: jpeg }] }) }));
    vi.stubGlobal('fetch', upstream);
    const { response, values } = responseStub();
    const running = generate(requestStub(sampleRequest()), response);
    await enteredFinish;
    await vi.advanceTimersByTimeAsync(8_000);
    await running;
    release();
    expect(values.statusCode).toBe(200);
    expect(JSON.parse(values.body).imageDataUrl).toBe(dataUrl);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('requires the anonymous cookie before reserving or calling the provider', async () => {
    const call=vi.fn(); vi.stubGlobal('fetch',call);
    const request=requestStub(sampleRequest()); delete request.headers.cookie;
    const {response,values}=responseStub(); await generate(request,response);
    expect(values.statusCode).toBe(403); expect(generationQuota.reserve).not.toHaveBeenCalled(); expect(call).not.toHaveBeenCalled();
  });
  it('packs every applied source with no reference count cap and validates its manifest', async () => {
    const input=sampleRequest();
    for(let i=0;i<7;i++) {
      input.project.sourceImages.push({id:`source-${i}`,name:`참고 ${i}`,role:'inspiration',uri:'/sample/atmosphere.png'});
      input.project.references.push({id:`ref-${i}`,imageId:`source-${i}`,role:'ambience',note:'',extractedElements:[`el-${i}`],exclusions:[]});
      input.project.elements.push({id:`el-${i}`,sourceReferenceId:`ref-${i}`,label:`분위기 ${i}`,kind:'ambient-light',status:'apply',target:{kind:'whole-space'}});
    }
    const sheets=referenceSheetGroups(input.project);
    expect(sheets.flat()).toHaveLength(10); expect(sheets.length).toBeLessThanOrEqual(3);
    input.images=[input.images[0],...sheets.map((sheet,i)=>({role:'reference-sheet' as const,sourceId:`reference-sheet-${i}`,sheet,dataUrl}))];
    const call=vi.fn(async (_url:string,options:RequestInit)=>{
      const form=options.body as FormData;
      expect(form.getAll('image[]')).toHaveLength(input.images.length);
      expect(form.get('prompt')).toContain('numbered panel');
      return {ok:true,json:async()=>({data:[{b64_json:jpeg}]})};
    }); vi.stubGlobal('fetch',call);
    const {response,values}=responseStub(); await generate(requestStub(input),response);
    expect(values.statusCode).toBe(200); expect(call).toHaveBeenCalledTimes(1);
    vi.clearAllMocks(); input.images[1].sheet!.pop();
    await generate(requestStub(input),response);
    expect(values.statusCode).toBe(400); expect(call).not.toHaveBeenCalled(); expect(generationQuota.reserve).not.toHaveBeenCalled();
  });
  it('reports quota availability without calling a model', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const { response, values } = responseStub();
    await status({ method: 'GET', headers: {} } as IncomingMessage, response);
    expect(values.statusCode).toBe(200);
    expect(JSON.parse(values.body)).toMatchObject({
      available: true, requiresAccessCode: false, quota: { remaining: 60 },
      model: 'gpt-image-1-mini', quality: 'low', size: '1536x1024', outputPriceUsd: 0.006,
    });
  });

  it('fails closed without quota configuration or if quota reads fail', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const call = vi.fn(); vi.stubGlobal('fetch', call);
    vi.mocked(quotaConfigured).mockReturnValue(false);
    const { response, values } = responseStub();
    await generate(requestStub(sampleRequest()), response);
    expect(values.statusCode).toBe(503); expect(call).not.toHaveBeenCalled();
    vi.mocked(quotaConfigured).mockReturnValue(true);
    vi.mocked(generationQuota.status).mockRejectedValueOnce(new Error('store unavailable'));
    await status({ method: 'GET', headers: {} } as IncomingMessage, response);
    expect(JSON.parse(values.body).available).toBe(false);
  });
  it('rejects a missing request ID and cross-site origin before paid usage', async () => {
    const call = vi.fn(); vi.stubGlobal('fetch', call);
    const { response, values } = responseStub();
    await generate(requestStub(sampleRequest(), 'invalid'), response);
    expect(values.statusCode).toBe(400);
    const request = requestStub(sampleRequest()); delete request.headers.origin;
    await generate(request, response); expect(values.statusCode).toBe(403);
    expect(generationQuota.reserve).not.toHaveBeenCalled(); expect(call).not.toHaveBeenCalled();
  });
  it('stops at the global cap or a storage fault without a provider call', async () => {
    const call = vi.fn(); vi.stubGlobal('fetch', call);
    const { response, values } = responseStub();
    vi.mocked(generationQuota.reserve).mockRejectedValueOnce(new QuotaError('전체 횟수 소진', 429));
    await generate(requestStub(sampleRequest()), response); expect(values.statusCode).toBe(429);
    vi.mocked(generationQuota.reserve).mockRejectedValueOnce(new Error('storage failure'));
    await generate(requestStub(sampleRequest()), response); expect(values.statusCode).toBe(503);
    expect(call).not.toHaveBeenCalled(); expect(generationQuota.finish).not.toHaveBeenCalled();
  });
  it('records an uncertain upstream outcome without refunding the reservation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network lost')));
    const { response, values } = responseStub();
    await generate(requestStub(sampleRequest()), response);
    expect(values.statusCode).toBe(502); expect(JSON.parse(values.body).outcomeUnknown).toBe(true);
    expect(generationQuota.reserve).toHaveBeenCalledWith(requestId, expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(generationQuota.finish).toHaveBeenCalledWith(requestId);
  });
  it('rejects omitted applied references without a paid call', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const call = vi.fn();
    vi.stubGlobal('fetch', call);
    const input = sampleRequest();
    input.images.pop();
    const { response, values } = responseStub();
    await generate(requestStub(input), response);
    expect(values.statusCode).toBe(400);
    expect(values.body).toContain('빠졌습니다');
    expect(call).not.toHaveBeenCalled();
    expect(generationQuota.reserve).not.toHaveBeenCalled();
  });

  it('sends exactly one low-cost image edit only after valid preflight', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const call = vi.fn(async (_url: string, options: RequestInit) => {
      const form = options.body as FormData;
      expect(form.get('model')).toBe('gpt-image-1-mini');
      expect(form.get('quality')).toBe('low');
      expect(form.get('size')).toBe('1536x1024');
      expect(form.get('n')).toBe('1');
      expect(form.get('input_fidelity')).toBe('low');
      expect(form.getAll('image[]')).toHaveLength(4);
      return { ok: true, json: async () => ({ data: [{ b64_json: jpeg }] }) };
    });
    vi.stubGlobal('fetch', call);
    const { response, values } = responseStub();
    await generate(requestStub(sampleRequest()), response);
    expect(call).toHaveBeenCalledTimes(1);
    expect(generationQuota.reserve).toHaveBeenCalledWith(requestId, expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(generationQuota.finish).toHaveBeenCalledWith(requestId);
    expect(values.statusCode).toBe(200);
    expect(JSON.parse(values.body).imageDataUrl).toBe(dataUrl);
  });

  it('keeps room and product roles separate in the generated prompt', () => {
    const input = sampleRequest();
    const prompt = buildGenerationPrompt(input.project, input.cameraId, input.images);
    expect(prompt).toContain('existing-space: 기존 공간 사진');
    expect(prompt).toContain('product: 레퍼런스 A · 곡선형 진열대');
    expect(prompt).toContain('후면 창');
    expect(prompt).toContain('Do not add 차가운 청색 조명');
    expect(prompt).toContain('270 degrees');
  });
});
