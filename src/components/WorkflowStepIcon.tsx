const names = ['space', 'layout', 'reference', 'image'] as const;

export default function WorkflowStepIcon({ index, state }: { index: number; state: 'current' | 'before' | 'upcoming' }) {
  const name = names[index];
  return <span className={`progress-icon progress-icon--${name}`} aria-hidden="true">
    <span className="progress-icon__group"><span className="progress-icon__asset"><img src={`/figma/progress/${name}-${state}.svg`} alt="" /></span></span>
  </span>;
}
