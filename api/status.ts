import { generationIdentity } from './_lib/generationIdentity.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { generationQuota, quotaConfigured } from './_lib/generationQuota.js';
import {
  GENERATION_MODEL, GENERATION_OUTPUT_PRICE_USD, GENERATION_PRICING_NOTE,
  GENERATION_QUALITY, GENERATION_SIZE, type GenerationStatus,
} from '../src/services/generationContract.js';

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.statusCode = 405;
    response.end(JSON.stringify({ error: '지원하지 않는 요청입니다.' }));
    return;
  }
  let available = Boolean(process.env.OPENAI_API_KEY && quotaConfigured());
  let quota: GenerationStatus['quota'];
  if (available) {
    try { quota = await generationQuota.status(generationIdentity(request, response)!); }
    catch (error) {
      available = false;
      // Log only the error class. Blob error messages can contain credentials.
      console.error('generation quota status failed', error instanceof Error ? error.name : 'unknown error');
    }
  }
  const status: GenerationStatus = {
    available,
    requiresAccessCode: false,
    quota,
    model: GENERATION_MODEL,
    quality: GENERATION_QUALITY,
    size: GENERATION_SIZE,
    outputPriceUsd: GENERATION_OUTPUT_PRICE_USD,
    pricingNote: GENERATION_PRICING_NOTE,
    reason: available ? undefined : '이미지 생성 서버 또는 호출 상한 저장소를 확인할 수 없습니다. 무료 샘플은 계속 사용할 수 있습니다.',
  };
  response.statusCode = 200;
  response.end(JSON.stringify(status));
}
