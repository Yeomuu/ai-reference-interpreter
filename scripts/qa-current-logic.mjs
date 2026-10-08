// Disposable profile. All generation endpoints are intercepted; no paid calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5174';
const key = 'ai-reference-interpreter:projects:v1';
const out = process.env.QA_SCREENSHOT_DIR || 'qa-screens/logic-20261008/current';
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1575, height: 884 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true, requiresAccessCode: false, quota: { totalLimit: 60, used: requests.length, remaining: 60 - requests.length, dailyLimit: 20, dailyRemaining: 20 - requests.length, busy: false } }) }));
  let releaseFirst;
  const firstGate = new Promise(resolve => { releaseFirst = resolve; });
  await page.route('**/api/generate', async route => {
    requests.push({ ...route.request().postDataJSON(), requestId: route.request().headers()['x-generation-request-id'] });
    if (requests.length === 1) {
      await firstGate;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ imageDataUrl: 'data:image/jpeg;base64,' + fs.readFileSync('public/sample/campus/projectroom-front.jpg').toString('base64') }) });
    } else await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'QA: 두 번째 시점의 응답 불확실', outcomeUnknown: true }) });
  });
  await page.goto(base);
  let id;
  const project = () => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).projects.find(p => p.id === id), { key, id });
  const stage = name => page.locator('.step-nav').getByRole('button', { name }).click();
  const snapshot = async name => { fs.mkdirSync(out, { recursive: true }); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `${out}/${name}.png` }); };
  const point = (x, y) => page.locator('.plan-canvas__svg').first().evaluate((svg, { x, y }) => {
    const p = svg.createSVGPoint(); p.x = x * svg.viewBox.baseVal.width; p.y = y * svg.viewBox.baseVal.height;
    const q = p.matrixTransform(svg.querySelector(':scope > g').getScreenCTM()); return { x: q.x, y: q.y };
  }, { x, y });
  const click = async (x, y) => { const p = await point(x, y); await page.mouse.click(p.x, p.y); };
  const tool = name => page.locator('.layout-editor>.layout-panel').first().getByRole('button', { name, exact: true }).click();
  const undo = async () => { await page.locator('.plan-canvas__svg').first().focus(); await page.keyboard.press('Control+z'); };

  // Empty-plan navigation must survive the move of the footer into the sidebar.
  await page.getByRole('button', { name: '프로젝트 목록으로 이동', exact: true }).click();
  await page.getByLabel('프로젝트 이름 필수').fill('도면 교체 QA');
  await page.getByRole('button', { name: '프로젝트 만들기', exact: true }).click();
  id = new URL(page.url()).pathname.split('/')[2];
  await stage('02 레이아웃 구성');
  assert.equal((await project()).floorPlan, null);
  const canvasBox = await page.locator('.mapping-editor>.layout-canvas-panel').boundingBox();
  const sidebarBox = await page.locator('.mapping-panel').boundingBox();
  assert(sidebarBox.x > canvasBox.x && sidebarBox.width <= 384 && canvasBox.width > sidebarBox.width);
  for (const name of ['이전 단계', '다음으로']) {
    const button = page.getByRole('button', { name, exact: true });
    assert(await button.isVisible()); assert(await button.evaluate(e => !!e.closest('aside')));
  }
  await snapshot('empty-plan-navigation');
  await page.getByRole('button', { name: '공간·방향 설정으로 이동', exact: true }).click();
  await page.getByRole('button', { name: '평면도', exact: true }).click();
  await page.getByRole('button', { name: '가로 개략도', exact: true }).click();
  await stage('02 레이아웃 구성'); await tool('전시대'); await click(.5, .5);
  const original = await project(); assert.equal(original.elements.length, 1);
  await stage('01 공간·방향 설정'); await page.getByRole('button', { name: '평면도', exact: true }).click();
  const options = page.getByText('도면 교체 옵션', { exact: true }); await options.click();
  await page.getByLabel('새 도면 업로드 시 표시 처리').selectOption('retain');
  await page.locator('.space-evidence input[type=file]').setInputFiles('public/sample/campus/projectroom-front.jpg');
  await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)).projects.find(p => p.id === id).floorPlan.kind === 'uploaded', { key, id });
  let p = await project();
  assert.deepEqual(p.floorPlan.structures, original.floorPlan.structures); assert.deepEqual(p.elements, original.elements);
  assert.equal(p.floorPlan.width / p.floorPlan.height, 4 / 3); assert(p.planAlignmentPending);
  await page.getByRole('button', { name: '도면 대응 확인 완료', exact: true }).click(); assert.equal((await project()).planAlignmentPending, false);
  await page.getByLabel('새 도면 업로드 시 표시 처리').selectOption('fresh');
  await page.locator('.space-evidence input[type=file]').setInputFiles('public/sample/campus/projectroom-windows.jpg');
  await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)).projects.find(p => p.id === id).floorPlan.structures.length === 0, { key, id });
  p = await project(); assert.equal(p.floorPlan.areas.length, 0); assert.equal(p.keeps.length, 0); assert.equal(p.elements[0].target, null);
  assert(await page.getByRole('button', { name: '도면 대응 확인 완료', exact: true }).isDisabled());
  await snapshot('fresh-plan-requires-outline');
  await undo(); p = await project(); assert.deepEqual(p.elements, original.elements); assert.deepEqual(p.floorPlan.structures, original.floorPlan.structures);
  await page.reload(); assert.deepEqual((await project()).elements, original.elements);
  console.log('empty-plan sidebar navigation, retain/fresh plan replacement, aspect ratio, alignment gate and undo/reload passed');

  // A fresh participant's mandatory baseline is preserved, compatible attachments remain usable.
  await page.goto(base);
  await page.getByLabel('참가자 번호', { exact: true }).fill('P987');
  await page.getByRole('button', { name: '프로젝트 시작하기', exact: true }).click();
  await page.waitForURL('**/space'); id = new URL(page.url()).pathname.split('/')[2];
  const baseline = await project(); assert.equal(baseline.elements.length, 0); assert.equal(baseline.cameras.length, 0);
  assert(baseline.floorPlan.structures.every(s => s.preservationRequired));
  await stage('02 레이아웃 구성'); await tool('선택·이동');
  await page.getByRole('button', { name: /^앞쪽 벽, 위치 고정/ }).focus(); await page.keyboard.press('Enter');
  assert(await page.getByRole('switch', { name: '앞쪽 벽 필수 보존 (위치 고정)', exact: true }).isDisabled());
  await tool('벽면 연출'); await click(.3, .1);
  p = await project(); assert.equal(p.elements.filter(e => e.kind === 'wall-graphic').length, 1);
  await tool('조명'); await page.getByLabel('조명 설치 위치').selectOption('wall'); await click(.5, .9);
  p = await project(); assert.equal(p.elements.filter(e => e.kind === 'wall-light').length, 1);
  await tool('벽면 연출');
  await page.getByRole('button', { name: /^창문이 있는 벽, 위치 고정/ }).focus(); await page.keyboard.press('Enter');
  assert.equal((await project()).elements.length, 2); assert.match(await page.locator('.alert-error').innerText(), /창|개구부|겹칩니다/);
  assert.deepEqual((await project()).floorPlan.structures, baseline.floorPlan.structures);
  const toastBox = await page.locator('.notification-stack').boundingBox();
  const footerBox = await page.locator('.layout-inspector>.workflow-footer').boundingBox();
  assert(toastBox.y + toastBox.height <= footerBox.y);
  await snapshot('kept-wall-attachments');
  await page.getByRole('button', { name: '오류 닫기', exact: true }).click();

  // Wall and whole-space mappings create conditions. Unbinding removes those
  // conditions without removing independently placed graphics/lights.
  const independent = (await project()).elements;
  await stage('03 레퍼런스 적용');
  const apply = () => page.getByRole('button', { name: '선택한 1개에 적용', exact: true }).click();
  await page.locator('[data-mapping-target="wall:campus-right"]').click(); await apply();
  await page.getByRole('button', { name: '전체 공간 선택', exact: true }).click(); await apply();
  p = await project(); assert.equal(p.elements.filter(e => e.origin === 'mapping-condition').length, 2);
  await page.getByRole('button', { name: '매핑 현황', exact: true }).click();
  while (await page.getByRole('button', { name: '연결 해제', exact: true }).count()) await page.getByRole('button', { name: '연결 해제', exact: true }).first().click();
  assert.deepEqual((await project()).elements, independent); assert.equal((await project()).referenceBindings.length, 0);
  await page.getByRole('button', { name: '레퍼런스', exact: true }).click();
  await page.locator('[data-mapping-target="wall:campus-right"]').click(); await apply();
  await page.getByRole('button', { name: '전체 공간 선택', exact: true }).click(); await apply();
  const beforeDelete = await project();
  await page.getByRole('button', { name: '삭제', exact: true }).click(); await page.getByRole('button', { name: '이미지 삭제', exact: true }).click();
  assert.deepEqual((await project()).elements, independent); assert.equal((await project()).references.length, beforeDelete.references.length - 1);
  await page.reload(); await page.waitForTimeout(2300); await undo();
  assert.deepEqual((await project()).elements, beforeDelete.elements); assert.deepEqual((await project()).referenceBindings, beforeDelete.referenceBindings);
  await snapshot('mapping-deletion-recovered');
  console.log('mandatory wall lock, removable graphics/wall lighting, opening collision, projected-condition cleanup and persistent deletion undo passed');

  await stage('04 시안 생성'); assert.equal((await project()).cameras.length, 3);
  await page.getByRole('button', { name: '시점 수정', exact: true }).click();
  await page.getByRole('button', { name: '속성 숨기기', exact: true }).click();
  assert(await page.getByRole('button', { name: '조건 확인', exact: true }).isVisible());
  await page.getByRole('button', { name: '속성 보이기', exact: true }).click();
  assert(await page.getByRole('button', { name: '조건 확인', exact: true }).evaluate(e => !!e.closest('aside')));
  await page.getByRole('button', { name: '조건 확인', exact: true }).click();
  for (const checkbox of await page.locator('.generation-viewpoints input').all()) await checkbox.check();
  const generate = page.getByRole('button', { name: 'AI 이미지 생성', exact: true }); assert(await generate.isEnabled());
  await generate.click(); await page.waitForFunction(() => document.querySelector('.generation-panel button.button-primary')?.disabled);
  await snapshot('batch-in-flight'); releaseFirst();
  await page.waitForURL('**/results', { timeout: 60000 });
  assert.equal(requests.length, 2); assert.notEqual(requests[0].requestId, requests[1].requestId);
  p = await project(); assert.equal(p.results.length, 1); assert.equal(p.results[0].origin, 'ai');
  assert.match(await page.locator('.alert-error').innerText(), /1장은 저장|불확실/);
  const savedSnapshot = p.results[0].conditionsSnapshot;
  await snapshot('partial-batch-result');
  await page.reload(); assert.equal((await project()).results.length, 1);
  await stage('04 시안 생성');
  assert(await page.getByRole('button', { name: '위험 확인 후 재시도 허용', exact: true }).isDisabled()); assert(await generate.isDisabled());
  await snapshot('uncertain-retry-blocked');
  await stage('03 레퍼런스 적용'); await page.getByRole('button', { name: '매핑 현황', exact: true }).click();
  while (await page.getByRole('button', { name: '연결 해제', exact: true }).count()) await page.getByRole('button', { name: '연결 해제', exact: true }).first().click();
  p = await project(); assert(p.results[0].stale); assert.deepEqual(p.results[0].conditionsSnapshot, savedSnapshot);
  assert.deepEqual(p.floorPlan.structures, baseline.floorPlan.structures); assert.equal(requests.length, 2); assert.deepEqual(errors, []);
  console.log('camera hidden/restored navigation, 3-view batch busy gate, 2nd-view failure stops 3rd, completed result retained, uncertain retry persists, stale snapshot retained passed');
  console.log('QA passed: no JS errors; two mock POSTs, paid calls: 0');
} finally { await browser.close(); }
