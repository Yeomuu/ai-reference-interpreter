import { createCampusProject, CAMPUS_PREFIX } from '../data/campus.js';
import { migrateLayout } from './layoutMapping.js';
import type { Project } from './types.js';

import { STUDY_START } from './studyConfig.js';
export { STUDY_START, BASELINE_STRUCTURE_IDS } from './studyConfig.js';

const names: Record<string, string> = {
  'campus-front': '앞쪽 벽', 'campus-back': '뒤쪽 벽', 'campus-left': '창문이 있는 벽',
  'campus-right': '출입문이 있는 벽', 'campus-door': '출입문',
};

export type StudyProjectDetails = { projectName: string; spaceType: string };

/** Applies only to newly started participant projects; never relocks saved projects. */
export function createStudyProject(id: string, details: StudyProjectDetails = STUDY_START): Project {
  const project = createCampusProject('exhibition');
  const structures = project.floorPlan!.structures.map(structure => ({
    ...structure, name: names[structure.id] ?? structure.name, role: 'base' as const,
    preservationRequired: true, immutable: true, protected: true,
  }));
  return migrateLayout({
    ...project, id: `${CAMPUS_PREFIX}${id}`, name: details.projectName.trim(),
    spaceType: details.spaceType.trim(), designGoal: '',
    floorPlan: { ...project.floorPlan!, structures },
    keeps: structures.map(structure => ({
      id: `keep-${structure.id}`, structureId: structure.id, intent: 'preserve',
      description: `${structure.name}의 위치·형태 유지. 제공된 개략 도면이며 실측 미확인.`,
      allowedSurfaceTreatment: structure.kind === 'wall',
    })),
  });
}
