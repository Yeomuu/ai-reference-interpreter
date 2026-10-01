import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LayoutWorkspace from '../src/components/LayoutWorkspace';
import AreaTargetPicker from '../src/components/AreaTargetPicker';
import CameraSummary from '../src/components/CameraSummary';
import PlanCanvas from '../src/components/PlanCanvas';
import { createCampusProject } from '../src/data/campus';
import { createLayoutItem } from '../src/domain/layoutMapping';
import { MAX_LAYOUT_ITEMS, MAX_REFERENCE_IMAGES } from '../src/domain/prototypeConfig';
import { prepareRecommendedCameras } from '../src/domain/cameraRecommendations';
import { ExperimentRecorder } from '../src/services/experiment';
import { updateCamera } from '../src/domain/revisions';
import { WORKFLOW } from '../src/app/workflow';

const noop=()=>{};
describe('simplified prototype controls and logging',()=>{
  it('explains retained items that have no visible placement without deleting their data',()=>{
    const project=createCampusProject('exhibition');
    const unplaced=createLayoutItem(project,'unplaced','display');
    const excluded={...createLayoutItem(project,'excluded','chair'),status:'exclude' as const};
    const orphaned={...createLayoutItem(project,'orphaned','product'),target:{kind:'fixture-surface' as const,fixtureElementId:'missing-support',offset:{x:.5,y:.5}}};
    project.elements=[unplaced,excluded,orphaned];
    const before=JSON.stringify(project);
    const html=renderToStaticMarkup(createElement(LayoutWorkspace,{project,canvas:null,inspector:null,tools:null,onItemTool:noop,onStructureTool:noop,onAreaTool:noop,onSelect:noop}));
    expect(html).toContain('배치 요소 3 /');
    expect(html).toContain('위치 미지정');expect(html).toContain('적용 제외');
    expect(html).toContain('위치 확인 필요 · 연결한 벽·영역·진열대를 확인하세요.');
    expect(JSON.stringify(project)).toBe(before);
  });
  it('uses one tool panel, only two new area tools, shapes for plan objects and icons for actions',()=>{
    const project=createCampusProject('exhibition');
    const html=renderToStaticMarkup(createElement(LayoutWorkspace,{project,canvas:null,inspector:null,tools:null,onItemTool:noop,onStructureTool:noop,onAreaTool:noop,onSelect:noop}));
    expect(html).toContain('분위기 영역');expect(html).toContain('통행 동선');
    expect(html).not.toContain('사용 바닥 추가');expect(html).not.toContain('천장 영역 추가');
    expect(html).not.toContain('구역 설정');expect(html).not.toContain('role="tab"');
    expect(html).toContain('layout-symbol');expect(html).toContain('plan-symbol');expect(html).toContain('/icons/nucleo/');
    expect(html).toContain(`배치 요소 0 / ${MAX_LAYOUT_ITEMS}`);
  });
  it('disables all six item add buttons at the cap without disabling structure/area tools',()=>{
    const project=createCampusProject('exhibition');project.elements=Array.from({length:MAX_LAYOUT_ITEMS},(_,i)=>createLayoutItem(project,`item-${i}`,'display'));
    const html=renderToStaticMarkup(createElement(LayoutWorkspace,{project,canvas:null,inspector:null,tools:null,onItemTool:noop,onStructureTool:noop,onAreaTool:noop,onSelect:noop}));
    expect(html.match(/<button disabled=""/g)).toHaveLength(6);
    expect(html).toContain(`배치 요소는 최대 ${MAX_LAYOUT_ITEMS}개`);
  });
  it('offers existing ceiling/floor targets internally without exposing new floor/ceiling drawing actions',()=>{
    const project=createCampusProject('exhibition');
    for(const kind of ['ceiling-light','floor-material'] as const) {
      const item={...createLayoutItem(project,'draft','light'),kind};
      const html=renderToStaticMarkup(createElement(AreaTargetPicker,{project,element:item,onChange:noop,onCreateArea:noop}));
      expect(html).not.toContain('천장 영역 추가');expect(html).not.toContain('바닥 영역 추가');
    }
  });
  it('retains four navigation stages and opens review before the optional camera editor',()=>{
    expect(WORKFLOW).toHaveLength(4);
    expect(WORKFLOW[3].steps[0]).toBe('review');
    const project=prepareRecommendedCameras(createCampusProject('exhibition'));
    const html=renderToStaticMarkup(createElement(CameraSummary,{cameras:project.cameras,onSelect:noop,onEdit:noop}));
    expect(html).toContain('추천 시점 3개가 설정되어 있습니다.');expect(html).toContain('시점 수정');
  });
  it.each(['keep','place','mapping'] as const)('hides cameras before step 04 in %s canvas',mode=>{
    const project=prepareRecommendedCameras(createCampusProject('exhibition'));
    const html=renderToStaticMarkup(createElement(PlanCanvas,{project,mode,quietLabels:true}));
    expect(html).not.toContain('class="plan-camera');
    expect(html).not.toContain('class="plan-camera__cone');
  });
  it('logs limit crossings and automatic/manual recommendations without filenames or private text',()=>{
    let data:string|null=null;
    const recorder=new ExperimentRecorder({getItem:()=>data,setItem:(_key,value)=>{data=value;}});
    const project=createCampusProject('exhibition');project.sourceImages[0].name='개인 이름.jpg';
    recorder.start('P99','A',project,'placement');
    const atLimit={...project,elements:Array.from({length:MAX_LAYOUT_ITEMS},(_,i)=>createLayoutItem(project,`item-${i}`,'display'))};
    recorder.changes(project,atLimit);
    recorder.changes(project,{...project,references:Array.from({length:MAX_REFERENCE_IMAGES},(_,i)=>({...project.references[0],id:`ref-${i}`,imageId:`source-${i}`}))});
    const cameras=prepareRecommendedCameras(project);recorder.changes(project,cameras);
    const entry=cameras.cameras.find(camera=>camera.primary)!;
    const changed=updateCamera(cameras,entry.id,{directionDegrees:(entry.directionDegrees+12)%360});recorder.changes(cameras,changed);
    const serialized=JSON.stringify(recorder.getSnapshot());
    expect(serialized).toContain('layout_limit_reached');expect(serialized).toContain('reference_limit_reached');expect(serialized).toContain('camera_recommendation_created');expect(serialized).toContain('camera_recommendation_modified');
    expect(serialized).not.toContain('개인 이름.jpg');
  });
});
