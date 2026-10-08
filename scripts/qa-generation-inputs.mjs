// Disposable browser; no model call or participant storage is touched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5174';
const out = 'qa-screens/ui-polish-20261008/generation-inputs';
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1254, height: 884 } });
  const errors = [];
  let paidRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    if (route.request().url().endsWith('/generate')) paidRequests++;
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"available":false}' });
  });
  await page.goto(base);
  const result = await page.evaluate(async () => {
    const { createSampleProject } = await import('/src/data/sample.ts');
    const { compactImage, compactReferenceSheet, preparePlanGuideImage } = await import('/src/services/imageProvider.ts');
    const { MAX_GENERATION_IMAGE_BYTES, buildGenerationPrompt, GENERATION_MODEL, GENERATION_QUALITY } = await import('/src/services/generationContract.ts');
    const project = createSampleProject();
    const inspect = async dataUrl => {
      const blob = await (await fetch(dataUrl)).blob();
      const bitmap = await createImageBitmap(blob);
      const value = { width: bitmap.width, height: bitmap.height, bytes: blob.size, type: blob.type };
      bitmap.close();
      return value;
    };
    const full = await inspect(await compactImage('/sample/campus/projectroom-front.jpg'));
    const crop = await inspect(await compactImage('/sample/campus/projectroom-front.jpg', { mode: 'crop', regions: [{ x: .25, y: .25, width: .5, height: .5 }] }));
    const grid = await inspect(await compactImage('/sample/campus/projectroom-front.jpg', { mode: 'grid', regions: [{ x: 0, y: 0, width: .5, height: .5 }, { x: .5, y: .5, width: .5, height: .5 }] }));
    const source = project.sourceImages.find(image => image.role !== 'existing-space');
    // A single encoding at the end: original pixels -> crop canvas -> sheet -> JPEG.
    const original = HTMLCanvasElement.prototype.toBlob;
    let encodings = 0;
    HTMLCanvasElement.prototype.toBlob = function (...args) { encodings++; return original.apply(this, args); };
    let sheet;
    try { sheet = await inspect(await compactReferenceSheet(project, [{ sourceId: source.id }, { sourceId: source.id, referencePreparation: { mode: 'crop', regions: [{ x: .2, y: .2, width: .5, height: .5 }] } }])); }
    finally { HTMLCanvasElement.prototype.toBlob = original; }
    const guide = await preparePlanGuideImage(project, 'camera-entrance');
    const prompt = buildGenerationPrompt(project, 'camera-entrance', []);
    return { full, crop, grid, sheet, guide, encodings, limit: MAX_GENERATION_IMAGE_BYTES, model: GENERATION_MODEL, quality: GENERATION_QUALITY,
      preciseCoordinates: prompt.includes('Plan anchor x='), sharedKeys: prompt.includes('E01'), separateCoordinates: prompt.includes('NOT meters, photo pixels, image-output pixels') };
  });
  for (const item of [result.full, result.crop, result.grid, result.sheet]) {
    assert(item.bytes <= result.limit);
    assert.equal(item.type, 'image/jpeg');
  }
  assert.equal(result.model, 'gpt-image-2');
  assert.equal(result.quality, 'high');
  assert(result.preciseCoordinates && result.sharedKeys && result.separateCoordinates);
  assert.equal(result.grid.width / result.grid.height, 2);
  assert.equal(result.sheet.width, 1536);
  assert.equal(result.sheet.height, 1536);
  assert.equal(result.encodings, 1, 'Sheet must not encode intermediate JPEG crops');
  assert.equal(paidRequests, 0);
  assert.deepEqual(errors, []);
  fs.mkdirSync(out, { recursive: true });
  await page.setContent('<main style="background:white;padding:20px"><p>생성 입력 검증: 저장 도면 · 실제 AI 결과 아님</p><img alt="저장 좌표와 요소 번호 검증 도면" style="max-width:100%;max-height:780px"></main>');
  await page.locator('img').evaluate((img, uri) => { img.src = uri; }, result.guide);
  await page.locator('img').evaluate(img => img.decode());
  await page.screenshot({ path: `${out}/guide.png` });
  const report = { ...result };
  delete report.guide;
  fs.writeFileSync(`${out}/verification.json`, JSON.stringify({ ...report, paidRequests, browserErrors: errors }, null, 2));
  console.log(JSON.stringify({ ...report, paidRequests, browserErrors: errors }));
} finally { await browser.close(); }
