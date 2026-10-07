// Run with npm run dev in another terminal; see docs/PROTOTYPE_FINAL_REVIEW_20261001.md.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const loadModule=createRequire(import.meta.url);
const {chromium}=loadModule(process.env.PLAYWRIGHT_MODULE || 'playwright');
const key='ai-reference-interpreter:projects:v1';
const base=process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
// Disposable profile only. Paid generation is unavailable/mocked; no secrets are read.
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true,args:['--no-proxy-server']});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/status',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({available:false,reason:'격리 QA'})}));
 await page.goto(base);await page.getByRole('button',{name:'저장한 프로젝트·다른 공간',exact:true}).click();await page.getByRole('button',{name:'졸업전시 구상 시작',exact:true}).click();
 let id=new URL(page.url()).pathname.split('/')[2];
 const project=()=>page.evaluate(({key,id})=>JSON.parse(localStorage.getItem(key)).projects.find(p=>p.id===id),{key,id});
 const initial=await project();
 async function seed(p){id=p.id;await page.evaluate(({key,p})=>localStorage.setItem(key,JSON.stringify({schemaVersion:1,projects:[p]})),{key,p});await page.goto(base+'/projects/'+id+'/placement');await page.waitForTimeout(100)}
 const stage=name=>page.locator('.step-nav').getByRole('button',{name}).click();
 async function point(x,y){return page.locator('.plan-canvas__svg').first().evaluate((svg,{x,y})=>{let p=svg.createSVGPoint();p.x=x*svg.viewBox.baseVal.width;p.y=y*svg.viewBox.baseVal.height;let q=p.matrixTransform(svg.querySelector(':scope > g').getScreenCTM());return{x:q.x,y:q.y}},{x,y})}
 async function click(x,y){const p=await point(x,y);await page.mouse.click(p.x,p.y)}
 async function draw(x,y,ex,ey){const a=await point(x,y),b=await point(ex,ey);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up()}
 const items=Array.from({length:19},(_,i)=>({id:'qa-item-'+i,label:'의자 '+(i+1),origin:'layout',layoutKind:'chair',kind:'furniture',sourceReferenceId:'',status:'apply',target:{kind:'floor-point',x:.2+(i%5)*.09,y:.2+Math.floor(i/5)*.12,footprint:{width:.02,height:.02}},locked:false}));
 await seed({...initial,id:'qa-limits',elements:items,referenceBindings:[],layoutVersion:2});
 await page.getByRole('button',{name:'의자',exact:true}).click();await click(.65,.65);assert.equal((await project()).elements.length,20);
 for(const name of ['전시대','테이블','의자','조명','진열 상품','벽면 연출'])assert(await page.getByRole('button',{name,exact:true}).isDisabled());
 assert(await page.getByRole('button',{name:'가벽',exact:true}).isEnabled());assert(await page.getByRole('button',{name:'분위기 영역',exact:true}).isEnabled());
 assert(await page.getByRole('status',{name:'배치 요소 20 / 20',exact:true}).isVisible());
 await page.locator('.plan-canvas__svg').focus();await page.keyboard.press('Control+z');assert.equal((await project()).elements.length,19);await page.keyboard.press('Control+Shift+z');assert.equal((await project()).elements.length,20);
 await page.reload();assert.equal((await project()).elements.length,20);console.log('real UI 19→20 cap, undo/redo, reload passed');
 let p=await project();p.sourceImages=p.sourceImages.filter(s=>s.role==='existing-space');p.references=[];
 for(let i=0;i<7;i++){p.sourceImages.push({...initial.sourceImages.find(s=>s.role!=='existing-space'),id:'qa-source-'+i});p.references.push({...initial.references[0],id:'qa-ref-'+i,imageId:'qa-source-'+i,extractedElements:[]})}
 await seed(p);await stage('03 레퍼런스 적용');await page.locator('.mapping-panel input[type=file]').setInputFiles('public/sample/graphic.png');await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key)).projects.find(p=>p.id===id).references.length===8,{key,id});
 assert(await page.locator('.mapping-panel input[type=file]').isDisabled());assert(await page.getByRole('status',{name:'레퍼런스 8 / 8',exact:true}).isVisible());
 const first=(await project()).elements[0].id,second=(await project()).elements[1].id;
 await page.locator(`[data-mapping-target="${first}"]`).click();await page.locator(`[data-mapping-target="${second}"]`).click({modifiers:['Shift']});await page.getByRole('button',{name:'선택한 2개에 적용',exact:true}).click();assert.equal((await project()).references.length,8);
 await stage('01 공간·방향 설정');assert(await page.locator('.space-direction input[type=file]').last().isDisabled());console.log('real UI 7→8 cap, concept combined count and repeated binding unchanged passed');
 p=await project();for(let i=20;i<23;i++)p.elements.push({...items[0],id:'qa-item-'+i,label:'구형 요소 '+i});p.sourceImages.push({...p.sourceImages.at(-1),id:'legacy-nine'});p.references.push({...p.references[0],id:'legacy-ref-nine',imageId:'legacy-nine'});delete p.layoutVersion;delete p.referenceBindings;
 await seed(p);await page.reload();assert.equal((await project()).elements.length,23);assert.equal((await project()).references.length,9);assert(await page.getByRole('button',{name:'전시대',exact:true}).isDisabled());await stage('03 레퍼런스 적용');assert(await page.locator('.mapping-panel input[type=file]').isDisabled());console.log('legacy >20/>8 preserve and disable additions passed');
 await seed({...initial,id:'qa-blocked-campus',elements:[],cameras:[],results:[],referenceBindings:[],layoutVersion:2});
 await page.getByRole('button',{name:'가벽',exact:true}).click();await draw(.7,.12,.7,.45);assert.equal((await project()).floorPlan.structures.filter(s=>s.role==='partition').length,2);
 await page.getByRole('button',{name:'그리기 마치기',exact:true}).click();await page.getByRole('button',{name:'통행 동선',exact:true}).click();await draw(.5,.7,.7,.8);assert((await project()).floorPlan.areas.filter(a=>a.kind==='passage').length===2);
 await stage('04 시안 생성');assert(page.url().endsWith('/review'));assert.equal((await project()).cameras.length,3);const cams=(await project()).cameras,entry=cams.find(c=>c.viewPreset==='entry'),secondary=cams.find(c=>c.viewPreset==='secondary');console.log('blocked entry recommendation',entry.x,entry.y,entry.directionDegrees);const crossingY=entry.y+(.7-entry.x)*(.5-entry.y)/(.5-entry.x);assert(entry.x<.7||crossingY>=.45||crossingY<=.12);assert(!(entry.x>=.74&&entry.y>=.13&&entry.y<=.31));assert(Math.abs((entry.directionDegrees-secondary.directionDegrees+540)%360-180)>=44);assert.equal(await page.locator('.plan-camera__cone').count(),0);
 await page.getByRole('button',{name:'시점 수정',exact:true}).click();assert((await page.locator('.plan-camera__cone').count())>0);await page.locator('.camera-advanced>summary').click();
 const eye=page.getByLabel('눈높이 기준');await eye.selectOption('average-female');let changed=await project();assert.equal(changed.cameras.length,3);assert.equal(changed.cameras.find(c=>c.id===entry.id).heightMeters,1.48);assert.equal(changed.cameras.find(c=>c.id===entry.id).recommendation,'modified');
 await page.locator('.plan-canvas__svg').focus();await page.keyboard.press('Control+z');assert.equal((await project()).cameras.find(c=>c.id===entry.id).heightMeters,1.6);await page.keyboard.press('Control+Shift+z');assert.equal((await project()).cameras.find(c=>c.id===entry.id).heightMeters,1.48);
 await page.reload();assert.equal((await project()).cameras.find(c=>c.id===entry.id).heightMeters,1.48);console.log('blocked entry fallback, distinct recommendations, optional preset, camera undo/redo/reload passed');
 assert.equal(errors.length,0);console.log('supplementary browser QA passed');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
