import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../src/data/sample';
import { removeReference, updateCommon } from '../src/domain/revisions';
import { loadDeletionUndo, prepareDeletionUndo, type DeletionUndo } from '../src/services/deletionUndo';

function fixture() {
  const original = createSampleProject();
  const deleted = removeReference(original, original.references[0].id);
  const action: DeletionUndo = { projectId: deleted.id, revision: deleted.commonRevision, label: '레퍼런스를 삭제', patch: {
    references: original.references, elements: original.elements, sourceImages: original.sourceImages,
  } };
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); }, removeItem: (key: string) => { entries.delete(key); } };
  return { original, deleted, action, entries, storage };
}

describe('persistent deletion recovery', () => {
  it('does not crash initialization when browser storage is unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('storage blocked'); } });
    try { expect(loadDeletionUndo(fixture().deleted)).toBeNull(); }
    finally { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); }
  });
  it('restores the latest deletion after reload without replacing result snapshots', () => {
    const { deleted, action, storage } = fixture();
    prepareDeletionUndo(action, storage);
    const reloaded = JSON.parse(JSON.stringify(deleted));
    const restored = loadDeletionUndo(reloaded, storage)!;
    expect(restored).toEqual(action);
    const next = updateCommon(reloaded, restored.patch);
    expect(next.references).toEqual(action.patch.references);
    expect(next.results[0].conditionsSnapshot).toEqual(reloaded.results[0].conditionsSnapshot);
    expect(loadDeletionUndo(next, storage)).toBeNull();
  });
  it('never overwrites a later common edit or offers another project recovery', () => {
    const { deleted, action, storage } = fixture(); prepareDeletionUndo(action, storage);
    expect(loadDeletionUndo(updateCommon(deleted, { concept: '후속 수정' }), storage)).toBeNull();
    expect(loadDeletionUndo({ ...deleted, id: 'other-project' }, storage)).toBeNull();
  });
  it.each(['{', JSON.stringify({ schemaVersion: 2 }), JSON.stringify({ schemaVersion: 1, action: { patch: { name: '임의 덮어쓰기' } } })])('ignores malformed data and preserves its raw record', raw => {
    const { deleted, action, storage, entries } = fixture(); prepareDeletionUndo(action, storage);
    const key = [...entries.keys()][0]; storage.setItem(key, raw);
    expect(loadDeletionUndo(deleted, storage)).toBeNull(); expect(storage.getItem(key)).toBe(raw);
  });
  it('rejects malformed or unrelated patch keys even at a matching revision', () => {
    const { deleted, action, storage } = fixture();
    prepareDeletionUndo({ ...action, patch: { elements: [{ id: 'invalid' }] } as unknown as DeletionUndo['patch'] }, storage);
    expect(loadDeletionUndo(deleted, storage)).toBeNull();
    prepareDeletionUndo({ ...action, patch: { name: 'unexpected' } as unknown as DeletionUndo['patch'] }, storage);
    expect(loadDeletionUndo(deleted, storage)).toBeNull();
  });
  it('rolls back a prepared record if project saving fails, retaining the prior recovery', () => {
    const { action, storage, entries } = fixture();
    const firstRollback = prepareDeletionUndo(action, storage); firstRollback(); expect(entries.size).toBe(0);
    prepareDeletionUndo(action, storage);
    const rollback = prepareDeletionUndo({ ...action, label: '다른 삭제' }, storage); rollback();
    expect(JSON.parse([...entries.values()][0]).action).toEqual(action);
    expect(() => prepareDeletionUndo(action, { ...storage, setItem: () => { throw new Error('full'); } })).toThrow('full');
  });
});
