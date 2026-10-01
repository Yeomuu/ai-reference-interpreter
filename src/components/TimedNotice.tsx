import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import NucleoIcon from './NucleoIcon';

export const NOTICE_DURATION_MS = 2000;

/** Hiding feedback never discards the operation, recovery history or validation state. */
export default function TimedNotice({ children, lifetimeKey, className, role = 'status', onDismiss, closeLabel = '알림 닫기' }: {
  children: ReactNode; lifetimeKey: string | number; className: string;
  role?: 'status' | 'alert'; onDismiss?: () => void; closeLabel?: string;
}) {
  const [visible, setVisible] = useState(true);
  const dismissRef = useRef(onDismiss);
  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => { setVisible(false); dismissRef.current?.(); }, NOTICE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [lifetimeKey]);
  if (!visible) return null;
  return <div className={className} role={role}>{children}<button type="button" className="notice-dismiss" title="닫기" aria-label={closeLabel} onClick={() => { setVisible(false); dismissRef.current?.(); }}><NucleoIcon name="close" /></button></div>;
}
