// Isolated browser profiles; verify real fonts and in-panel navigation, no paid calls.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/yea11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const manifest = JSON.parse(await readFile('docs/FONT_ASSETS_20261008.json', 'utf8'));
const out = process.env.QA_SCREENSHOT_DIR || 'qa-screens/typography-20261008/fonts-navigation';
const digest = buffer => createHash('sha256').update(buffer).digest('hex');
for (const font of manifest.fonts) {
  for (const root of ['public', 'dist']) {
    assert.equal(digest(await readFile(`${root}/${font.publicPath}`)), font.sha256);
  }
}
assert.equal(digest(await readFile(`dist/${manifest.licensePath}`)), manifest.licenseSha256);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const reports = [];
try {
  for (const base of [process.env.QA_BASE_URL || 'http://127.0.0.1:5174', process.env.QA_PRODUCTION_URL || 'http://127.0.0.1:5175']) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/generate', route => route.abort());
    await page.route('**/api/status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: false, requiresAccessCode: false }) }));
    await page.goto(base);
    await page.waitForFunction(() => /wf-(active|inactive)/.test(document.documentElement.className));
    for (const font of manifest.fonts) {
      const response = await context.request.get(`${base}/${font.publicPath}`);
      assert.equal(response.status(), 200);
      assert.equal(digest(await response.body()), font.sha256);
    }
    // Force each actual supplied face to decode, including less frequent weights.
    await page.evaluate(async () => {
      for (const weight of [400, 500, 600, 700, 800]) {
        const faces = await document.fonts.load(`${weight} 18px Paperlogy`, '공간 방향 설정');
        if (faces.length !== 1 || faces[0].status !== 'loaded') throw new Error(`Paperlogy ${weight} not decoded`);
      }
      await document.fonts.ready;
    });
    const home = await page.locator('.welcome-wordmark, .welcome-field > span, .welcome-field input, .welcome-start, .welcome-art h1').evaluateAll(nodes => nodes.map(n => ({ selector: n.className || n.tagName, size: getComputedStyle(n).fontSize })));
    await page.getByRole('textbox', { name: '참가자 번호', exact: true }).fill('P12');
    await page.getByRole('button', { name: '프로젝트 시작하기', exact: true }).click();
    await page.waitForURL('**/space');
    const id = new URL(page.url()).pathname.split('/')[2];
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    async function actualFont(selector) {
      const { root } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      return (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts.map(f => ({ family: f.familyName, postScriptName: f.postScriptName, custom: f.isCustomFont, glyphs: f.glyphCount }));
    }
    await page.evaluate(() => document.fonts.ready);
    const fonts = { progress: await actualFont('.step-link.is-current .step-label'), photo: await actualFont('.space-evidence__content figcaption'), body: await actualFont('.space-baseline-select'), tabs: await actualFont('.space-source-tabs button') };
    assert(fonts.progress.some(f => f.family.includes('Paperlogy') && f.custom && f.glyphs > 0));
    assert(fonts.photo.some(f => f.family.includes('Paperlogy') && f.custom && f.glyphs > 0));
    assert(fonts.body.some(f => f.family.includes('Wanted') && f.custom && f.glyphs > 0));
    const screens = [];
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1220, height: 672 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
      await page.setViewportSize(viewport);
      for (const step of ['space', 'placement', 'references', 'review', 'camera', 'results']) {
        await page.goto(`${base}/projects/${id}/${step}`);
        await page.evaluate(() => document.fonts.ready);
        const nav = step === 'review' ? page.locator('.workflow-footer--generate') : page.getByRole('navigation', { name: '단계 이동', exact: true });
        assert.equal(await nav.count(), 1);
        await nav.scrollIntoViewIfNeeded();
        const fit = await nav.evaluate(n => {
          const side = n.closest('aside');
          const b = n.getBoundingClientRect(), p = side?.getBoundingClientRect();
          return { contained: !!side, x: b.x, y: b.y, right: b.right, bottom: b.bottom, panel: p ? { x: p.x, y: p.y, right: p.right, bottom: p.bottom } : null, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert(fit.contained && fit.panel);
        assert(fit.x >= fit.panel.x && fit.right <= fit.panel.right && fit.bottom <= fit.panel.bottom + 1);
        assert(!fit.overflow);
        const smallText = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(n => n instanceof HTMLElement && !n.closest('.sr-only') && [...n.childNodes].some(c => c.nodeType === Node.TEXT_NODE && c.textContent.trim())).flatMap(n => {
          const b = n.getBoundingClientRect(), s = getComputedStyle(n);
          return b.width > 4 && b.height > 4 && s.visibility !== 'hidden' && Number(s.opacity) > 0 && parseFloat(s.fontSize) > 0 && parseFloat(s.fontSize) < 12 ? [{ text: n.textContent.trim().slice(0, 70), size: s.fontSize }] : [];
        }));
        assert.deepEqual(smallText, [], `text below 12px ${step}`);
        const label = base.endsWith('5175') ? 'production' : 'development';
        await page.screenshot({ path: `${out}/${label}-${step}-${viewport.width}.png` });
        screens.push({ step, viewport, fit });
      }
    }
    // Enter from a panel footer navigates, and browser history/reload retain the project.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${base}/projects/${id}/placement`);
    const next = page.getByRole('navigation', { name: '단계 이동' }).getByRole('button', { name: '다음으로', exact: true });
    await next.focus(); await page.keyboard.press('Enter'); await page.waitForURL('**/references');
    await page.goBack(); await page.waitForURL('**/placement'); await page.reload();
    assert.equal(await page.getByRole('navigation', { name: '단계 이동' }).count(), 1);
    assert.deepEqual(errors, []);
    reports.push({ base, home, fonts, screens, errors });
    await context.close();
  }
  assert.deepEqual(reports[0].fonts, reports[1].fonts, 'development/production actual glyph fonts differ');
  assert.deepEqual(reports[0].home, reports[1].home, 'development/production home typography differs');
  await writeFile(`${out}/verification.json`, JSON.stringify({ fontAssets: manifest.fonts.length, reports }, null, 2));
  console.log(JSON.stringify({ out, assets: manifest.fonts.length, screens: reports.reduce((sum, r) => sum + r.screens.length, 0), actualFontsMatch: true, errors: [] }));
} finally { await browser.close(); }
