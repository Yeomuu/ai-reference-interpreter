import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  GENERATION_MODEL, GENERATION_OUTPUT_PRICE_USD, GENERATION_PRICING_NOTE,
  GENERATION_QUALITY, GENERATION_SIZE, type GenerationStatus,
  MIN_GENERATION_ACCESS_CODE_LENGTH,
} from '../src/services/generationContract.js';

export default function handler(request: IncomingMessage, response: ServerResponse): void {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.statusCode = 405;
    response.end(JSON.stringify({ error: '지원하지 않는 요청입니다.' }));
    return;
  }
  const available = Boolean(process.env.OPENAI_API_KEY &&
    (process.env.GENERATION_ACCESS_CODE?.length ?? 0) >= MIN_GENERATION_ACCESS_CODE_LENGTH);
  const status: GenerationStatus = {
    available,
    requiresAccessCode: true,
    model: GENERATION_MODEL,
    quality: GENERATION_QUALITY,
    size: GENERATION_SIZE,
    outputPriceUsd: GENERATION_OUTPUT_PRICE_USD,
    pricingNote: GENERATION_PRICING_NOTE,
    reason: available ? undefined : '서버의 이미지 생성 키 또는 접근 코드가 설정되지 않았습니다. 데모 샘플은 계속 사용할 수 있습니다.',
  };
  response.statusCode = 200;
  response.end(JSON.stringify(status));
}
