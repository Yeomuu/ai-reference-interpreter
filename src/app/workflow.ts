import type { Step } from './routes'

/** Visible tasks group existing URLs; bookmarks, history and study events stay stable. */
export const WORKFLOW = [
  { label: '공간·방향 설정', steps: ['space', 'keep'], icon: 'file' },
  { label: '레이아웃 구성', steps: ['placement'], icon: 'layers' },
  { label: '레퍼런스 적용', steps: ['references'], icon: 'images' },
  { label: '시안 생성', steps: ['review', 'camera', 'results'], icon: 'image' },
] as const
export function workflowIndex(step: Step) {
  return WORKFLOW.findIndex(group => (group.steps as readonly string[]).includes(step))
}

/** Camera editing is an optional task inside STEP 04. */
export function previousWorkflowStep(step: Step): Step {
  if (step === 'camera') return 'review'
  const index = workflowIndex(step)
  return index <= 0 ? 'projects' : WORKFLOW[index - 1].steps[0]
}
