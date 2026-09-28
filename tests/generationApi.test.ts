import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import generate from '../api/generate';
import status from '../api/status';
import { generationQuota, quotaConfigured, QuotaError } from '../api/_lib/generationQuota';
vi.mock('../api/_lib/generationQuota', async (original) => { const actual = await original<typeof import('../api/_lib/generationQuota')>(); return { ...actual, quotaConfigured: vi.fn(), generationQuota: { status: vi.fn(), reserve: vi.fn(), finish: vi.fn() } }; });
import { createSampleProject } from '../src/data/sample';
import { buildGenerationPrompt, type GenerationImage, type GenerationRequest } from '../src/services/generationContract';

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
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('image generation API boundary', () => {
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
    expect(generationQuota.reserve).toHaveBeenCalledWith(requestId);
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
    expect(generationQuota.reserve).toHaveBeenCalledWith(requestId);
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
