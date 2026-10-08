// Disposable browser profile. Generation is mocked; no paid model call.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
const out = process.env.QA_SCREENSHOT_DIR || 'qa-screens/design-20261007';
const key = 'ai-reference-interpreter:projects:v1';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/status', route => route.fulfill({ json: { available: true, requiresAccessCode: false, quota: { totalLimit: 60, remaining: 60, dailyLimit: 20, dailyRemaining: 20, used: 0, busy: false } } }));
  const imageDataUrl = 'data:image/jpeg;base64,' + (await readFile('public/sample/campus/projectroom-front.jpg')).toString('base64');
  await page.route('**/api/generate', route => { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { imageDataUrl } }); });
  const shot = async name => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `${out}/${name}.png` }); };
  async function checkPanelSurfaces() {
    const continuousEditor = await page.locator('.layout-editor, .mapping-editor').count() > 0;
    const panels = await page.locator('.layout-panel, .layout-canvas-panel, .space-direction-panel, .workspace-main, .workspace-side, .review-main, .review-side, .result-main, .result-inspector').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length && !n.classList.contains('space-evidence')).map(n => {
      const s = getComputedStyle(n);
      return { name: n.className, radius: s.borderRadius, border: s.borderTopWidth, shadow: s.boxShadow };
    }));
    assert(panels.length > 0);
    for (const panel of panels) {
      assert.equal(panel.radius, continuousEditor ? '0px' : '8px', panel.name);
      assert.equal(panel.border, '0px', panel.name);
      assert(continuousEditor ? panel.shadow === 'none' : panel.shadow.includes('0px 0px 8px'), panel.name);
    }
  }
  async function exportPlan(name) {
    // Only the saved 2D diagram is exported, never a flattened UI screen.
    const svg = await page.locator('.plan-canvas__svg').first().evaluate(node => {
      const clone = node.cloneNode(true), originals = [node, ...node.querySelectorAll('*')], copies = [clone, ...clone.querySelectorAll('*')];
      const properties = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'opacity', 'font-size', 'font-weight', 'display', 'visibility'];
      originals.forEach((original, index) => { const style = getComputedStyle(original); properties.forEach(property => copies[index].style.setProperty(property, style.getPropertyValue(property))); copies[index].style.fontFamily = 'Noto Sans KR'; });
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); return clone.outerHTML;
    });
    await writeFile(`${out}/${name}.svg`, svg);
  }
  await page.goto(base); await shot('home');
  assert.equal(await page.locator('.welcome').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(28, 31, 33)');
  assert.equal(await page.locator('.main-content').evaluate(e => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)');
  assert.equal(await page.locator('.welcome-panel__surface').evaluate(e => getComputedStyle(e).borderRadius), '40px 0px 0px 40px');
  assert.equal(await page.locator('.brand-wordmark').getAttribute('src'), '/brand/figma-wordmark-dark.svg');
  assert.equal(await page.locator('.brand-wordmark').evaluate(e => getComputedStyle(e).filter), 'none');
  assert.equal(await page.locator('.welcome-art__image').getAttribute('src'), '/brand/home-spatial-collage.png');
  await page.waitForFunction(() => document.querySelector('.welcome-art__image')?.naturalWidth > 0);
  const start = page.getByRole('button', { name: '프로젝트 시작하기', exact: true });
  assert(await start.isDisabled());
  const projectName = page.getByRole('textbox', { name: '프로젝트 이름', exact: true });
  const spaceType = page.getByRole('textbox', { name: '공간 유형', exact: true });
  assert.equal(await projectName.inputValue(), '한국공학대학교 프로젝트룸 · 졸업전시');
  assert(await projectName.isEditable()); assert(await spaceType.isEditable());
  assert.equal(await page.getByRole('textbox', { name: '공간 유형', exact: true }).inputValue(), '졸업전시 공간');
  await page.mouse.move(700, 400);
  assert.notEqual(await page.locator('.welcome-art__parallax').evaluate(e => e.style.getPropertyValue('--pointer-x')), '0');
  const movement = await page.locator('.welcome-art__parallax').evaluate(e => {
    const s = getComputedStyle(e), matrix = new DOMMatrixReadOnly(s.transform);
    return { x: matrix.m41, y: matrix.m42, maxX: s.getPropertyValue('--landing-parallax-x'), maxY: s.getPropertyValue('--landing-parallax-y') };
  });
  assert(Math.abs(movement.x) <= 2 && Math.abs(movement.y) <= 1.5);
  assert.equal(movement.maxX.trim(), '2px'); assert.equal(movement.maxY.trim(), '1.5px');
  assert.equal(await page.locator('.welcome-art__image').evaluate(e => getComputedStyle(e).animationName), 'welcome-float');
  assert.equal(await page.locator('.welcome-art__image').evaluate(e => getComputedStyle(e).animationDuration), '6s');
  assert.equal(await page.locator('.welcome-art__image').evaluate(e => getComputedStyle(e).getPropertyValue('--landing-float-distance').trim()), '14px');
  const participant = page.getByRole('textbox', { name: '참가자 번호', exact: true });
  await participant.fill('wrong'); assert(await start.isDisabled());
  await participant.fill('p01'); assert.equal(await participant.inputValue(), 'P01'); assert(await start.isEnabled());
  await projectName.fill('   '); assert(await start.isDisabled());
  const customName = '한국공학대학교 프로젝트룸 · 작품 전시', customType = '졸업작품 전시 공간';
  await projectName.fill(customName); await spaceType.fill(''); assert(await start.isDisabled());
  await spaceType.fill(customType); assert(await start.isEnabled()); await shot('home-ready');
  const fonts = await page.evaluate(() => ({ ui: document.fonts.check('500 16px "Wanted Sans Variable"'), loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family), brand: document.fonts.check('700 34px "timeline-210"') }));
  await start.click(); assert.equal(await page.locator('.welcome').getAttribute('aria-busy'), 'true');
  assert(await page.getByRole('button', { name: '프로젝트 여는 중', exact: true }).isDisabled()); await page.waitForURL('**/space');
  const id = new URL(page.url()).pathname.split('/')[2];
  const project = () => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).projects.find(p => p.id === id), { key, id });
  assert.equal((await project()).name, customName); assert.equal((await project()).spaceType, customType);
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('ai-reference-interpreter:experiment:v1')).sessions);
  assert.equal(sessions.length, 1); assert.equal(sessions[0].participant_id, 'P01');
  assert.equal((await project()).floorPlan.structures.filter(s => s.preservationRequired).length, 7);
  assert.equal(await page.locator('.space-required').count(), 5); assert.equal(await page.locator('.space-baseline-list input[type=checkbox]').count(), 0);
  await checkPanelSurfaces();
  assert.equal(await page.locator('.plan-camera').count(), 0);
  const photoOutline = await page.locator('.swipe-carousel--notched .is-active .space-photo').evaluate(node => getComputedStyle(node).clipPath);
  assert(photoOutline.startsWith('path(')); assert(photoOutline.includes('A 14.4 14.4'));
  await page.getByRole('button', { name: '실제 공간 사진 다음 항목', exact: true }).click();
  assert.equal(await page.locator('.swipe-carousel__count').textContent(), '2 / 2');
  await page.getByRole('button', { name: '실제 공간 사진 이전 항목', exact: true }).click();
  assert.equal(await page.locator('.swipe-carousel__count').textContent(), '1 / 2');
  await page.locator('.swipe-carousel__viewport').focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('.swipe-carousel__count').textContent(), '2 / 2');
  await page.keyboard.press('ArrowLeft'); await page.locator('.swipe-carousel__viewport').evaluate(node => node.blur()); await shot('space-photo');
  const goal = '작품 사이를 편하게 이동할 수 있는 밝고 차분한 졸업전시 공간';
  await page.getByRole('textbox', { name: '디자인 목표', exact: true }).fill(goal);
  await page.getByRole('button', { name: '평면도', exact: true }).click(); assert.equal((await project()).designGoal, goal);
  await shot('space-plan'); await exportPlan('space-plan');
  const hatches = await page.locator('pattern .plan-movement-hatch').evaluateAll(nodes => nodes.map(n => ({ className: n.getAttribute('class'), color: getComputedStyle(n).stroke })));
  assert(hatches.some(a => hatches.some(b => a.color !== b.color)));
  await page.reload(); assert.equal(await page.getByRole('textbox', { name: '디자인 목표', exact: true }).inputValue(), goal);
  await page.getByRole('button', { name: '다음으로', exact: true }).click(); await page.waitForURL('**/placement');
  await checkPanelSurfaces();
  const stage = name => page.locator('.step-nav').getByRole('button', { name, exact: true }).click();
  async function point(x, y) { return page.locator('.plan-canvas__svg').first().evaluate((svg, { x, y }) => { const p = svg.createSVGPoint(); p.x = x * svg.viewBox.baseVal.width; p.y = y * svg.viewBox.baseVal.height; const q = p.matrixTransform(svg.querySelector(':scope > g').getScreenCTM()); return { x: q.x, y: q.y }; }, { x, y }); }
  async function click(x, y) { const p = await point(x, y); await page.mouse.click(p.x, p.y); }
  for (const [x, y] of [[.3, .3], [.5, .3], [.3, .5], [.5, .5]]) { await page.getByRole('button', { name: '전시대', exact: true }).click(); await click(x, y); }
  const items = (await project()).elements; assert.equal(items.length, 4);
  await page.locator('.plan-canvas__svg').focus(); await page.keyboard.press('Control+z'); assert.equal((await project()).elements.length, 3);
  await page.keyboard.press('Control+Shift+z'); assert.equal((await project()).elements.length, 4);
  await shot('placement'); await exportPlan('placement-plan');
  await stage('03 레퍼런스 적용');
  await checkPanelSurfaces();
  const target = itemId => page.locator(`[data-mapping-target="${itemId}"]`);
  await target(items[0].id).click(); await target(items[1].id).click({ modifiers: ['Shift'] }); await target(items[3].id).click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: '선택한 3개에 적용', exact: true }).click();
  assert.equal((await project()).referenceBindings[0].layoutItemIds.length, 3); assert.equal((await project()).references.length, 3); await shot('references');
  await stage('04 시안 생성'); assert.equal((await project()).cameras.length, 3);
  await checkPanelSurfaces();
  assert(await page.getByRole('button', { name: '결과 확인·수정', exact: true }).isDisabled()); await shot('review'); await exportPlan('review-plan');
  await page.getByRole('button', { name: '시점 수정', exact: true }).click(); await page.waitForURL('**/camera');
  await page.getByRole('button', { name: '이전 단계', exact: true }).click(); await page.waitForURL('**/review');
  await page.getByRole('button', { name: 'AI 이미지 생성', exact: true }).click();
  try { await page.waitForURL('**/results', { timeout: 15000 }); } catch (error) { await shot('generation-failure'); console.log({ requests: requests.length, screen: await page.locator('.main-content').innerText(), errors }); throw error; }
  assert.equal(requests.length, 1); assert.equal(requests[0].project.designGoal, goal);
  assert.equal((await project()).results[0].conditionsSnapshot.common.designGoal, goal);
  await page.waitForFunction(() => document.querySelector('img.result-image')?.naturalWidth > 0); await shot('result-mocked');
  await checkPanelSurfaces();
  await page.locator('.result-inspector').getByRole('button', { name: '레이아웃 수정', exact: true }).click(); await page.waitForURL('**/placement');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1101, height: 884 }, { width: 900, height: 700 }, { width: 614, height: 672 }]) {
    await page.setViewportSize(viewport); await shot(`placement-${viewport.width}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const header = await page.locator('.app-header').boundingBox(), main = await page.locator('.main-content').boundingBox();
    assert(main.y >= header.y + header.height - 1, 'header must not overlap workspace');
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await stage('01 공간·방향 설정');
  await page.getByRole('textbox', { name: '디자인 목표', exact: true }).fill(goal + ' · 수정'); await page.getByRole('button', { name: '평면도', exact: true }).click();
  assert((await project()).results[0].stale); assert.equal((await project()).results.length, 1);
  await page.reload(); assert.equal((await project()).designGoal, goal + ' · 수정');
  const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage(); await reducedPage.goto(base);
  assert.equal(await reducedPage.locator('.welcome-art__image').evaluate(e => getComputedStyle(e).animationName), 'none');
  assert.equal(await reducedPage.locator('.welcome-art__parallax').evaluate(e => getComputedStyle(e).transform), 'none');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 900, height: 700 }, { width: 614, height: 672 }, { width: 390, height: 844 }]) {
    await reducedPage.setViewportSize(viewport);
    await reducedPage.screenshot({ path: `${out}/home-${viewport.width}.png` });
    assert.equal(await reducedPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await reducedPage.locator('.welcome').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(28, 31, 33)');
    if (viewport.width < 768) assert.equal(await reducedPage.locator('.help-link').evaluate(e => getComputedStyle(e).color), 'rgb(255, 255, 255)', 'mobile help must remain readable on the dark backdrop');
  }
  await reducedPage.setViewportSize({ width: 1440, height: 900 });
  await reducedPage.getByRole('textbox', { name: '참가자 번호', exact: true }).fill('P02'); await reducedPage.getByRole('button', { name: '프로젝트 시작하기', exact: true }).click(); await reducedPage.waitForURL('**/space');
  assert.deepEqual(errors, []);
  await writeFile(`${out}/summary.json`, JSON.stringify({ passed: true, errors, fonts, mockRequests: requests.length, paidCalls: 0, scenarios: ['prefilled inputs', 'participant validation', 'floating/parallax', 'entry transition', 'automatic local logging', 'fixed baseline', 'goal persistence/generation/stale result', 'hatch distinction', 'placement undo/redo', 'multi mapping', 'camera recommendation/return', 'result shortcuts', 'responsive layout', 'reduced motion'] }, null, 2));
  console.log('Home → Step 01–04, goal/model input/snapshot/reload, fixed structures, multi mapping, responsive layout and reduced motion passed; JS errors=0; paid calls=0');
} finally { await browser.close(); }
