export interface PlanLabel { id: string; x: number; y: number; width: number; height: number }
/** Greedy nearest free slot in display pixels. Leaders keep displaced labels tied to geometry. */
export function arrangePlanLabels(labels: PlanLabel[], width: number, height: number, obstacles: PlanLabel[] = []): Map<string, PlanLabel> {
  const placed: PlanLabel[] = [];
  const overlaps = (a: PlanLabel, b: PlanLabel) => Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 4 && Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 4;
  for (const label of labels) {
    const w = Math.min(label.width, width - 8), h = label.height;
    const bound = (x: number, y: number): PlanLabel => ({ ...label, width: w,
      x: Math.max(w / 2 + 4, Math.min(width - w / 2 - 4, x)),
      y: Math.max(h / 2 + 4, Math.min(height - h / 2 - 4, y)) });
    const candidates = [bound(label.x, label.y)];
    for (let y = h / 2 + 4; y <= height - h / 2 - 4; y += h + 6) {
      for (let x = w / 2 + 4; x <= width - w / 2 - 4; x += 16) candidates.push(bound(x, y));
    }
    candidates.sort((a, b) => Math.hypot(a.x - label.x, a.y - label.y) - Math.hypot(b.x - label.x, b.y - label.y));
    const free = candidates.find(candidate => ![...obstacles, ...placed].some(other => overlaps(candidate, other)));
    // If a very small surface cannot hold every label, callers use the compact selected-label mode.
    if (free) placed.push(free);
  }
  return new Map(placed.map(label => [label.id, label]));
}
