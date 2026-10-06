import { planGuideManifest } from '../src/services/planGuide';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import generate from '../api/generate';
import status from '../api/status';
import { IDENTITY_COOKIE, signedIdentity } from '../api/_lib/generationIdentity';
import { generationQuota, quotaConfigured, QuotaError, GenerationQuota, dayInKorea, type QuotaState, type QuotaStore } from '../api/_lib/generationQuota';
vi.mock('../api/_lib/generationQuota', async (original) => { const actual = await original<typeof import('../api/_lib/generationQuota')>(); return { ...actual, quotaConfigured: vi.fn(), generationQuota: { status: vi.fn(), reserve: vi.fn(), finish: vi.fn() } }; });
import { createSampleProject } from '../src/data/sample';
import { createCampusProject } from '../src/data/campus';
import { prepareRecommendedCameras } from '../src/domain/cameraRecommendations';
import type { DesignElement, PlacementTarget, Structure } from '../src/domain/types';
import { buildGenerationPrompt, referenceSheetGroups, MAX_GENERATION_PROMPT_LENGTH, GenerationInputError, type GenerationImage, type GenerationRequest } from '../src/services/generationContract';

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
    { role: 'floor-plan', sourceId: 'floor-plan', dataUrl, planGuide: planGuideManifest(project, 'camera-entrance') },
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
  it('compacts mixed references and many preservation rules without dropping targets or partition faces', () => {
    const project = prepareRecommendedCameras(createCampusProject('exhibition'));
    const plan = project.floorPlan!;
    // Authored geometry/labels only; no participant export is committed.
    for (let i=0;i<10;i++) {
      const structure:Structure = { id:`extra-wall-${i}`,name:`추가 벽 ${i+1}`,kind:'wall',role:'partition',geometry:{kind:'segment',start:{x:.2,y:.2+i*.05},end:{x:.6,y:.2+i*.05}},protected:i<8,immutable:i<8 };
      plan.structures.push(structure);
      if(i<8)project.keeps.push({id:`keep-extra-${i}`,structureId:structure.id,intent:'preserve',description:`벽 ${i+1}의 형태와 위치를 유지하며 철거하지 않습니다.`});
      plan.areas.push({id:`extra-area-${i}`,name:`분위기 영역 ${i+1}`,kind:'spatial',bounds:{x:.2+i%5*.1,y:.2+Math.floor(i/5)*.2,width:.08,height:.15}});
    }
    plan.structures.push({id:'partition',name:'전시 가벽',kind:'wall',role:'partition',protected:false,geometry:{kind:'segment',start:{x:.3,y:.5},end:{x:.7,y:.5}}});
    for(let i=0;i<3;i++) {
      project.sourceImages.push({id:`extra-image-${i}`,role:'inspiration',name:`추가 참고 사진 ${i+1}.jpg`,uri:''});
      project.references.push({id:`extra-ref-${i}`,imageId:`extra-image-${i}`,role:'element',note:'',extractedElements:[],exclusions:[]});
    }
    const kinds:DesignElement['kind'][]=['freestanding-fixture','freestanding-fixture','display-product','standing-light','ceiling-light','wall-mounted-product','wall-graphic','wall-graphic','ambient-light','ambient-light','global-palette','global-palette','global-palette'];
    project.elements=kinds.map((kind,i)=>{
      const target:PlacementTarget = kind==='display-product'?{kind:'fixture-surface',fixtureElementId:'mixed-0',offset:{x:.5,y:.5}}
        :kind==='ceiling-light'?{kind:'ceiling-zone',zoneId:'ceiling-main',offset:{x:.3,y:.4}}
          :['wall-graphic','wall-mounted-product'].includes(kind)?{kind:'wall-segment',wallId:'partition',face:'a',start:.1,end:.3}
            :['ambient-light','global-palette'].includes(kind)?{kind:'named-area',areaId:`extra-area-${i-8}`}
              :{kind:'floor-point',x:.3+i*.04,y:.3,footprint:{width:.04,height:.04}};
      return {id:`mixed-${i}`,label:`배치 요소 ${i+1}`,kind,status:'apply',sourceReferenceId:project.references[i%6].id,target,appearance:`고유 형태 ${i+1}`,conditions:`개별 조건 ${i+1}: 주변 통로를 유지하고 해당 위치에만 적용합니다.`};
    });
    const sheets=referenceSheetGroups(project);
    const images:GenerationImage[]=[{role:'existing-space',sourceId:'campus-photo-front',dataUrl},{role:'floor-plan',sourceId:'floor-plan',dataUrl},...sheets.map((sheet,i)=>({role:'reference-sheet' as const,sourceId:`reference-sheet-${i}`,dataUrl,sheet}))];
    for (const [index,camera] of project.cameras.entries()) {
      camera.x=.5; camera.y=index===0?.25:.75;
      const prompt=buildGenerationPrompt(project,camera.id,images);
      expect(prompt.length).toBeLessThanOrEqual(MAX_GENERATION_PROMPT_LENGTH);
      expect(prompt).toContain('Shared object rules');
      for(const element of project.elements) {
        expect(prompt).toContain(`${element.label} [${element.kind}]`);
        expect(prompt).toContain(element.appearance!);expect(prompt).toContain(element.conditions!);
      }
      for(const keep of project.keeps)expect(prompt).toContain(keep.description);
      for(const area of plan.areas)expect(prompt).toContain(area.name);
      expect(prompt).toContain('on top of display support 배치 요소 1');
      expect(prompt).toContain('ONLY on A면');
      expect(prompt).toContain(index===0?'Camera is on the opposite face; hide this object':'Camera is on the decorated face; show only when in view');
      expect(prompt.match(/- Wall 창 쪽 벽:/g)).toHaveLength(1);
      expect(prompt.match(/- Wall 전시 가벽:/g)).toHaveLength(1);
    }
  });
  it('keeps all 20 school display targets and crop sources within the existing prompt limit', async () => {
    let project = createCampusProject('exhibition');
    const region = { x: .2, y: .2, width: .3, height: .3 };
    project.elements = Array.from({length:20}, (_, i) => ({ id:`display-${i}`, origin:'layout', layoutKind:'display', label:`전시대 ${i+1}`, kind:'freestanding-fixture', sourceReferenceId:'ref-product', sourceRegion:region, status:'apply', target:{kind:'floor-point',x:.25+i%5*.1,y:.25+Math.floor(i/5)*.14,footprint:{width:.04,height:.04}} }));
    project = prepareRecommendedCameras(project);
    const cameraId = project.cameras[0].id;
    const input: GenerationRequest = { project, cameraId, images:[
      {role:'existing-space',sourceId:'campus-photo-front',dataUrl},
      {role:'floor-plan',sourceId:'floor-plan',dataUrl,planGuide:planGuideManifest(project,cameraId)},
      {role:'inspiration',sourceId:'photo-product',dataUrl,referencePreparation:{mode:'crop',regions:[region]}},
    ] };
    const prompt = buildGenerationPrompt(project,cameraId,input.images);
    expect(prompt.length).toBeLessThanOrEqual(MAX_GENERATION_PROMPT_LENGTH);
    for (const element of project.elements) {
      expect(prompt).toContain(`${element.label} [freestanding-fixture]`);
      expect(prompt).toContain(`floor point (${Math.round(element.target!.kind==='floor-point'?element.target!.x*100:0)}%,`);
    }
    expect(prompt).toContain('Use entire selected crop');
    expect(prompt).toContain('Shared object rules');
    const upstream=vi.fn(async()=>({ok:true,json:async()=>({data:[{b64_json:jpeg}]})})); vi.stubGlobal('fetch',upstream);
    const {response,values}=responseStub(); await generate(requestStub(input),response);
    expect(values.statusCode).toBe(200);
    expect(generationQuota.reserve).toHaveBeenCalledTimes(1);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
  it('reports an overlong saved input as 400 without quota reservation or a model call', async () => {
    const input=sampleRequest();
    for(let i=0;i<80;i++) input.project.floorPlan!.areas.push({id:`area-${i}`,name:`분위기 영역 ${i} `+'상세 공간 설명 '.repeat(18),kind:'spatial',bounds:{x:.4,y:.4,width:.02,height:.02}});
    expect(()=>buildGenerationPrompt(input.project,input.cameraId,input.images)).toThrow(GenerationInputError);
    const upstream=vi.fn(); vi.stubGlobal('fetch',upstream);
    const {response,values}=responseStub(); await generate(requestStub(input),response);
    expect(values.statusCode).toBe(400);
    expect(JSON.parse(values.body)).toMatchObject({error:expect.stringContaining('생성 조건이 너무 길어'),outcomeUnknown:false});
    expect(values.body).not.toContain('호출 상한');
    expect(generationQuota.reserve).not.toHaveBeenCalled(); expect(upstream).not.toHaveBeenCalled();
  });
  it('distinguishes preparation faults from quota and logs only the stage and exception class', async () => {
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    const upstream=vi.fn(); vi.stubGlobal('fetch',upstream);
    vi.stubGlobal('FormData', class { constructor() { throw new Error('private input and credential must never be logged'); } });
    try {
      const {response,values}=responseStub(); await generate(requestStub(sampleRequest()),response);
      expect(values.statusCode).toBe(503); expect(values.body).toContain('생성 입력을 준비하지 못했습니다');
      expect(values.body).not.toContain('호출 상한');
      expect(log).toHaveBeenCalledWith('image generation failed',{stage:'preparation',type:'Error'});
      expect(JSON.stringify(log.mock.calls)).not.toContain('credential');
      expect(generationQuota.reserve).not.toHaveBeenCalled(); expect(upstream).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it('rejects a missing, stale or different-view plan guide before reserving paid quota', async () => {
    const upstream = vi.fn(); vi.stubGlobal('fetch', upstream);
    for (const defect of ['missing', 'revision', 'camera'] as const) {
      const input = sampleRequest();
      if (defect === 'missing') input.images.splice(1, 1);
      else if (defect === 'revision') input.images[1].planGuide!.commonRevision++;
      else input.images[1].planGuide!.cameraId = 'another-view';
      const { response, values } = responseStub();
      await generate(requestStub(input), response);
      expect(values.statusCode).toBe(400);
      expect(generationQuota.reserve).not.toHaveBeenCalled();
      expect(upstream).not.toHaveBeenCalled();
    }
  });
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
    nextInput.images[1].planGuide = planGuideManifest(nextInput.project, nextInput.cameraId);
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
    input.images=[input.images[0],input.images[1],...sheets.map((sheet,i)=>({role:'reference-sheet' as const,sourceId:`reference-sheet-${i}`,sheet,dataUrl}))];
    const call=vi.fn(async (_url:string,options:RequestInit)=>{
      const form=options.body as FormData;
      expect(form.getAll('image[]')).toHaveLength(input.images.length);
      expect(form.get('prompt')).toContain('numbered panel');
      return {ok:true,json:async()=>({data:[{b64_json:jpeg}]})};
    }); vi.stubGlobal('fetch',call);
    const {response,values}=responseStub(); await generate(requestStub(input),response);
    expect(values.statusCode).toBe(200); expect(call).toHaveBeenCalledTimes(1);
    vi.clearAllMocks(); input.images[2].sheet!.pop();
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
      expect(form.getAll('image[]')).toHaveLength(5);
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
