import type { Step } from './routes'

/** Visible tasks group existing URLs; bookmarks, history and study events stay stable. */
export const WORKFLOW = [
  { label: '공간·방향 설정', steps: ['space', 'keep'], icon: 'file' },
  { label: '레이아웃 구성', steps: ['placement'], icon: 'layers' },
  { label: '레퍼런스 적용', steps: ['references'], icon: 'images' },
  { label: '시안 생성', steps: ['camera', 'review', 'results'], icon: 'image' },
] as const
export function workflowIndex(step: Step) {
  return WORKFLOW.findIndex(group => (group.steps as readonly string[]).includes(step))
}
