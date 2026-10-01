// Disposable profile only. Mock output verifies request wiring, not model image quality.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
const key = 'ai-reference-interpreter:projects:v1';
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1575, height: 884 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true, requiresAccessCode: false, quota: { totalLimit: 60, used: 0, remaining: 60, dailyLimit: 20, dailyRemaining: 20, busy: false } }) }));
  await page.route('**/api/generate', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ imageDataUrl: 'data:image/jpeg;base64,' + fs.readFileSync('public/sample/campus/projectroom-front.jpg').toString('base64') }) });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('프로젝트 이름 필수').fill('사진 업로드 흐름 확인');
  await page.getByRole('button', { name: '프로젝트 만들기', exact: true }).click();
  let id = new URL(page.url()).pathname.split('/')[2];
  const project = () => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).projects.find(p => p.id === id), { key, id });
  const stage = name => page.locator('.step-nav').getByRole('button', { name }).click();
  assert.equal((await project()).floorPlan, null);
  await page.locator('.space-direction input[type=file]').first().setInputFiles('public/sample/campus/projectroom-front.jpg');
  await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)).projects.find(p => p.id === id).sourceImages.length === 1, { key, id });
  let p = await project();
  assert.equal(p.sourceImages[0].role, 'existing-space');
  assert.equal(p.floorPlan, null);assert.equal(p.elements.length, 0);assert.equal(p.cameras.length, 0);
  assert.match(await page.locator('.source-provenance').innerText(), /도면을 자동 생성하지 않습니다/);
  await page.getByRole('button', { name: '평면도', exact: true }).click();
  assert(await page.getByRole('button', { name: '빈 도면에서 직접 그리기', exact: true }).isVisible());
  await page.getByRole('button', { name: '가로 개략도', exact: true }).click();
  assert.equal((await project()).floorPlan.kind, 'schematic');
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal((await project()).sourceImages.length, 1);assert.equal((await project()).floorPlan.geometryConfidence, 'schematic');
  console.log('new project: photo upload has no inferred plan/objects/cameras; explicit schematic and reload passed');

  // Build an isolated legacy fixture scenario from the existing school sample.
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '졸업전시 구상 시작', exact: true }).click();
  id = new URL(page.url()).pathname.split('/')[2];p = await project();
  const ceiling = p.floorPlan.areas.find(a => a.kind === 'ceiling');
  const floor = p.floorPlan.areas.find(a => a.kind === 'floor');
  const make = (id, label, kind, target, extra = {}) => ({ id, label, kind, sourceReferenceId: '', status: 'apply', target, ...extra });
  p.elements = [
    make('ceiling-exhibit', '천장 작품', 'other-ceiling', { kind: 'ceiling-zone', zoneId: ceiling.id, offset: { x: .75, y: .4 } }),
    make('edge-stand', '가장자리 전시대', 'freestanding-fixture', { kind: 'floor-point', x: floor.bounds.x + .06, y: .5, footprint: { width: .04, height: .04 } }, { origin: 'layout', layoutKind: 'display' }),
    make('unplaced', '아직 놓지 않은 의자', 'furniture', null, { origin: 'layout', layoutKind: 'chair' }),
    make('excluded', '제외한 의자', 'furniture', null, { origin: 'layout', layoutKind: 'chair', status: 'exclude' }),
    make('orphaned', '받침 확인 상품', 'display-product', { kind: 'fixture-surface', fixtureElementId: 'missing-support', offset: { x: .5, y: .5 } }),
    make('atmosphere', '공간 분위기 조건', 'global-palette', { kind: 'whole-space' }, { origin: 'mapping-condition', layoutKind: 'area' }),
  ];
  p.referenceBindings = [];p.results = [];
  await page.evaluate(({ key, p }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, projects: [p] })), { key, p });
  await page.goto(`${base}/projects/${id}/placement`, { waitUntil: 'domcontentloaded' });
  const list = page.locator('.layout-item-list');
  await list.locator('summary').click();
  assert.match(await list.innerText(), /배치 목록 · 5개/);
  assert.match(await list.innerText(), /위치 미지정/);assert.match(await list.innerText(), /적용 제외/);assert.match(await list.innerText(), /위치 확인 필요/);
  const object = () => page.locator('[data-element-id="ceiling-exhibit"]');
  assert(await object().isVisible());
  if (process.env.QA_SCREENSHOT_DIR) { fs.mkdirSync(process.env.QA_SCREENSHOT_DIR, { recursive: true });await page.screenshot({ path: `${process.env.QA_SCREENSHOT_DIR}/layout.png` }); }
  await page.getByRole('button', { name: '확대', exact: true }).click();
  await page.getByRole('button', { name: '확대', exact: true }).click();
  await list.getByRole('button', { name: '가장자리 전시대', exact: true }).click();
  assert.equal(await page.locator('.plan-canvas__controls>span').innerText(), '100%');
  await list.getByRole('button', { name: '천장 작품', exact: true }).click();
  await page.getByRole('button', { name: '요소 표시', exact: true }).click();
  assert(await object().isVisible());assert.equal(await page.locator('[data-element-id="edge-stand"]').count(), 0);
  await page.getByRole('button', { name: '확대', exact: true }).click();
  assert.notEqual(await page.locator('.plan-canvas__controls>span').innerText(), '100%');
  await stage('03 레퍼런스 적용');
  assert.equal(await page.locator(`[data-mapping-target="area:${ceiling.id}"]`).count(), 0);
  assert(await page.locator('[data-mapping-target="ceiling-exhibit"]').isVisible());
  await page.locator('.plan-area-controls>summary').click();
  await page.getByLabel(/공간 영역 · \d+개/).uncheck();
  await page.keyboard.press('Escape');
  for (const area of p.floorPlan.areas.filter(a => a.kind === 'spatial')) assert.equal(await page.locator(`[data-mapping-target="area:${area.id}"]`).count(), 0);
  assert.equal((await project()).elements.length, 6);
  await page.reload({ waitUntil: 'domcontentloaded' });assert.equal((await project()).elements.length, 6);
  console.log('legacy ceiling visibility, positioned counts, hidden targets, selection/zoom, retained unplaced/excluded/orphaned data passed');

  // Remove only the synthetic invalid fixture from test data so generation can pass preflight.
  p = await project();p.elements = p.elements.filter(e => ['ceiling-exhibit', 'edge-stand', 'atmosphere'].includes(e.id)).map(e => e.origin === 'layout' ? e : { ...e, sourceReferenceId: p.references[0].id });
  await page.evaluate(({ key, p }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, projects: [p] })), { key, p });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await stage('04 시안 생성');
  await page.locator('.generation-details>summary').click();
  assert.match(await page.locator('.generation-details').innerText(), /보존하지 않은 이동식 책상·의자/);
  assert.match(await page.locator('.generation-details').innerText(), /원본 사진 자체는 바뀌지 않습니다/);
  const generate = page.getByRole('button', { name: 'AI 이미지 생성', exact: true });
  assert(await generate.count() > 0, await page.locator('.generation-panel').innerText());
  assert.equal(await generate.isDisabled(), false, await page.locator('.generation-panel').innerText());
  await generate.click();
  await page.waitForURL('**/results');
  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.equal(request.images[0].role, 'existing-space');
  assert.equal(request.images[0].sourceId, p.sourceImages.find(i => i.role === 'existing-space').id);
  assert(request.images[0].dataUrl.startsWith('data:image/'));
  assert.equal(request.images[1].role, 'floor-plan');
  assert.equal(request.images[1].planGuide.cameraId, request.cameraId);
  assert(request.project.elements.some(e => e.id === 'ceiling-exhibit'));
  await page.reload({ waitUntil: 'domcontentloaded' });assert.equal((await project()).results.length, 1);
  assert.deepEqual(errors, []);
  if (process.env.QA_SCREENSHOT_DIR) { fs.mkdirSync(process.env.QA_SCREENSHOT_DIR, { recursive: true });await page.screenshot({ path: `${process.env.QA_SCREENSHOT_DIR}/result.png` }); }
  console.log('real photo first, saved plan second, one mocked request, result persistence and zero JS errors passed; paid calls=0');
} finally { await browser.close(); }
