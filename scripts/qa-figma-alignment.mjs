// Disposable browser profile; no real image generation calls.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/yea11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5174';
const out = process.env.QA_SCREENSHOT_DIR || 'qa-screens/alignment-20261008/before';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/generate', route => route.abort());
  await page.route('**/api/status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: false, requiresAccessCode: false }) }));
  async function capture(name) {
    await page.waitForFunction(() => /wf-(active|inactive)/.test(document.documentElement.className), { timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `${out}/${name}.png` });
    return page.evaluate(() => {
      const selectors = ['.app-header', '.brand-mark', '.brand-wordmark', '.step-nav', '.page-intro', '.page-intro-right', '.welcome-panel__surface', '.welcome-art__parallax', '.welcome-wordmark', '.welcome-title p', '.welcome-art h1', '.welcome-field > span', '.welcome-field input', '.welcome-guidance', '.welcome-start', '.content-wrap', '.space-direction-panel', '.space-direction-section h2', '.space-goal textarea', '.space-direction-footer .button', '.space-source-tabs', '.swipe-carousel--notched', '.layout-panel', '.layout-canvas-panel', '.mapping-reference', '.review-main', '.review-side', '.workflow-footer'];
      const nodes = selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(e => {
        const b = e.getBoundingClientRect(), s = getComputedStyle(e);
        return { selector, text: e.textContent?.trim().slice(0, 90), x: b.x, y: b.y, width: b.width, height: b.height, font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, radius: s.borderRadius, border: s.borderWidth, shadow: s.boxShadow, background: s.backgroundColor, color: s.color };
      }));
      return { url: location.href, viewport: { width: innerWidth, height: innerHeight }, overflow: document.documentElement.scrollWidth > innerWidth, fonts: [...document.fonts].map(f => ({ family: f.family, weight: f.weight, status: f.status })), nodes };
    });
  }
  await page.goto(base);
  const report = { home: await capture('home') };
  await page.getByRole('textbox', { name: '참가자 번호', exact: true }).fill('P08');
  report.homeReady = await capture('home-ready');
  await page.getByRole('button', { name: '프로젝트 시작하기', exact: true }).click();
  await page.waitForURL('**/space');
  report.space = await capture('step1-photo');
  await page.getByRole('button', { name: '평면도', exact: true }).click();
  report.plan = await capture('step1-plan');
  await page.getByRole('button', { name: '다음으로', exact: true }).click();
  report.placement = await capture('step2');
  const id = new URL(page.url()).pathname.split('/')[2];
  for (const [step, name] of [['references', 'step3'], ['review', 'step4-review'], ['camera', 'step4-camera'], ['results', 'step4-results']]) {
    await page.goto(`${base}/projects/${id}/${step}`);
    report[step] = await capture(name);
  }
  report.responsive = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const step of ['home', 'space', 'placement', 'references', 'review', 'camera', 'results']) {
      await page.goto(step === 'home' ? base : `${base}/projects/${id}/${step}`);
      const measured = await capture(`${step}-${viewport.width}`);
      assert.equal(measured.overflow, false, `page overflow ${step} ${viewport.width}`);
      const panels = await page.locator('.layout-editor > *, .mapping-editor > *').evaluateAll(nodes => nodes.map(n => { const b = n.getBoundingClientRect(); return { x: b.x, width: b.width }; }));
      assert(panels.every(b => b.x >= 0 && b.x + b.width <= viewport.width), `workspace panel clipped ${step} ${viewport.width}: ${JSON.stringify(panels)}`);
      const images = await page.locator('img').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ src: n.getAttribute('src'), loaded: n.complete && n.naturalWidth > 0 })));
      assert(images.every(n => n.loaded), `unloaded images ${step}: ${JSON.stringify(images.filter(n => !n.loaded))}`);
      if (step !== 'home') {
        const guide = page.getByRole('link', { name: '사용 가이드 (새 탭)', exact: true });
        assert(await guide.isVisible());
        const b = await guide.boundingBox();
        assert(b.x >= 0 && b.x + b.width <= viewport.width, `guide clipped ${step}`);
        const current = await page.locator('.step-link.is-current .step-label').evaluate(n => ({ size: getComputedStyle(n).fontSize, weight: getComputedStyle(n).fontWeight, family: getComputedStyle(n).fontFamily }));
        assert.equal(current.size, '18px'); assert.equal(current.weight, '500'); assert(current.family.startsWith('Paperlogy'));
        assert.equal(await page.locator('.page-intro-right').count(), 0);
        if (step !== 'space') {
          const nav = page.locator('aside > .workflow-footer .workflow-navigation');
          await nav.scrollIntoViewIfNeeded();
          assert(await nav.isVisible());
          const box = await nav.boundingBox();
          assert(box.y >= 0 && box.y + box.height <= viewport.height, `footer clipped ${step}`);
          await nav.getByRole('button', { name: '이전 단계', exact: true }).focus();
          assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'solid');
        }
      }
      report.responsive.push({ step, viewport, overflow: measured.overflow, imageCount: images.length });
    }
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${base}/projects/${id}/placement`);
  await page.locator('.workflow-footer').getByRole('button', { name: '다음으로', exact: true }).focus();
  await page.keyboard.press('Enter'); await page.waitForURL('**/references');
  await page.locator('.workflow-footer').getByRole('button', { name: '다음으로', exact: true }).click();
  await page.waitForURL('**/review');
  await page.locator('.workflow-footer').getByRole('button', { name: '이전 단계', exact: true }).click();
  await page.waitForURL('**/references');
  assert.deepEqual(errors, []);
  report.errors = errors;
  await writeFile(`${out}/measurements.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, errors, screens: Object.keys(report) }));
} finally { await browser.close(); }
