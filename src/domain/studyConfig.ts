export const STUDY_START = {
  projectName: '한국공학대학교 프로젝트룸 · 졸업전시',
  spaceType: '졸업전시 공간',
  task: 'A' as const,
  participantPattern: /^P\d{2,4}$/,
  maxConceptImages: 4,
  maxDesignGoalLength: 1000,
};

export const BASELINE_STRUCTURE_IDS = ['campus-front', 'campus-back', 'campus-left', 'campus-right', 'campus-door'] as const;
