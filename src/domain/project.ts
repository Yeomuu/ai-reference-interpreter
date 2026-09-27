import type { Project } from './types';

/** A real new project starts with no inferred geometry, images, or generated output. */
export function createEmptyProject(id: string, name = '새 프로젝트'): Project {
  return {
    schemaVersion: 1,
    id,
    name,
    spaceType: '',
    concept: '',
    sourceImages: [],
    floorPlan: null,
    keeps: [],
    references: [],
    elements: [],
    cameras: [],
    results: [],
    commonRevision: 1,
  };
}
