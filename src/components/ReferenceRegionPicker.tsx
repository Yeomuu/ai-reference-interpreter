import { useEffect, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, PointerEvent } from 'react'
import type { Point, Rect } from '../domain/types'
import AssetImage from './AssetImage'
import TimedNotice from './TimedNotice'
import './reference-region.css'

interface Props {
  uri: string
  name: string
  imageWidth?: number
  imageHeight?: number
  selection: Rect | null
  enabled: boolean
  onChange: (selection: Rect | null) => void
  onReferenceDragStart?: (event: DragEvent) => void
}

const MIN_REGION = 0.04
const KEY_STEP = 0.02
const INITIAL_REGION: Rect = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }

function clamp(value: number) { return Math.max(0, Math.min(1, value)) }

export function regionBetween(start: Point, end: Point): Rect {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  return { x, y, width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }
}

export function validReferenceRegion(region: Rect): boolean {
  return Number.isFinite(region.x) && Number.isFinite(region.y) &&
    Number.isFinite(region.width) && Number.isFinite(region.height) &&
    region.x >= 0 && region.y >= 0 &&
    region.width >= MIN_REGION && region.height >= MIN_REGION &&
    region.x + region.width <= 1.000001 && region.y + region.height <= 1.000001
}

export default function ReferenceRegionPicker({ uri, name, imageWidth, imageHeight, selection, enabled, onChange, onReferenceDragStart }: Props) {
  const pickerRef = useRef<HTMLDivElement>(null)
  const [stageHeight, setStageHeight] = useState(460)
  useEffect(() => {
    const picker = pickerRef.current
    if (!picker) return
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.max(140, Math.min(460, entry.contentRect.height - (enabled ? 44 : 0)))
      setStageHeight((previous) => previous === height ? previous : height)
    })
    observer.observe(picker)
    return () => observer.disconnect()
  }, [enabled])
  const drag = useRef<{ pointerId: number; start: Point } | null>(null)
  const [preview, setPreview] = useState<Rect | null>(null)
  const [hint, setHint] = useState('')
  const ratio = imageWidth && imageHeight ? imageWidth / imageHeight : 1.5
  const visible = preview ?? selection

  function point(event: PointerEvent<HTMLDivElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp((event.clientY - bounds.top) / bounds.height),
    }
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    const start = point(event)
    drag.current = { pointerId: event.pointerId, start }
    setPreview({ ...start, width: 0, height: 0 })
    setHint('')
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || drag.current?.pointerId !== event.pointerId) return
    setPreview(regionBetween(drag.current.start, point(event)))
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    const region = regionBetween(drag.current.start, point(event))
    drag.current = null
    setPreview(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (validReferenceRegion(region)) onChange(region)
    else setHint('너비와 높이가 각각 이미지의 4% 이상이 되도록 다시 선택해 주세요.')
  }

  function pointerCancel(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setPreview(null)
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!enabled) return
    if (event.key === 'Escape') { event.preventDefault(); onChange(null); return }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!selection) onChange(INITIAL_REGION)
      return
    }
    const delta = event.key === 'ArrowRight' ? KEY_STEP : event.key === 'ArrowLeft' ? -KEY_STEP
      : event.key === 'ArrowDown' ? KEY_STEP : event.key === 'ArrowUp' ? -KEY_STEP : null
    if (delta === null) return
    event.preventDefault()
    const base = selection ?? INITIAL_REGION
    if (event.shiftKey) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        onChange({ ...base, width: Math.max(MIN_REGION, Math.min(1 - base.x, base.width + delta)) })
      } else {
        onChange({ ...base, height: Math.max(MIN_REGION, Math.min(1 - base.y, base.height + delta)) })
      }
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      onChange({ ...base, x: Math.max(0, Math.min(1 - base.width, base.x + delta)) })
    } else {
      onChange({ ...base, y: Math.max(0, Math.min(1 - base.height, base.y + delta)) })
    }
  }

  return <div ref={pickerRef} className="reference-region-picker">
    <div className={`reference-region-picker__stage ${enabled ? 'is-drawing' : ''}`}
      style={{ aspectRatio: `${imageWidth || 3} / ${imageHeight || 2}`, maxWidth: `${Math.round(stageHeight * ratio)}px` }}
      role="img" aria-label={`${name} ${enabled ? '선택 영역 편집' : '전체 이미지 보기'}`}
      aria-description={enabled ? '포인터를 드래그해 영역을 선택합니다. 키보드는 Enter로 중앙 영역을 만든 뒤 방향키로 이동하고 Shift와 방향키로 크기를 조정합니다. Escape는 선택을 해제합니다.' : undefined}
      tabIndex={enabled ? 0 : undefined}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel}
      draggable={!!onReferenceDragStart && !enabled}
      onKeyDown={keyDown} onDragStart={event => { if (onReferenceDragStart && (!enabled || (event.target as HTMLElement).classList.contains('reference-region-picker__selection'))) onReferenceDragStart(event); else event.preventDefault(); }}>
      <AssetImage uri={uri} alt={`${name} 참고 이미지`} className="reference-region-picker__image" />
      {enabled && visible && validReferenceRegion(visible) && <div className="reference-region-picker__selection" aria-hidden="true" draggable={!!onReferenceDragStart} onPointerDown={event => { if (onReferenceDragStart && !event.shiftKey) event.stopPropagation(); }} style={{ left: `${visible.x * 100}%`, top: `${visible.y * 100}%`, width: `${visible.width * 100}%`, height: `${visible.height * 100}%` }} />}
      {enabled && <span className="reference-region-picker__mode" aria-hidden="true">선택 영역</span>}
    </div>
    {enabled && (hint ? <TimedNotice lifetimeKey={hint} className="reference-region-picker__hint" onDismiss={()=>setHint('')}><span>{hint}</span></TimedNotice> : <p className="reference-region-picker__hint">{selection && onReferenceDragStart ? '선택한 부분을 도면에 끌어 놓을 수 있습니다. 다시 선택하려면 영역 바깥에서 그리거나 Shift를 누르고 그리세요.' : '이미지에서 필요한 부분을 드래그하세요. 방향키로 이동하고 Shift+방향키로 크기를 조정할 수도 있습니다.'}</p>)}
  </div>
}
