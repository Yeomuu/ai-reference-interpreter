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
  const errors = []; let paidRequests = 0;
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/status', r => r.fulfill({ json: { available: false, message: 'QA 샘플 검사' } }));
  await page.route('**/api/generate', r => { paidRequests++; return r.abort(); });
  await page.goto(base);
  await page.getByRole('button', { name: '졸업전시 구상 시작', exact: true }).click();
  const id = new URL(page.url()).pathname.split('/')[2];
  const project = () => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).projects.find(p => p.id === id), { key, id });
  const stage = name => page.locator('.step-nav').getByRole('button', { name }).click();
  const marker = face => page.locator(`.plan-wall-face-marker[data-wall-face="${face}"]`);
  const right = page.locator('.layout-inspector');
  const radio = face => right.locator(`.wall-face-choice input[value="${face}"]`);
  const apply = () => right.getByRole('button', { name: '벽 구간 적용', exact: true }).click();
  async function point(x, y) {
    return page.locator('.plan-canvas__svg').first().evaluate((svg, { x, y }) => {
      const p = svg.createSVGPoint(); p.x = x * svg.viewBox.baseVal.width; p.y = y * svg.viewBox.baseVal.height;
      const q = p.matrixTransform(svg.querySelector(':scope > g').getScreenCTM()); return { x: q.x, y: q.y };
    }, { x, y });
  }
  async function click(x, y) { const p = await point(x, y); await page.mouse.click(p.x, p.y); }
  async function draw(x, y, ex, ey) {
    const a = await point(x, y), b = await point(ex, ey); await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 }); await page.mouse.up();
  }
  async function undo() { await page.locator('.plan-canvas__svg').focus(); await page.keyboard.press('Control+z'); }
  async function redo() { await page.locator('.plan-canvas__svg').focus(); await page.keyboard.press('Control+Shift+z'); }
  await stage('02 레이아웃 구성');
  await page.getByRole('button', { name: '가벽', exact: true }).click(); await draw(.48, .3, .48, .7);
  const wall = (await project()).floorPlan.structures.filter(s => s.role === 'partition').at(-1); assert(wall);
  await page.getByRole('button', { name: '그리기 마치기', exact: true }).click();
  await page.getByRole('button', { name: '벽면 연출', exact: true }).click(); await click(.48, .5);
  assert.equal(await page.locator('.plan-wall-face-marker').count(), 2);
  assert(await right.getByRole('button', { name: '벽 구간 적용', exact: true }).isDisabled());
  await right.getByLabel('시작 (%)', { exact: true }).fill('12');
  await right.getByLabel('끝 (%)', { exact: true }).fill('30');
  const wallBefore = JSON.stringify((await project()).floorPlan.structures);
  await marker('b').click();
  assert(await radio('b').isChecked()); assert.equal(await marker('b').getAttribute('aria-pressed'), 'true');
  assert(await page.evaluate(wallName => {
    const label = [...document.querySelectorAll('.plan-structure__move-label, .plan-keep-label')].find(g => g.querySelector('title')?.textContent === wallName);
    const bounds = label?.querySelector('.plan-label-hit')?.getBoundingClientRect();
    return bounds && [...document.querySelectorAll('.plan-wall-face-marker__hit')].every(hit => {
      const box = hit.getBoundingClientRect();
      return box.right <= bounds.left || box.left >= bounds.right || box.bottom <= bounds.top || box.top >= bounds.bottom;
    });
  }, wall.name), 'partition name must not cover A/B controls');
  if (process.env.QA_SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.QA_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: process.env.QA_SCREENSHOT_DIR + '/wall-face-selection.png' });
  }
  assert.equal(await right.getByLabel('시작 (%)', { exact: true }).inputValue(), '12');
  assert.equal(await right.getByLabel('끝 (%)', { exact: true }).inputValue(), '30');
  assert.equal((await project()).elements.length, 0); // choosing a face does not save prematurely
  assert.equal(JSON.stringify((await project()).floorPlan.structures), wallBefore);
  await radio('a').check(); assert.equal(await marker('a').getAttribute('aria-pressed'), 'true');
  await marker('b').focus(); await page.keyboard.press('Space'); assert(await radio('b').isChecked());
  for (let i = 0; i < 2; i++) {
    const hit = await marker('b').locator('.plan-wall-face-marker__hit').boundingBox();
    assert(Math.abs(hit.width - 40) < 1 && Math.abs(hit.height - 40) < 1);
    if (!i) await page.getByRole('button', { name: '확대', exact: true }).click();
  }
  await apply();
  let first = (await project()).elements.find(e => e.target?.wallId === wall.id);
  assert(first, JSON.stringify({ alerts: await page.locator('.alert-error').allTextContents(), elements: (await project()).elements.map(e=>({id:e.id,target:e.target})), inspector: await right.innerText() }));
  assert.equal(first.target.face, 'b'); assert.equal(first.target.start, .12); assert.equal(first.target.end, .3);
  assert.equal(await page.locator('.plan-wall-face-marker').count(), 2);
  await marker('a').click(); assert(await radio('a').isChecked());
  assert.equal((await project()).elements.find(e => e.id === first.id).target.face, 'b');
  await apply(); assert.equal((await project()).elements.find(e => e.id === first.id).target.face, 'a');
  await undo(); assert.equal((await project()).elements.find(e => e.id === first.id).target.face, 'b');
  assert(await radio('b').isChecked()); assert.equal(await marker('b').getAttribute('aria-pressed'), 'true');
  await redo(); assert.equal((await project()).elements.find(e => e.id === first.id).target.face, 'a');
  await page.reload(); assert(await radio('a').isChecked()); assert.equal(await marker('a').getAttribute('aria-pressed'), 'true');
  console.log('new/existing wall face click, inspector synchronization, keyboard, 40px zoom target, explicit save and undo/redo/reload passed');

  await page.getByRole('button', { name: '벽면 연출', exact: true }).click(); await click(.48, .5);
  assert.equal(await marker('a').getAttribute('aria-pressed'), 'false'); // new draft does not inherit old face
  await marker('b').click(); await apply();
  const second = (await project()).elements.find(e => e.id !== first.id && e.target?.wallId === wall.id);
  assert.equal(second.target.face, 'b');
  await marker('a').click(); await apply();
  assert.equal((await project()).elements.find(e => e.id === second.id).target.face, 'b');
  assert.match(await page.locator('.alert-error').innerText(), /이미 이 위치/);
  await page.getByRole('button', { name: '오류 닫기', exact: true }).click();
  await marker('b').click(); await apply();
  console.log('opposite wall faces allowed and same-face overlap rejected without changing saved target passed');

  await stage('03 레퍼런스 적용');
  await page.locator(`[data-mapping-target="wall:${wall.id}"]`).click();
  const selectedBefore = await page.locator('.mapping-target.is-selected').count();
  assert.equal(selectedBefore, 1);
  assert.equal(await page.getByLabel('가벽의 붙일 면').count(), 1, JSON.stringify({ selected: await page.locator('.mapping-target.is-selected').getAttribute('data-mapping-target'), wall:wall.id, side:await page.locator('.mapping-panel').innerText() }));
  const refsBefore = JSON.stringify((await project()).referenceBindings);
  await marker('b').click();
  assert.equal(await page.locator('.mapping-target.is-selected').count(), selectedBefore, await page.locator('.mapping-selection-bar').innerText());
  assert.equal(await page.getByLabel('가벽의 붙일 면').inputValue(), 'b');
  assert.equal(await page.locator('.mapping-target.is-selected').count(), selectedBefore);
  assert.equal(JSON.stringify((await project()).referenceBindings), refsBefore);
  await page.getByLabel('가벽의 붙일 면').selectOption('a');
  assert.equal(await marker('a').getAttribute('aria-pressed'), 'true');
  await marker('b').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.getByLabel('가벽의 붙일 면').inputValue(), 'b');
  await page.getByRole('button', { name: '선택한 1개에 적용', exact: true }).click();
  const p = await project(); assert(p.referenceBindings.some(b => b.layoutItemIds.includes(second.id)));
  assert.equal(p.elements.find(e => e.id === second.id).target.face, 'b');
  await page.reload(); assert.equal((await project()).elements.find(e => e.id === second.id).target.face, 'b');
  assert.deepEqual(errors, []); assert.equal(paidRequests, 0);
  console.log('reference wall face click/keyboard and select synchronization, explicit binding, reload and no JS errors passed; paid calls=0');
} finally { await browser.close(); }
