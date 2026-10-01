import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSampleProject } from '../src/data/sample';
import { createLayoutItem, bindReference, migrateLayout, targetCondition } from '../src/domain/layoutMapping';
import { MAX_LAYOUT_ITEMS, MAX_REFERENCE_IMAGES, USER_AREA_KINDS } from '../src/domain/prototypeConfig';
import { countLayoutItems, countReferenceImages, validatePrototypeAddition } from '../src/domain/prototypeLimits';
import { loadProjects, saveProject } from '../src/services/persistence';
import { validateAreaDrawing } from '../src/domain/validation';
import { unbindReference } from '../src/domain/layoutMapping';

afterEach(()=>vi.unstubAllGlobals());
function fixture(count=0,refs=3) {
  const sample=migrateLayout(createSampleProject());
  return {...sample,elements:Array.from({length:count},(_,i)=>createLayoutItem(sample,`layout-${i}`,'display')),referenceBindings:[],
    sourceImages:[...sample.sourceImages,...Array.from({length:refs},(_,i)=>({...sample.sourceImages[1],id:`image-${i}`}))],
    references:Array.from({length:refs},(_,i)=>({...sample.references[0],id:`ref-${i}`,imageId:`image-${i}`,extractedElements:[]}))};
}
function storage() { let value:string|null=null;vi.stubGlobal('localStorage',{getItem:()=>value,setItem:(_key:string,next:string)=>{value=next;},removeItem:()=>{value=null;}}); }
describe('one shared project limit contract',()=>{
  it('allows 19 → 20 and rejects 20 → 21',()=>{
    const before=fixture(MAX_LAYOUT_ITEMS-1),atLimit={...before,elements:[...before.elements,createLayoutItem(before,'last','chair')]};
    expect(validatePrototypeAddition(before,atLimit)).toBeUndefined();
    expect(countLayoutItems(atLimit)).toBe(MAX_LAYOUT_ITEMS);
    expect(validatePrototypeAddition(atLimit,{...atLimit,elements:[...atLimit.elements,createLayoutItem(atLimit,'extra','light')]})).toMatchObject({event:'layout_limit_reached',limit:MAX_LAYOUT_ITEMS});
  });
  it('preserves all legacy >20 objects through migration, reload and ordinary edits',()=>{
    storage();const before=fixture(MAX_LAYOUT_ITEMS+3);delete before.layoutVersion;
    const geometry=before.elements.map(item=>item.target);
    expect(()=>saveProject(before)).not.toThrow();
    const restored=loadProjects().find(item=>item.id===before.id)!;
    expect(countLayoutItems(restored)).toBe(MAX_LAYOUT_ITEMS+3);
    expect(restored.elements.map(item=>item.target)).toEqual(geometry);
    expect(validatePrototypeAddition(restored,{...restored,elements:restored.elements.map(item=>({...item,label:'이름 수정'}))})).toBeUndefined();
    expect(validatePrototypeAddition(restored,{...restored,elements:[...restored.elements,createLayoutItem(restored,'extra','table')]})).toBeDefined();
  });
  it('excludes structure/area/surface projections, counts physical support and temporarily excluded objects',()=>{
    const project=fixture(2);
    const wall=targetCondition(project,'wall-condition',{kind:'wall-segment',wallId:'wall-north',start:.1,end:.2},'appearance');
    const whole=targetCondition(project,'whole-condition',{kind:'whole-space'},'lighting');
    const support={...createLayoutItem(project,'support','display'),origin:'basic-support' as const};
    const changed={...project,elements:[{...project.elements[0],status:'exclude' as const},project.elements[1],wall,whole,support]};
    expect(countLayoutItems(changed)).toBe(3);
    expect(countLayoutItems(unbindReference({...changed,referenceBindings:[{id:'condition-bind',referenceId:'ref-0',layoutItemIds:[wall.id]}]},'condition-bind'))).toBe(3);
  });
  it('allows 7 → 8 images and rejects 8 → 9',()=>{
    const before=fixture(0,MAX_REFERENCE_IMAGES-1);
    const reference={...before.references[0],id:'last-ref',imageId:'last-image'};
    const atLimit={...before,references:[...before.references,reference]};
    expect(validatePrototypeAddition(before,atLimit)).toBeUndefined();
    expect(countReferenceImages(atLimit)).toBe(MAX_REFERENCE_IMAGES);
    expect(validatePrototypeAddition(atLimit,{...atLimit,references:[...atLimit.references,{...reference,id:'extra-ref',imageId:'extra-image'}]})).toMatchObject({event:'reference_limit_reached',limit:MAX_REFERENCE_IMAGES});
  });
  it('counts concept/product reference sources once, excluding photos, plan and generated history',()=>{
    const project=fixture(0,2);project.references[0].role='ambience';project.references[1].role='product';
    expect(countReferenceImages(project)).toBe(2);
    expect(countReferenceImages({...project,references:[...project.references,{...project.references[0],id:'another-role'}]})).toBe(2);
  });
  it('keeps image count unchanged for one cropped reference bound to multiple objects',()=>{
    const project=fixture(3);
    project.elements=project.elements.map((item,i)=>({...item,target:{kind:'floor-point',x:.40+i*.16,y:.35,footprint:{width:.04,height:.04}}}));
    const applied=bindReference(project,'ref-0',project.elements.map(item=>item.id),{x:.1,y:.1,width:.4,height:.5});
    expect(applied.error).toBeUndefined();
    expect(applied.project.referenceBindings?.[0].layoutItemIds).toHaveLength(3);
    expect(countReferenceImages(applied.project)).toBe(countReferenceImages(project));
    expect(countLayoutItems(applied.project)).toBe(3);
  });
  it('preserves >8 reference images on reload and still allows binding edits',()=>{
    storage();const project=fixture(0,MAX_REFERENCE_IMAGES+2);expect(()=>saveProject(project)).not.toThrow();
    const restored=loadProjects().find(item=>item.id===project.id)!;
    expect(countReferenceImages(restored)).toBe(MAX_REFERENCE_IMAGES+2);
    expect(validatePrototypeAddition(restored,{...restored,references:restored.references.map(ref=>({...ref,note:'참고 내용 수정'}))})).toBeUndefined();
  });
  it.each(USER_AREA_KINDS)('permits explicit new %s areas, leaving legacy floor/ceiling available internally',kind=>{
    const project=fixture();
    expect(validateAreaDrawing(project,{id:'new-area',name:'새 영역',kind,bounds:{x:.4,y:.4,width:.1,height:.1}}).valid).toBe(true);
    expect(project.floorPlan!.areas.some(area=>area.kind==='floor')).toBe(true);
    expect(project.floorPlan!.areas.some(area=>area.kind==='ceiling')).toBe(true);
  });
});
