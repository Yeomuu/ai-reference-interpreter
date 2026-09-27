import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import generate from '../api/generate';
import status from '../api/status';
import { createSampleProject } from '../src/data/sample';
import { buildGenerationPrompt, MIN_GENERATION_ACCESS_CODE_LENGTH, type GenerationImage, type GenerationRequest } from '../src/services/generationContract';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]).toString('base64');
const dataUrl = `data:image/jpeg;base64,${jpeg}`;
const testAccessCode = 'a'.repeat(MIN_GENERATION_ACCESS_CODE_LENGTH);

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

function requestStub(body: unknown, code = testAccessCode): IncomingMessage & { body: unknown } {
  return {
    method: 'POST',
    headers: {
      host: 'example.test', origin: 'https://example.test',
      'content-type': 'application/json', 'x-generation-access-code': code,
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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('image generation API boundary', () => {
  it('reports availability without calling a model', () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('GENERATION_ACCESS_CODE', testAccessCode);
    const { response, values } = responseStub();
    status({ method: 'GET' } as IncomingMessage, response);
    expect(values.statusCode).toBe(200);
    expect(JSON.parse(values.body)).toMatchObject({
      available: true, requiresAccessCode: true,
      model: 'gpt-image-1-mini', quality: 'low', size: '1536x1024', outputPriceUsd: 0.006,
    });
  });

  it('disables a short legacy access code without a paid call', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('GENERATION_ACCESS_CODE', 'short-legacy-code');
    const call = vi.fn();
    vi.stubGlobal('fetch', call);
    const { response, values } = responseStub();
    status({ method: 'GET' } as IncomingMessage, response);
    expect(JSON.parse(values.body).available).toBe(false);
    await generate(requestStub(sampleRequest(), 'short-legacy-code'), response);
    expect(values.statusCode).toBe(503);
    expect(call).not.toHaveBeenCalled();
  });

  it('blocks a wrong access code before parsing images or calling OpenAI', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('GENERATION_ACCESS_CODE', testAccessCode);
    const call = vi.fn();
    vi.stubGlobal('fetch', call);
    const { response, values } = responseStub();
    await generate(requestStub(sampleRequest(), 'wrong'), response);
    expect(values.statusCode).toBe(401);
    expect(call).not.toHaveBeenCalled();
  });

  it('rejects omitted applied references without a paid call', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('GENERATION_ACCESS_CODE', testAccessCode);
    const call = vi.fn();
    vi.stubGlobal('fetch', call);
    const input = sampleRequest();
    input.images.pop();
    const { response, values } = responseStub();
    await generate(requestStub(input), response);
    expect(values.statusCode).toBe(400);
    expect(values.body).toContain('빠졌습니다');
    expect(call).not.toHaveBeenCalled();
  });

  it('sends exactly one low-cost image edit only after valid preflight', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('GENERATION_ACCESS_CODE', testAccessCode);
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
