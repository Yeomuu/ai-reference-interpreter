import { lazy, Suspense, useState } from 'react';
import type { Project } from '../domain/types';

const PlanGuidePreview = lazy(() => import('./PlanGuidePreview'));

/** Rasterize a historical plan only after the user opens its comparison. */
export default function ResultPlanComparison({ project, cameraId }: { project: Project; cameraId: string }) {
  const [open, setOpen] = useState(false);
  return <details className="history-section" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>저장된 배치 도면과 비교</summary>
    {open && <Suspense fallback={<p role="status">배치 도면 준비 중…</p>}><PlanGuidePreview project={project} cameraId={cameraId} /></Suspense>}
  </details>;
}
