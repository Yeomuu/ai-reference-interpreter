import type { Project } from '../domain/types';
import type { CommonPatch } from '../domain/revisions';
import { isProject } from './persistence';

export interface DeletionUndo {
  projectId: string; revision: number; patch: CommonPatch; label: string;
  referenceId?: string; structureId?: string;
}
type UndoStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const prefix = 'ai-reference-interpreter:deletion-undo:v1:';
const patchKeys = new Set(['sourceImages', 'references', 'elements', 'floorPlan', 'keeps', 'planAlignmentPending', 'referenceBindings']);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Recovery is safe only at the exact common revision following the deletion. */
export function loadDeletionUndo(project: Project, storage?: UndoStorage): DeletionUndo | null {
  try {
    const raw = (storage ?? localStorage).getItem(prefix + project.id);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.schemaVersion !== 1 || !record(value.action)) return null;
    const action = value.action;
    if (action.projectId !== project.id || action.revision !== project.commonRevision ||
        !Number.isSafeInteger(action.revision) || typeof action.label !== 'string' || !action.label.trim() ||
        !record(action.patch) || !Object.keys(action.patch).length || Object.keys(action.patch).some(key => !patchKeys.has(key)) ||
        ['referenceId', 'structureId'].some(key => action[key] !== undefined && typeof action[key] !== 'string') ||
        !isProject({ ...project, ...action.patch })) return null;
    return action as unknown as DeletionUndo;
  } catch { return null; }
}

/** Prepare before saving the deletion. A failed project write restores the prior record. */
export function prepareDeletionUndo(action: DeletionUndo, storage: UndoStorage = localStorage): () => void {
  const key = prefix + action.projectId;
  const previous = storage.getItem(key);
  storage.setItem(key, JSON.stringify({ schemaVersion: 1, action }));
  return () => { if (previous === null) storage.removeItem(key); else storage.setItem(key, previous); };
}
