import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
const key = 'ai-reference-interpreter:projects:v1';
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  let paidRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/status', route => route.fulfill({ json: { available: false, message: 'QA: 이미지 생성은 호출하지 않습니다.' } }));
  await page.route('**/api/generate', route => { paidRequests++; return route.abort(); });
  await page.goto(base);
  await page.getByRole('button', { name: '프로젝트 목록으로 이동', exact: true }).click();
  await page.getByRole('button', { name: '졸업전시 구상 시작', exact: true }).click();
  const id = new URL(page.url()).pathname.split('/')[2];
  const project = () => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).projects.find(p => p.id === id), { key, id });
  const stage = name => page.locator('.step-nav').getByRole('button', { name }).click();
  const tool = name => page.locator('.layout-editor>.layout-panel').first().getByRole('button', { name, exact: true }).click();
  const right = page.locator('.layout-inspector');
  const count = async kind => (await project()).elements.filter(e => e.kind === kind).length;
  async function point(x, y) {
    return page.locator('.plan-canvas__svg').first().evaluate((svg, { x, y }) => {
      const p = svg.createSVGPoint(); p.x = x * svg.viewBox.baseVal.width; p.y = y * svg.viewBox.baseVal.height;
      const q = p.matrixTransform(svg.querySelector(':scope > g').getScreenCTM()); return { x: q.x, y: q.y };
    }, { x, y });
  }
  async function click(x, y) { const p = await point(x, y); await page.mouse.click(p.x, p.y); }
  async function undo() { await page.locator('.plan-canvas__svg').focus(); await page.keyboard.press('Control+z'); }
  async function redo() { await page.locator('.plan-canvas__svg').focus(); await page.keyboard.press('Control+Shift+z'); }

  await stage('02 레이아웃 구성');
  await tool('진열 상품');
  assert.match(await right.innerText(), /먼저 전시대나 테이블/);
  await click(.3, .3); assert.equal(await count('display-product'), 0);
  assert.match(await page.locator('.alert-error').innerText(), /전시대나 테이블/);
  await page.getByRole('button', { name: '오류 닫기', exact: true }).click();
  await tool('전시대'); await click(.3, .3);
  await tool('테이블'); await click(.5, .3);
  const stand = (await project()).elements.find(e => e.layoutKind === 'display');
  const table = (await project()).elements.find(e => e.layoutKind === 'table');

  await tool('조명');
  assert.equal(await right.getByLabel('조명 설치 위치').inputValue(), 'floor');
  assert.match(await right.locator('.layout-tool-hint').innerText(), /스탠드 조명/);
  await click(.3, .3); assert.equal(await count('standing-light'), 0);
  assert.match(await page.locator('.alert-error').innerText(), /이미 이 위치/);
  await click(.65, .5); assert.equal(await count('standing-light'), 1);
  await right.getByLabel('조명 설치 위치').selectOption('ceiling');
  assert.match(await right.locator('.layout-tool-hint').innerText(), /바닥 가구 위/);
  await click(.3, .3); await click(.5, .3);
  assert.equal(await count('ceiling-light'), 2);
  assert.equal(await count('standing-light'), 1);
  // Clicking an existing ceiling glyph must validate rather than cancel the tool.
  await click(.5, .3); assert.equal(await count('ceiling-light'), 2);
  assert.match(await page.locator('.alert-error').innerText(), /천장 위치가 겹칩니다/);
  await page.getByRole('button', { name: '오류 닫기', exact: true }).click();
  await undo(); assert.equal(await count('ceiling-light'), 1);
  await redo(); assert.equal(await count('ceiling-light'), 2);
  await page.reload(); assert.equal(await count('ceiling-light'), 2);
  console.log('standing/floor collision, ceiling above furniture, separate ceiling positions, duplicate rejection, undo/redo/reload passed');

  await tool('진열 상품'); await click(.3, .3);
  assert.equal(await count('display-product'), 1);
  assert.equal((await project()).elements.find(e => e.kind === 'display-product').target.fixtureElementId, stand.id);
  // The rectangle has rounded corners. Click its painted top edge, not the
  // transparent corner outside the footprint; a ceiling light must not intercept it.
  const tableHit = page.locator(`[data-element-id="${table.id}"] .plan-element__footprint`);
  const tableBox = await tableHit.boundingBox();
  await tableHit.click({ position: { x: tableBox.width / 2, y: 3 } });
  assert.equal(await count('display-product'), 2);
  assert.equal((await project()).elements.filter(e => e.kind === 'display-product').at(-1).target.fixtureElementId, table.id);
  // Product glyphs must not swallow the host selection when adding another product.
  await page.locator('.plan-element--product').first().click();
  assert.equal(await count('display-product'), 3);
  await undo(); assert.equal(await count('display-product'), 2);
  await redo(); assert.equal(await count('display-product'), 3);
  await page.reload(); assert.equal(await count('display-product'), 3);
  await tool('진열 상품'); await right.getByRole('button', { name: `${stand.label} 위에 놓기`, exact: true }).click();
  assert.equal(await count('display-product'), 4);
  await tool('선택·이동');
  await page.locator('.layout-item-list>summary').click();
  await page.locator('.layout-item-list').getByRole('button', { name: stand.label, exact: true }).click();
  await right.getByLabel('위치 고정', { exact: true }).check();
  await tool('진열 상품');
  await page.locator(`[data-element-id="${stand.id}"]`).focus(); await page.keyboard.press('Enter');
  assert.equal(await count('display-product'), 5);
  assert((await project()).elements.find(e => e.id === stand.id).locked);
  console.log('product canvas/button placement, repeated product glyph, locked support keyboard selection and product undo/redo/reload passed');

  // Retained legacy objects and fixed lights: keep data, disable an unplaced support,
  // and check only the local ceiling-light footprint, not the entire ceiling zone.
  await page.evaluate(({ key, id }) => {
    const state = JSON.parse(localStorage.getItem(key)), p = state.projects.find(p => p.id === id);
    p.elements.push({ id: 'unplaced-support', origin: 'layout', layoutKind: 'display', sourceReferenceId: '', label: '위치 없는 전시대', kind: 'freestanding-fixture', status: 'apply', target: null });
    p.floorPlan.structures.push({ id: 'existing-qa-light', name: '기존 천장 조명', kind: 'existing-light', immutable: true, protected: true, geometry: { kind: 'circle', center: { x: .75, y: .7 }, radius: .025 } });
    localStorage.setItem(key, JSON.stringify(state));
  }, { key, id });
  await page.reload(); await tool('진열 상품');
  assert(await right.getByRole('button', { name: '위치 없는 전시대 · 위치 먼저 지정', exact: true }).isDisabled());
  await tool('조명'); await right.getByLabel('조명 설치 위치').selectOption('ceiling');
  await click(.75, .7); assert.equal(await count('ceiling-light'), 2);
  assert.match(await page.locator('.alert-error').innerText(), /기존 천장 조명/);
  await click(.65, .7); assert.equal(await count('ceiling-light'), 3);
  await page.reload(); assert.equal(await count('ceiling-light'), 3);
  console.log('unplaced support disabled, fixed ceiling collision and nearby valid placement passed');

  await stage('04 시안 생성'); await page.getByRole('button', { name: '시점 수정', exact: true }).click();
  await page.waitForURL('**/camera');
  await page.getByLabel('시점 이름', { exact: true }).fill('수정한 관람 시점');
  await page.getByLabel('시점 이름', { exact: true }).press('Tab');
  const cameras = (await project()).cameras;
  assert(cameras.some(c => c.name === '수정한 관람 시점'));
  await page.getByRole('button', { name: '이전 단계', exact: true }).click();
  await page.waitForURL('**/review');
  assert.match(await page.locator('.step-link.is-current').innerText(), /04\.?\s*시안 생성/);
  assert.deepEqual((await project()).cameras, cameras);
  await page.goBack(); await page.waitForURL('**/camera');
  await page.goForward(); await page.waitForURL('**/review');
  await page.reload(); assert.deepEqual((await project()).cameras, cameras);
  // Direct camera URL after reload uses the same explicit STEP 04 return target.
  await page.goto(`${base}/projects/${id}/camera`);
  await page.getByRole('button', { name: '이전 단계', exact: true }).click(); await page.waitForURL('**/review');
  assert.deepEqual((await project()).cameras, cameras);
  await page.getByRole('button', { name: '이전 단계', exact: true }).click(); await page.waitForURL('**/references');
  console.log('camera previous stays STEP 04, edits retained, direct URL/reload/history and review-to-STEP 03 navigation passed');
  if (process.env.QA_SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.QA_SCREENSHOT_DIR, { recursive: true });
    await stage('02 레이아웃 구성'); await tool('조명'); await right.getByLabel('조명 설치 위치').selectOption('ceiling');
    await page.screenshot({ path: process.env.QA_SCREENSHOT_DIR + '/lighting-products.png' });
  }
  assert.deepEqual(errors, []); assert.equal(paidRequests, 0);
  console.log('QA passed: no JS errors; paid model calls: 0');
} finally { await browser.close(); }
