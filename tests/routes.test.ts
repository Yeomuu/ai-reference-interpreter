import { describe, expect, it } from 'vitest'
import { parseProjectRoute, projectPath, STEPS } from '../src/app/routes'
import { previousWorkflowStep, workflowIndex } from '../src/app/workflow'
describe('project URLs', () => {
  it('round trips every step and encodes project identifiers', () => {
    for (const step of STEPS) expect(parseProjectRoute(projectPath({ step, projectId: '공간 / 하나' }))).toEqual({ step, projectId: '공간 / 하나' })
    expect(projectPath({ step: 'projects' })).toBe('/')
  })
  it('returns to the project list for malformed or unsupported routes', () => {
    for (const path of ['/', '/projects/a/no-step', '/projects/%zz/space', '/unrelated']) expect(parseProjectRoute(path)).toEqual({ step: 'projects' })
  })
  it('returns from optional camera editing to review inside STEP 04', () => {
    expect(previousWorkflowStep('camera')).toBe('review')
    expect(workflowIndex(previousWorkflowStep('camera'))).toBe(3)
    expect(previousWorkflowStep('review')).toBe('references')
    expect(previousWorkflowStep('placement')).toBe('space')
    expect(previousWorkflowStep('space')).toBe('projects')
  })
})
