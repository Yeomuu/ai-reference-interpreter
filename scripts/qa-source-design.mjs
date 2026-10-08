// Compare the supplied 1920×1080 Figma geometry with actual browser rendering.
// Isolated profile; no generation requests or production data changes.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5174';
const out = process.env.QA_SCREENSHOT_DIR || 'qa-screens/source-20261008/geometry';
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
await mkdir(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [], actual = {};
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/generate', route => route.abort());
  await page.goto(base); await page.evaluate(() => document.fonts.ready);
  async function box(selector, expected) {
    const value = await page.locator(selector).first().evaluate(e => {
      const b = e.getBoundingClientRect(), s = getComputedStyle(e);
      return { x: b.x, y: b.y, w: b.width, h: b.height, r: s.borderRadius, border: s.borderWidth, shadow: s.boxShadow, background: s.backgroundColor };
    });
    actual[selector] = value;
    for (const [key, wanted] of Object.entries(expected)) {
      if (typeof wanted === 'number') assert(Math.abs(value[key] - wanted) <= 1, `${selector} ${key}: ${value[key]} vs ${wanted}`);
      else assert.equal(value[key], wanted, `${selector} ${key}`);
    }
  }
  await box('.welcome', { x: 0, y: 0, w: 1920, h: 1080 });
  await box('.welcome-panel__surface', { x: 920, y: 0, w: 1000, h: 1080, r: '40px 0px 0px 40px', border: '0px' });
  await box('.app-header', { h: 76 });
  await box('.brand-mark', { x: 242, y: 14, w: 48, h: 48 });
  await box('.welcome-art__parallax', { x: 240, y: 258, w: 630, h: 473 });
  await box('.welcome-wordmark', { x: 1077, y: 188, h: 34 });
  for (const [field, y] of [['project', 351], ['space', 482], ['participant', 617]]) {
    await box(`.welcome-field--${field} input`, { x: 1077, y, w: 575, h: 62, r: '8px', border: '0px' });
  }
  await box('.welcome-guidance', { x: 1077, y: 723, w: 575 });
  await box('.welcome-start', { x: 1052, y: 814, w: 600, h: 80, r: '12px' });
  await page.screenshot({ path: `${out}/home.png` });
  await page.getByRole('textbox', { name: '참가자 번호', exact: true }).fill('P03');
  await page.getByRole('button', { name: '프로젝트 시작하기', exact: true }).click();
  await page.waitForURL('**/space');
  await box('.app-header', { h: 92 });
  await box('.content-wrap', { x: 240, w: 1440 });
  // Main/header alignment deliberately shares x=240; source main frame is x=242.
  await box('.swipe-carousel--notched', { x: 286, y: 218, w: 932, h: 694 });
  await box('.space-direction-panel', { x: 1274, y: 171, w: 396, h: 792, r: '8px', border: '0px' });
  await box('.space-section-title', { y: 199, h: 24 });
  await box('.space-baseline-list', { y: 409, h: 161, r: '6px' });
  await box('.space-goal textarea', { y: 644, w: 370, h: 188, r: '8px', background: 'rgba(243, 244, 244, 0.6)' });
  await box('.space-direction-footer .button', { y: 901, w: 162, h: 44, r: '12px' });
  const type = await page.locator('.space-source-tabs button, .space-direction-section h2, .space-baseline-select, .space-goal textarea, .space-direction-footer .button').evaluateAll(nodes => nodes.map(n => ({ name: n.className, text: n.textContent, size: getComputedStyle(n).fontSize, line: getComputedStyle(n).lineHeight })));
  for (const text of type) assert.equal(text.size, text.name === 'space-baseline-select' ? '16px' : text.name === '' && !text.text ? '14px' : '20px', JSON.stringify(text));
  assert.equal(await page.locator('.source-provenance').count(), 0);
  assert.equal(await page.locator('.workspace-pin').count(), 6);
  assert.deepEqual(await page.locator('.space-baseline-select > img').evaluateAll(nodes => nodes.map(n => n.getAttribute('src'))), ['structure-front', 'structure-back', 'structure-window', 'structure-entrance-wall', 'structure-entrance'].map(n => `/figma/source/${n}.svg`));
  const sizes = [];
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1864, height: 932 }, { width: 1313, height: 932 }, { width: 1220, height: 672 }]) {
    await page.setViewportSize(viewport); await page.evaluate(() => document.fonts.ready);
    const fit = await page.locator('.space-direction-panel').evaluate(e => {
      const box = e.getBoundingClientRect(), scroll = e.querySelector('.space-direction-scroll');
      const goal = e.querySelector('textarea').getBoundingClientRect(), next = e.querySelector('.space-direction-footer button').getBoundingClientRect();
      const controls = [...e.querySelectorAll('button, textarea, .file-pick, h2')].filter(n => n.getClientRects().length && !n.closest('.sr-only')).map(n => { const r = n.getBoundingClientRect(); return { text: n.textContent, top: r.top, bottom: r.bottom }; });
      return { scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight, goalHeight: goal.height, panelTop: box.top, panelBottom: box.bottom, nextTop: next.top, nextBottom: next.bottom, controls, pageWidth: document.documentElement.scrollWidth };
    });
    assert(fit.scrollHeight <= fit.clientHeight + 1, `sidebar overflow ${JSON.stringify({ viewport, fit })}`);
    assert(fit.goalHeight >= 44 && fit.goalHeight <= 188, `goal fill ${JSON.stringify({ viewport, fit })}`);
    assert(fit.controls.every(c => c.top >= fit.panelTop && c.bottom <= fit.panelBottom), `clipped content ${JSON.stringify({ viewport, fit })}`);
    assert(fit.pageWidth <= viewport.width);
    const deleteButton = page.locator('.space-concept-image > button').first();
    await page.mouse.move(0, 0); await page.locator('.space-source-tabs button').first().focus();
    assert.equal(await deleteButton.evaluate(e => getComputedStyle(e).opacity), '0');
    await page.locator('.space-concept-image').first().hover();
    assert.equal(await deleteButton.evaluate(e => getComputedStyle(e).opacity), '1');
    await page.mouse.move(0, 0); await deleteButton.focus();
    assert.equal(await deleteButton.evaluate(e => getComputedStyle(e).opacity), '1');
    await page.locator('.space-source-tabs button').first().focus();
    await page.screenshot({ path: `${out}/space-${viewport.width}x${viewport.height}.png` });
    sizes.push({ viewport, fit });
  }
  actual.responsiveFit = sizes; actual.typography = type;
  await page.setViewportSize({ width: 1920, height: 1080 });
  const dropConcept = () => page.locator('.space-concept-images .file-pick').evaluate(async node => {
    const blob = await (await fetch('/sample/campus/projectroom-front.jpg')).blob();
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], '분위기 드롭.jpg', { type: 'image/jpeg' }));
    node.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  for (let count = 2; count <= 4; count++) {
    if (count === 2) await dropConcept();
    else await page.locator('.space-concept-images input[type=file]').setInputFiles('public/sample/campus/projectroom-front.jpg');
    await page.waitForFunction(n => document.querySelectorAll('.space-concept-image').length === n, count);
  }
  assert(await page.locator('.space-concept-images input[type=file]').isDisabled());
  await dropConcept();
  assert.equal(await page.locator('.space-concept-image').count(), 4);
  await page.setViewportSize({ width: 1220, height: 672 });
  const multiFit = await page.locator('.space-direction-scroll').evaluate(e => ({ scroll: e.scrollHeight, height: e.clientHeight, goal: e.querySelector('textarea').getBoundingClientRect().height }));
  assert(multiFit.scroll <= multiFit.height + 1 && multiFit.goal >= 44, `four concepts overflow ${JSON.stringify(multiFit)}`);
  await page.locator('.space-concept-image').last().hover();
  await page.screenshot({ path: `${out}/space-four-concepts-hover.png` });
  await page.locator('.space-concept-image > button').last().click();
  await page.waitForFunction(() => document.querySelectorAll('.space-concept-image').length === 3);
  await page.getByRole('button', { name: '삭제 되돌리기', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.space-concept-image').length === 4);
  actual.fourConceptImages = { fit: multiFit, deletionUndo: true };
  await page.setViewportSize({ width: 1920, height: 1080 });
  const clip = await page.locator('.swipe-carousel--notched .is-active .space-photo').evaluate(e => getComputedStyle(e).clipPath);
  assert(clip.includes('A 14.4 14.4'));
  await page.screenshot({ path: `${out}/space.png` });
  // Untouched defaults must not overwrite a saved custom title on resume.
  const key = 'ai-reference-interpreter:projects:v1';
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).projects.find(p => p.id === new URL(location.href).pathname.split('/')[2]), key);
  const id = (await saved()).id;
  await page.getByRole('button', { name: '프로젝트 목록으로 이동', exact: true }).click();
  await page.getByRole('textbox', { name: '프로젝트 이름', exact: true }).fill('수정한 프로젝트 이름');
  await page.getByRole('textbox', { name: '공간 유형', exact: true }).fill('작품 전시');
  await page.getByRole('textbox', { name: '참가자 번호', exact: true }).fill('P03');
  await page.getByRole('button', { name: '프로젝트 시작하기', exact: true }).click();
  await page.waitForURL('**/space');
  assert.equal((await saved()).id, id); assert.equal((await saved()).name, '수정한 프로젝트 이름'); assert.equal((await saved()).spaceType, '작품 전시');
  await page.reload(); assert.equal((await saved()).name, '수정한 프로젝트 이름');
  await page.getByRole('button', { name: '프로젝트 목록으로 이동', exact: true }).click();
  await page.getByRole('textbox', { name: '참가자 번호', exact: true }).fill('P03');
  await page.getByRole('button', { name: '프로젝트 시작하기', exact: true }).click();
  await page.waitForURL('**/space');
  assert.equal((await saved()).name, '수정한 프로젝트 이름'); assert.equal((await saved()).spaceType, '작품 전시');
  assert.deepEqual(errors, []);
  await writeFile(`${out}/geometry.json`, JSON.stringify({ passed: true, actual, errors, paidCalls: 0, resume: 'edited values persist; untouched defaults do not reset saved values' }, null, 2));
  console.log('Source geometry, original radii, editable defaults and saved project resume passed; paid calls=0');
} finally { await browser.close(); }
