// Disposable browser profile. /api/generate is mocked: this does not test image quality.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
const key = 'ai-reference-interpreter:projects:v1';
const browser = await chromium.launch({ headless:true, args:['--no-proxy-server'], ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}) });
try {
  const page = await browser.newPage({viewport:{width:1575,height:884}});
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/status', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({available:true,requiresAccessCode:false,quota:{totalLimit:60,used:0,remaining:60,dailyLimit:20,dailyRemaining:20,busy:false}})}));
  await page.route('**/api/generate', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({imageDataUrl:'data:image/jpeg;base64,'+fs.readFileSync('public/sample/campus/projectroom-front.jpg').toString('base64')})});
  });
  await page.goto(base);
  await page.getByRole('button',{name:'저장한 프로젝트·다른 공간',exact:true}).click();
  await page.getByRole('button',{name:'졸업전시 구상 시작',exact:true}).click();
  const id = new URL(page.url()).pathname.split('/')[2];
  const project = () => page.evaluate(({key,id})=>JSON.parse(localStorage.getItem(key)).projects.find(p=>p.id===id),{key,id});
  const stage = name => page.locator('.step-nav').getByRole('button',{name}).click();
  const target = itemId => page.locator(`[data-mapping-target="${itemId}"]`);
  async function point(x,y) {
    return page.locator('.plan-canvas__svg').first().evaluate((svg,{x,y})=>{
      const p=svg.createSVGPoint();p.x=x*svg.viewBox.baseVal.width;p.y=y*svg.viewBox.baseVal.height;
      const q=p.matrixTransform(svg.querySelector(':scope > g').getScreenCTM());return{x:q.x,y:q.y};
    },{x,y});
  }
  async function click(x,y) { const p=await point(x,y);await page.mouse.click(p.x,p.y); }
  async function draw(x,y,ex,ey) { const a=await point(x,y),b=await point(ex,ey);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up(); }
  async function dragItem(itemId,x,y) { const before=(await project()).elements.find(e=>e.id===itemId),a=await point(before.target.x,before.target.y),b=await point(x,y);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up(); }
  async function dragTarget(itemId,x,y) { const a=await target(itemId).boundingBox(),b=await point(x,y);await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up(); }
  async function screenshot(name) { if(process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/'+name+'.png'});} }

  await stage('02 레이아웃 구성');
  const left=page.locator('.layout-editor>.layout-panel').first(),right=page.locator('.layout-inspector');
  await page.getByRole('button',{name:'분위기 영역',exact:true}).click();
  assert.equal(await left.locator('.layout-drawing-controls').count(),0);
  assert(await right.getByLabel('이름 (선택 사항)').isVisible());
  assert.match(await right.locator('.area-purpose').innerText(),/조명|소재/);
  await right.getByLabel('이름 (선택 사항)').fill('작품 감상 영역');
  await draw(.18,.62,.58,.85);
  await page.getByRole('button',{name:'그리기 마치기',exact:true}).click();
  let p=await project();const area=p.floorPlan.areas.find(a=>a.name==='작품 감상 영역');assert(area);
  await left.locator('details').first().locator('summary').click();await left.getByRole('button',{name:area.name,exact:true}).click();
  assert.match(await right.locator('.area-purpose').innerText(),/레퍼런스/);
  await page.getByRole('button',{name:'통행 동선',exact:true}).click();assert.match(await right.locator('.area-purpose').innerText(),/가벽|기둥/);
  await page.getByRole('button',{name:'그리기 마치기',exact:true}).click();
  for(const [x,y] of [[.3,.3],[.5,.3],[.3,.5],[.5,.5]]) {await page.getByRole('button',{name:'전시대',exact:true}).click();await click(x,y);}
  p=await project();const items=p.elements.filter(e=>e.origin==='layout'&&e.layoutKind==='display');assert.equal(items.length,4);
  assert(await right.getByLabel('이름 (선택 사항)').isVisible());assert(await right.getByRole('heading',{name:'크기',exact:true}).isVisible());
  await page.getByRole('button',{name:'조명',exact:true}).click();await right.getByLabel('조명 설치 위치').selectOption('ceiling');await click(.62,.56);
  p=await project();const ceiling=p.elements.find(e=>e.origin==='layout'&&e.target?.kind==='ceiling-zone');assert(ceiling);
  await page.getByRole('button',{name:'진열 상품',exact:true}).click();await right.getByRole('button',{name:items[0].label+' 위에 놓기',exact:true}).click();
  p=await project();const product=p.elements.find(e=>e.origin==='layout'&&e.target?.kind==='fixture-surface');assert(product);
  // The attached product hides the first stand center, so mapping tests use the others.
  const stand=items[1];
  const surface=page.locator('.plan-canvas__surface'),before=await surface.boundingBox();
  await page.locator('.plan-canvas__legend>summary').click();
  const menu=page.locator('.plan-legend-popover');assert(await menu.isVisible());
  assert.match(await menu.innerText(),/조명/);assert.match(await menu.innerText(),/분위기 영역/);
  assert.equal(await page.locator('.plan-canvas__legend').evaluate(e=>e.scrollWidth>e.clientWidth),false);
  const mb=await menu.boundingBox();assert(mb.x>=0&&mb.y>=0&&mb.x+mb.width<=1575);
  assert.equal((await surface.boundingBox()).height,before.height);
  await page.getByRole('button',{name:'범례 닫기',exact:true}).click();assert.equal(await menu.isVisible(),false);
  await page.locator('.plan-canvas__legend>summary').click();await page.keyboard.press('Escape');assert.equal(await menu.isVisible(),false);
  await screenshot('workspace-layout');console.log('right drawing controls, area purposes, selected properties, ceiling/product support and compact legend passed');

  await stage('03 레퍼런스 적용');
  assert.equal(await page.locator('.mapping-drag-source').count(),0);
  assert.equal(await page.getByLabel('이미지 종류',{exact:true}).count(),0);
  await page.locator('.mapping-upload-kind>summary').click();assert.match(await page.locator('.mapping-upload-kind').innerText(),/상품/);await page.locator('.mapping-upload-kind>summary').click();
  await page.locator('.mapping-panel input[type=file]').setInputFiles('public/sample/campus/exhibition-display.png');
  await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key)).projects.find(p=>p.id===id).references.length===4,{key,id});
  const ref=(await project()).references.at(-1);
  assert.equal(await page.locator('.mapping-thumbnails').evaluate(e=>getComputedStyle(e).display),'grid');
  await page.getByRole('button',{name:'영역 선택',exact:true}).click();await page.locator('.reference-region-picker__stage').focus();await page.keyboard.press('Enter');
  await target(stand.id).click();await target(items[2].id).click({modifiers:['Shift']});await target(items[3].id).click({modifiers:['Shift']});
  const apply=page.getByRole('button',{name:'선택한 3개에 적용',exact:true});
  if(!await apply.isVisible()){console.log('selection diagnostic',await page.locator('.mapping-selection-bar').innerText());await screenshot('workspace-selection-diagnostic');}
  assert(await apply.isVisible());
  const applyBefore=await apply.boundingBox();await page.locator('.mapping-panel .layout-tool-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);assert.deepEqual(await apply.boundingBox(),applyBefore);
  await apply.click();let binding=(await project()).referenceBindings.find(b=>b.referenceId===ref.id);assert.equal(binding.layoutItemIds.length,3);assert(binding.sourceRegion);
  await page.locator('.reference-region-picker__selection').dragTo(target(stand.id));
  p=await project();assert.equal(p.referenceBindings.find(b=>b.referenceId===ref.id).layoutItemIds.length,3);assert(p.referenceBindings.find(b=>b.referenceId===ref.id).sourceRegion);
  await screenshot('workspace-mapping');
  await page.getByRole('button',{name:'매핑 현황',exact:true}).click();
  await page.getByRole('button',{name:'변경',exact:true}).click();await page.getByLabel('가져올 내용').selectOption('material');await page.getByRole('button',{name:'변경 저장',exact:true}).click();
  p=await project();let changed=p.referenceBindings.find(b=>b.id===binding.id);assert.equal(changed.scope,'material');assert.deepEqual(changed.sourceRegion,binding.sourceRegion);assert.deepEqual(changed.layoutItemIds,binding.layoutItemIds);
  assert.equal(await page.getByRole('button',{name:'매핑 현황',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'변경',exact:true}).click();await page.getByLabel('가져올 내용').selectOption('lighting');await page.getByRole('button',{name:'변경 저장',exact:true}).click();
  assert.equal((await project()).referenceBindings.find(b=>b.id===binding.id).scope,'material');assert(await page.getByRole('button',{name:'오류 닫기',exact:true}).isVisible());
  await page.getByRole('button',{name:'오류 닫기',exact:true}).click();assert.equal(await page.locator('.alert-error').count(),0);
  await page.getByRole('button',{name:'변경 저장',exact:true}).click();await page.waitForTimeout(2200);assert.equal(await page.locator('.alert-error').count(),0);await page.getByRole('button',{name:'취소',exact:true}).click();
  await dragItem(stand.id,.6,.36);p=await project();assert(Math.abs(p.elements.find(e=>e.id===stand.id).target.x-.6)<.02);assert(p.referenceBindings.find(b=>b.id===binding.id).layoutItemIds.includes(stand.id));
  await page.locator('.plan-canvas__svg').focus();await page.keyboard.press('Control+z');assert.equal((await project()).elements.find(e=>e.id===stand.id).target.x,stand.target.x);
  await page.keyboard.press('Control+Shift+z');assert(Math.abs((await project()).elements.find(e=>e.id===stand.id).target.x-.6)<.02);
  await page.reload();assert(Math.abs((await project()).elements.find(e=>e.id===stand.id).target.x-.6)<.02);
  await dragItem(stand.id,.5,.5);assert(Math.abs((await project()).elements.find(e=>e.id===stand.id).target.x-.6)<.02);await page.waitForTimeout(2200);assert.equal(await page.locator('.alert-error').count(),0);
  // Whole image drag is also optional; keep crop multi binding separate.
  await page.getByRole('button',{name:'exhibition-display.png 선택',exact:true}).click();
  await page.getByRole('button',{name:'전체 이미지',exact:true}).click();await page.locator('.reference-region-picker__stage').dragTo(target(ceiling.id));
  assert((await project()).referenceBindings.some(b=>b.referenceId===ref.id&&b.layoutItemIds.includes(ceiling.id)));
  await dragTarget(ceiling.id,.66,.58);p=await project();const ceilingTarget=p.elements.find(e=>e.id===ceiling.id).target,zone=p.floorPlan.areas.find(a=>a.id===ceilingTarget.zoneId);
  assert(Math.abs(zone.bounds.x+zone.bounds.width*ceilingTarget.offset.x-.66)<.01);assert.equal(ceilingTarget.zoneId,ceiling.target.zoneId);
  await dragTarget(product.id,.32,.31);p=await project();const productTarget=p.elements.find(e=>e.id===product.id).target;
  assert.equal(productTarget.fixtureElementId,product.target.fixtureElementId);assert(Math.abs(productTarget.offset.x-.7)<.03);
  console.log('crop/whole image drop, fixed apply, inline scope edit, invalid move, toast X/2s and bound-item move undo/redo/reload passed');

  await stage('04 시안 생성');assert.equal(await page.getByRole('button',{name:'결과 확인·수정',exact:true}).isDisabled(),true);
  assert(await page.locator('.camera-summary-views .nucleo-icon').evaluateAll(es=>es.length===3&&es.every(e=>e.style.maskImage.includes('IconCameraOutline18'))));
  assert.equal(await page.locator('.camera-summary-views button').count(),3);
  assert.match(await page.locator('.camera-summary').innerText(),/도면|아래/);
  assert(!/바닥 위치|35%,|33%/.test(await page.locator('.review-brief').innerText()));
  await screenshot('workspace-review');
  await page.getByRole('button',{name:'AI 이미지 생성',exact:true}).click();await page.waitForURL('**/results');
  assert.equal(requests.length,1);assert(requests[0].project.referenceBindings.length>0);assert(requests[0].images.some(i=>i.role==='floor-plan'));
  assert.equal(await page.getByRole('button',{name:'결과 확인·수정',exact:true}).isEnabled(),true);
  await page.waitForFunction(()=>document.querySelector('img.result-image')?.naturalWidth>0);await screenshot('workspace-result-mocked');
  assert.equal((await project()).results.length,1);
  await page.locator('.result-inspector').getByRole('button',{name:'레퍼런스 수정',exact:true}).click();
  await target(stand.id).focus();await page.keyboard.press('ArrowRight');assert((await project()).results[0].stale);
  const snapshot=(await project()).results[0].conditionsSnapshot;assert(Math.abs(snapshot.common.elements.find(e=>e.id===stand.id).target.x-.6)<.001);
  await page.reload();assert((await project()).results[0].stale);await page.goBack();await page.goForward();assert.equal((await project()).results.length,1);
  await page.getByRole('button',{name:'삭제',exact:true}).click();assert(await page.getByRole('button',{name:'삭제 확인 닫기',exact:true}).isVisible());await page.getByRole('button',{name:'삭제 확인 닫기',exact:true}).click();assert.equal((await project()).references.length,4);
  await page.getByRole('button',{name:'삭제',exact:true}).click();await page.getByRole('button',{name:'이미지 삭제',exact:true}).click();assert.equal((await project()).references.length,3);
  await page.waitForTimeout(2200);assert.equal(await page.locator('.undo-banner').count(),0);await page.locator('.plan-canvas__svg').focus();await page.keyboard.press('Control+z');assert.equal((await project()).references.length,4);assert.equal((await project()).results.length,1);
  console.log('result step enable, mock generation, stale/history, edit shortcut, deletion close and recovery after toast expiry passed');

  // Historical over-cap data must survive; only new uploads are disabled.
  p=await project();const source=p.sourceImages.find(i=>i.id===p.references[0].imageId);
  for(let i=4;i<12;i++){p.sourceImages.push({...source,id:'legacy-image-'+i,name:'참고 '+(i+1)});p.references.push({...p.references[0],id:'legacy-ref-'+i,imageId:'legacy-image-'+i});}
  await page.evaluate(({key,p})=>localStorage.setItem(key,JSON.stringify({schemaVersion:1,projects:[p]})),{key,p});await page.reload();
  assert.equal((await project()).references.length,12);assert(await page.locator('.mapping-panel input[type=file]').isDisabled());assert.equal(await page.locator('.mapping-thumbnails>.reference-thumb').count(),9);
  const rows=await page.locator('.mapping-thumbnails>.reference-thumb').evaluateAll(es=>new Set(es.map(e=>Math.round(e.getBoundingClientRect().top))).size);assert.equal(rows,3);
  await page.getByRole('button',{name:'전체 보기 · 12장',exact:true}).click();const dialog=page.getByRole('dialog');assert(await dialog.isVisible());assert.equal(await dialog.locator('.reference-library-grid>button').count(),12);
  await dialog.locator('.reference-library-grid').evaluate(e=>e.scrollTop=e.scrollHeight);assert(await dialog.getByRole('button',{name:'레퍼런스 전체 보기 닫기',exact:true}).isVisible());
  await dialog.getByRole('button',{name:'참고 12',exact:true}).click();assert.equal(await dialog.isVisible(),false);assert(await page.locator('.mapping-thumbnails>.reference-thumb[aria-pressed=true]').isVisible());
  await page.getByRole('button',{name:'전체 보기 · 12장',exact:true}).click();await screenshot('workspace-reference-library');await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
  for(const [width,height] of [[1575,884],[1280,720],[1070,671]]) {
    await page.setViewportSize({width,height});
    await page.locator('.mapping-panel .layout-tool-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth),false);
    const ab=await page.locator('.mapping-apply').boundingBox();assert(ab.y>=0&&ab.y+ab.height<=height);
    await page.locator('.plan-canvas__legend>summary').click();const bounds=await menu.boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width);assert.equal(await menu.evaluate(e=>e.scrollWidth>e.clientWidth),false);await page.getByRole('button',{name:'범례 닫기',exact:true}).click();
    await screenshot('workspace-small-'+width);
  }
  assert.equal(errors.length,0);console.log('legacy 12-image library, three-row preview, selection/Escape, desktop sizes and JS errors passed; paid calls=0');
} finally { await browser.close(); }
