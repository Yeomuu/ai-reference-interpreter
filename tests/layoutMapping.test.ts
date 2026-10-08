import { describe, it, expect } from 'vitest';
import { createSampleProject } from '../src/data/sample';
import { migrateLayout, createLayoutItem, bindReference, unbindReference, targetCondition } from '../src/domain/layoutMapping';
import { createConditionsSnapshot, removeReference, placeElement, updateCommon } from '../src/domain/revisions';
import { validatePreflight } from '../src/domain/validation';
import { isProject } from '../src/services/persistence';
import { buildGenerationPrompt } from '../src/services/generationContract';
import { assessmentOutput, ExperimentRecorder } from '../src/services/experiment';

describe('layout first compatibility', () => {
  it.each(['unbind', 'delete'] as const)('%s removes projected wall/space conditions while retaining physical layout, products and history', operation => {
    const project = migrateLayout(createSampleProject());
    const stand = { ...createLayoutItem(project, 'stand', 'display'), target: { kind: 'floor-point' as const, x: .5, y: .45, footprint: { width: .05, height: .05 } } };
    const product = { ...createLayoutItem(project, 'product', 'product'), target: { kind: 'fixture-surface' as const, fixtureElementId: stand.id, offset: { x: .5, y: .5 } } };
    const conditions = [
      targetCondition(project, 'wall-condition', { kind: 'wall-segment', wallId: 'wall-south', start: .05, end: .2 }, 'appearance'),
      targetCondition(project, 'space-condition', { kind: 'whole-space' }, 'appearance'),
    ];
    const draft = { ...project, elements: [stand, product, ...conditions], referenceBindings: [] };
    const mapped = bindReference(draft, project.references[0].id, [stand.id, ...conditions.map(item => item.id)]);
    expect(mapped.error).toBeUndefined();
    const snapshot = createConditionsSnapshot(mapped.project, project.cameras[0].id)!;
    const before = { ...mapped.project, results: [{ ...project.results[0], conditionsSnapshot: snapshot }] };
    expect(validatePreflight(before).valid).toBe(true);
    const after = operation === 'unbind' ? unbindReference(before, before.referenceBindings![0].id) : removeReference(before, project.references[0].id);
    expect(after.elements).toEqual([{ ...stand, sourceRegion: undefined }, product]);
    expect(after.referenceBindings).toEqual([]);
    expect(after.floorPlan).toEqual(before.floorPlan);
    expect(after.keeps).toEqual(before.keeps);
    expect(after.results[0].conditionsSnapshot).toEqual(snapshot);
    expect(after.results[0].stale).toBe(true);
    expect(validatePreflight(after).valid).toBe(true);
    expect(isProject(after)).toBe(true);
    expect(after.references.length).toBe(before.references.length - (operation === 'delete' ? 1 : 0));
  });
  it('preserves IDs, geometry, result snapshots and is idempotent', () => {
    const old=createSampleProject();
    const next=migrateLayout(old);
    expect(next.elements.map(item=>item.id)).toEqual(old.elements.map(item=>item.id));
    expect(next.elements.map(item=>item.target)).toEqual(old.elements.map(item=>item.target));
    expect(next.results).toEqual(old.results);
    expect(migrateLayout(next)).toBe(next);
    expect(isProject(next)).toBe(true);
  });
  it('creates layout items without reference dependency and automatically distinguishes names', () => {
    const project=migrateLayout(createSampleProject());
    const first=createLayoutItem(project,'new-1','display');
    expect(first.sourceReferenceId).toBe('');
    const second=createLayoutItem({...project,elements:[...project.elements,first]},'new-2','display');
    expect([first.label,second.label]).toEqual(['전시대 1','전시대 2']);
  });
  it('maps one crop to several positioned items, retains geometry and restores unbound layout', () => {
    const project=migrateLayout(createSampleProject());
    const ids=['one','two','four'];
    const items=ids.map((id,i)=>({...createLayoutItem(project,id,'display'),target:{kind:'floor-point' as const,x:.25+i*.2,y:.30,footprint:{width:.06,height:.05}}}));
    const draft={...project,elements:items,referenceBindings:[]};
    const region={x:.1,y:.1,width:.5,height:.5};
    const result=bindReference(draft,project.references[0].id,ids,region);
    expect(result.error).toBeUndefined();
    expect(result.project.referenceBindings?.[0].layoutItemIds).toEqual(ids);
    expect(result.project.elements.map(item=>item.target)).toEqual(items.map(item=>item.target));
    expect(result.project.elements.every(item=>item.sourceRegion?.x===.1)).toBe(true);
    const unbound=unbindReference(result.project,result.project.referenceBindings![0].id);
    expect(unbound.elements).toHaveLength(3);
    expect(unbound.elements.every(item=>!item.sourceReferenceId)).toBe(true);
    expect(isProject(unbound)).toBe(true);
  });
  it('rejects a multi-target operation atomically when one target is invalid', () => {
    const project=migrateLayout(createSampleProject());
    const items=['one','two'].map(id=>createLayoutItem(project,id,'display'));
    const draft={...project,elements:items};
    const result=bindReference(draft,project.references[0].id,items.map(item=>item.id));
    expect(result.error).toBeTruthy();expect(result.project).toBe(draft);
  });
  it('reference deletion unbinds independent layout while keeping saved attribution', () => {
    const project=migrateLayout(createSampleProject());
    const element=project.elements.find(item=>item.status==='apply')!;
    const snapshot=createConditionsSnapshot(project,project.cameras[0].id)!;
    const before={...project,results:[{id:'history',cameraId:project.cameras[0].id,commonRevision:project.commonRevision,createdAt:new Date().toISOString(),imageUri:'/sample/result-v1.png',origin:'sample' as const,approved:false,stale:false,conditionsSnapshot:snapshot}]};
    const after=removeReference(before,element.sourceReferenceId);
    expect(after.elements.some(item=>item.id===element.id&&!item.sourceReferenceId)).toBe(true);
    expect(after.results[0].conditionsSnapshot).toEqual(snapshot);expect(after.results[0].stale).toBe(true);
  });
  it('allows neutral unbound geometry in preflight and forbids moving a locked item', () => {
    const project=migrateLayout(createSampleProject());
    const item={...createLayoutItem(project,'new','display'),locked:true,target:{kind:'floor-point' as const,x:.5,y:.45,footprint:{width:.05,height:.05}}};
    const next={...project,elements:[item],referenceBindings:[]};
    expect(validatePreflight(next).issues.some(issue=>issue.code==='missing-reference')).toBe(false);
    expect(placeElement(next,item.id,{...item.target,x:.6}).validation.valid).toBe(false);
    expect(buildGenerationPrompt(next,next.cameras[0].id,[])).toContain('without an inspiration image');
    const changed=updateCommon(next,{referenceBindings:[{id:'b',referenceId:next.references[0].id,layoutItemIds:[item.id]}]});
    expect(changed.commonRevision).toBe(next.commonRevision+1);
  });
  it('rejects malformed optional layout fields before persistence/server input', () => {
    const project=migrateLayout(createSampleProject());
    expect(isProject({...project,referenceBindings:[{id:'b',referenceId:'r',layoutItemIds:['x','x']}]})).toBe(false);
    expect(isProject({...project,elements:[{...project.elements[0],locked:'true'}]})).toBe(false);
  });
  it('rejects an out-of-image crop without changing any placement or binding', () => {
    const project=migrateLayout(createSampleProject());
    const item={...createLayoutItem(project,'crop-item','display'),target:{kind:'floor-point' as const,x:.5,y:.45,footprint:{width:.05,height:.05}}};
    const draft={...project,elements:[item],referenceBindings:[]};
    const result=bindReference(draft,draft.references[0].id,[item.id],{x:.8,y:.1,width:.5,height:.4});
    expect(result.error).toBeTruthy();expect(result.project).toBe(draft);
  });
  it('does not apply lighting to part of an incompatible mixed selection', () => {
    const project=migrateLayout(createSampleProject());
    const lamp={...createLayoutItem(project,'lamp','light'),target:{kind:'floor-point' as const,x:.5,y:.45,footprint:{width:.03,height:.03}}};
    const display={...createLayoutItem(project,'fixture','display'),target:{kind:'floor-point' as const,x:.7,y:.45,footprint:{width:.05,height:.05}}};
    const draft={...project,elements:[lamp,display],referenceBindings:[]};
    const result=bindReference(draft,draft.references[0].id,[lamp.id,display.id],undefined,'lighting');
    expect(result.error).toContain('조명');expect(result.project).toBe(draft);
  });
  it('exports the workflow and binding group while retaining mapping batch counts', () => {
    const project=migrateLayout(createSampleProject());
    const recorder=new ExperimentRecorder({getItem:()=>null,setItem:()=>{}});
    recorder.start('P99','A',project,'references');
    recorder.record('reference_binding_apply','reference',project.references[0].id,{target_count:3});
    const event=recorder.active!.events.find(item=>item.event_name==='reference_binding_apply')!;
    expect(event.payload.target_count).toBe(3);
    const output=assessmentOutput(project);
    expect(output.workflow_version).toBe('layout-first-v2');
    expect(output.reference_bindings).toEqual(project.referenceBindings);
    expect(JSON.stringify(output)).not.toContain('imageUri');
  });
});
