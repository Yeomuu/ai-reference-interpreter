// Disposable profile; all generation responses are mocked. No paid request.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
const key = 'ai-reference-interpreter:projects:v1';
const browser = await chromium.launch({headless:true, args:['--no-proxy-server'],...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  const errors = [], requests = [];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/status',route=>route.fulfill({json:{available:true,requiresAccessCode:false,quota:{totalLimit:60,used:0,remaining:60,dailyLimit:20,dailyRemaining:20,busy:false}}}));
  await page.route('**/api/generate',route=>{
    requests.push(route.request().postDataJSON());
    return route.fulfill({json:{imageDataUrl:'data:image/jpeg;base64,'+fs.readFileSync('public/sample/campus/projectroom-front.jpg').toString('base64')}});
  });
  await page.goto(base);
  await page.getByRole('button',{name:'저장한 프로젝트·다른 공간',exact:true}).click();
  await page.getByRole('button',{name:'졸업전시 구상 시작',exact:true}).click();
  const id = new URL(page.url()).pathname.split('/')[2];
  await page.locator('.step-nav').getByRole('button',{name:'04 시안 생성',exact:true}).click();
  await page.evaluate(({key,id})=>{
    const stored=JSON.parse(localStorage.getItem(key)), p=stored.projects.find(p=>p.id===id);
    const region={x:.2,y:.2,width:.3,height:.3};
    p.elements=Array.from({length:20},(_,i)=>({id:`qa-display-${i}`,origin:'layout',layoutKind:'display',label:`전시대 ${i+1}`,kind:'freestanding-fixture',sourceReferenceId:'ref-product',sourceRegion:region,status:'apply',target:{kind:'floor-point',x:.25+i%5*.1,y:.25+Math.floor(i/5)*.14,footprint:{width:.04,height:.04}}}));
    p.references.forEach(ref=>ref.extractedElements=ref.id==='ref-product'?p.elements.map(e=>e.id):[]);
    p.commonRevision++; p.results=[];
    localStorage.setItem(key,JSON.stringify(stored));
  },{key,id});
  await page.reload();
  const checkboxes=page.locator('.generation-viewpoints input');
  for(let i=0;i<await checkboxes.count();i++) { if(i===0)await checkboxes.nth(i).check();else await checkboxes.nth(i).uncheck(); }
  await page.getByRole('button',{name:'AI 이미지 생성',exact:true}).click();
  await page.waitForURL('**/results',{timeout:30000});
  assert.equal(requests.length,1);
  assert.equal(requests[0].project.elements.length,20);
  assert.deepEqual(requests[0].images[2].referencePreparation,{mode:'crop',regions:[{x:.2,y:.2,width:.3,height:.3}]});
  const saved=await page.evaluate(({key,id})=>JSON.parse(localStorage.getItem(key)).projects.find(p=>p.id===id),{key,id});
  assert.equal(saved.results.length,1); assert.equal(saved.results[0].conditionsSnapshot.common.elements.length,20);
  console.log('20 layout items + crop preparation, one mock request, result snapshot and reload passed');
  await page.evaluate(({key,id})=>{
    const stored=JSON.parse(localStorage.getItem(key)),p=stored.projects.find(p=>p.id===id);
    for(let i=0;i<80;i++)p.floorPlan.areas.push({id:`qa-area-${i}`,name:`분위기 영역 ${i} `+'상세 공간 설명 '.repeat(18),kind:'spatial',bounds:{x:.4,y:.4,width:.02,height:.02}});
    p.commonRevision++; localStorage.setItem(key,JSON.stringify(stored));
  },{key,id});
  await page.goto(`${base}/projects/${id}/review`);
  await page.getByRole('button',{name:'AI 이미지 생성',exact:true}).click();
  await page.getByText('생성 조건이 너무 길어 요청할 수 없습니다. 구조와 조건을 정리해 주세요.',{exact:true}).waitFor({timeout:15000});
  assert.equal(requests.length,1); // no additional POST for known invalid input
  const unchanged=await page.evaluate(({key,id})=>JSON.parse(localStorage.getItem(key)).projects.find(p=>p.id===id),{key,id});
  assert.equal(unchanged.results.length,1); assert.equal(unchanged.elements.length,20);
  assert.deepEqual(errors,[]);
  console.log('overlong input rejected before POST, clear input message, earlier result/layout retained, JS errors=0; paid calls=0');
} finally { await browser.close(); }
