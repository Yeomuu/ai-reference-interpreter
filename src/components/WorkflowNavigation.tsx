export default function WorkflowNavigation({ onPrevious, onNext, nextLabel = '다음으로' }: {
  onPrevious?: () => void;
  onNext?: () => void;
  nextLabel?: string;
}) {
  return <nav className="workflow-navigation" aria-label="단계 이동">
    {onPrevious && <button type="button" className="button button-quiet" onClick={onPrevious}>이전 단계</button>}
    {onNext && <button type="button" className="button button-primary" onClick={onNext}>{nextLabel}</button>}
  </nav>;
}
