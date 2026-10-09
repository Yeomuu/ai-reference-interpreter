import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../src/data/sample';
import { registerCatalogReference } from '../src/domain/referenceCatalog';
import { removeReference } from '../src/domain/revisions';

describe('prepared reference catalog',()=>{
  it('registers only the selected source, preserving placements and historical conditions',()=>{
    const before=createSampleProject(),original=structuredClone(before);
    const next=registerCatalogReference(before,'cane-chair');
    expect(next.error).toBeUndefined();expect(next.referenceId).toBeTruthy();
    expect(next.project.sourceImages.at(-1)?.role).toBe('inspiration');
    expect(next.project.references.at(-1)?.imageId).toBe('catalog-image-cane-chair');
    expect(next.project.elements).toEqual(before.elements);
    expect(next.project.keeps).toEqual(before.keeps);
    expect(next.project.results.map(r=>r.conditionsSnapshot)).toEqual(before.results.map(r=>r.conditionsSnapshot));
    expect(before).toEqual(original);
  });
  it('selects the already registered image without consuming another slot',()=>{
    const before=createSampleProject();
    const result=registerCatalogReference(before,'wall-curves');
    expect(result.project).toBe(before);
    expect(result.referenceId).toBe(before.references.find(r=>r.imageId==='photo-graphic')?.id);
    const added=registerCatalogReference(before,'cane-chair');
    expect(registerCatalogReference(added.project,'cane-chair').project).toBe(added.project);
  });
  it('allows explicit re-registration after deletion, retaining past snapshots',()=>{
    const added=registerCatalogReference(createSampleProject(),'cane-chair');
    const deleted=removeReference(added.project,added.referenceId!);
    const restored=registerCatalogReference(deleted,'cane-chair');
    expect(restored.error).toBeUndefined();expect(restored.referenceId).toBeTruthy();
    expect(restored.project.results.map(r=>r.conditionsSnapshot)).toEqual(deleted.results.map(r=>r.conditionsSnapshot));
  });
  it('rejects unknown IDs and new sources at the existing eight-image cap',()=>{
    const before=createSampleProject();
    expect(registerCatalogReference(before,'unknown').project).toBe(before);
    before.references=Array.from({length:8},(_,i)=>({id:`r${i}`,imageId:`i${i}`,role:'element' as const,note:'',extractedElements:[],exclusions:[]}));
    const capped=registerCatalogReference(before,'cane-chair');
    expect(capped.project).toBe(before);expect(capped.error).toContain('최대 8장');
  });
});
