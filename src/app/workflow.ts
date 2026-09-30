import type { Step } from './routes'

/** Visible tasks group existing URLs; bookmarks, history and study events stay stable. */
export const WORKFLOW = [
  { label: '공간 확인', steps: ['space', 'keep'], icon: 'file' },
  { label: '참고 요소 선택', steps: ['references'], icon: 'images' },
  { label: '공간 배치 및 시점 지정', steps: ['placement', 'camera'], icon: 'layers' },
  { label: 'AI 시안 확인 및 수정', steps: ['review', 'results'], icon: 'image' },
] as const
export function workflowIndex(step: Step) {
  return WORKFLOW.findIndex(group => (group.steps as readonly string[]).includes(step))
}
