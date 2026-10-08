import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import './swipe-carousel.css'
import NucleoIcon from './NucleoIcon'

export interface CarouselItem {
  id: string
  content: ReactNode
}

interface SwipeCarouselProps {
  label: string
  items: CarouselItem[]
  variant: 'photo' | 'history' | 'gallery'
  activeId?: string
  onActiveIdChange?: (id: string) => void
  compactControls?: boolean
}

interface PointerStart {
  pointerId: number
  x: number
  scrollLeft: number
  index: number
  dragging: boolean
}

/** A scrollable list whose selected item also has explicit button and keyboard navigation. */
export default function SwipeCarousel({ label, items, variant, activeId, onActiveIdChange, compactControls = false }: SwipeCarouselProps) {
  const [localIndex, setLocalIndex] = useState(0)
  const [dragging, setDragging] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<PointerStart | null>(null)
  const suppressClickRef = useRef(false)
  const suppressTimerRef = useRef<number | null>(null)

  const controlledIndex = activeId === undefined ? -1 : items.findIndex((item) => item.id === activeId)
  const index = Math.max(0, Math.min(items.length - 1, controlledIndex >= 0 ? controlledIndex : localIndex))

  function scrollToIndex(nextIndex: number, behavior: ScrollBehavior = 'smooth') {
    const viewport = viewportRef.current
    const slide = viewport?.querySelectorAll<HTMLElement>('.swipe-carousel__slide')[nextIndex]
    const first = viewport?.querySelector<HTMLElement>('.swipe-carousel__slide')
    if (!viewport || !slide || !first) return
    const motionBehavior = behavior === 'smooth' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'instant' : behavior
    viewport.scrollTo({ left: slide.offsetLeft - first.offsetLeft, behavior: motionBehavior })
  }

  function selectIndex(nextIndex: number) {
    if (!items.length) return
    const clamped = Math.max(0, Math.min(items.length - 1, nextIndex))
    if (activeId === undefined) setLocalIndex(clamped)
    onActiveIdChange?.(items[clamped].id)
    scrollToIndex(clamped)
  }

  useEffect(() => {
    scrollToIndex(index, 'instant')
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => scrollToIndex(index, 'instant'))
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [index, items.length])

  useEffect(() => () => {
    if (suppressTimerRef.current !== null) window.clearTimeout(suppressTimerRef.current)
  }, [])

  useEffect(() => {
    if (!compactControls || variant !== 'photo') return;
    const viewport = viewportRef.current;
    const controls = viewport?.parentElement?.querySelector<HTMLElement>('.swipe-carousel__controls');
    if (!viewport || !controls) return;
    const figures = [...viewport.querySelectorAll<HTMLElement>('figure')];
    const update = () => figures.forEach(figure => {
      const caption = figure.querySelector<HTMLElement>('figcaption');
      if (!caption) return;
      const w = figure.clientWidth, h = figure.clientHeight;
      if (!w || !h) return;
      const radius = parseFloat(getComputedStyle(figure).getPropertyValue('--radius-space-photo')) || 0;
      const r = Math.min(radius, w / 12, h / 12);
      const a = Math.min(caption.offsetWidth, w - 2 * r), c = Math.min(caption.offsetHeight, h / 3);
      const bx = w - Math.min(controls.offsetWidth, w - 2 * r), by = h - Math.min(controls.offsetHeight, h / 3);
      // One rounded silhouette, including the concave corners of both information cutouts.
      const path = `M ${a + r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${by - r} A ${r} ${r} 0 0 1 ${w - r} ${by} H ${bx + r} A ${r} ${r} 0 0 0 ${bx} ${by + r} V ${h - r} A ${r} ${r} 0 0 1 ${bx - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${c + r} A ${r} ${r} 0 0 1 ${r} ${c} H ${a - r} A ${r} ${r} 0 0 0 ${a} ${c - r} V ${r} A ${r} ${r} 0 0 1 ${a + r} 0 Z`;
      figure.style.setProperty('--space-photo-outline', `path('${path}')`);
    });
    update();
    const observer = new ResizeObserver(update);
    [viewport, controls, ...figures, ...figures.flatMap(figure => [...figure.querySelectorAll('figcaption')])].forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [compactControls, variant, items.length, index]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointerRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      index,
      dragging: false,
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = pointerRef.current
    if (!start || start.pointerId !== event.pointerId) return
    const delta = event.clientX - start.x
    if (!start.dragging && Math.abs(delta) > 6) {
      start.dragging = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (!start.dragging) return
    event.preventDefault()
    event.currentTarget.scrollLeft = start.scrollLeft - delta
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    const start = pointerRef.current
    if (!start || start.pointerId !== event.pointerId) return
    pointerRef.current = null
    if (!start.dragging) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setDragging(false)
    suppressClickRef.current = true
    if (suppressTimerRef.current !== null) window.clearTimeout(suppressTimerRef.current)
    suppressTimerRef.current = window.setTimeout(() => { suppressClickRef.current = false }, 0)

    const delta = event.clientX - start.x
    if (Math.abs(delta) >= 40) {
      selectIndex(start.index + (delta < 0 ? 1 : -1))
      return
    }
    const viewport = viewportRef.current
    const first = viewport?.querySelector<HTMLElement>('.swipe-carousel__slide')
    const slides = viewport?.querySelectorAll<HTMLElement>('.swipe-carousel__slide')
    if (!viewport || !first || !slides?.length) return
    let nearest = 0
    let distance = Number.POSITIVE_INFINITY
    slides.forEach((slide, slideIndex) => {
      const gap = Math.abs(slide.offsetLeft - first.offsetLeft - viewport.scrollLeft)
      if (gap < distance) { distance = gap; nearest = slideIndex }
    })
    selectIndex(nearest)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') { event.preventDefault(); selectIndex(index + 1) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); selectIndex(index - 1) }
  }

  return <div className={`swipe-carousel swipe-carousel--${variant} ${compactControls && variant === 'photo' ? 'swipe-carousel--notched' : ''} ${items.length < 2 ? 'swipe-carousel--single' : ''}`} role="region" aria-roledescription="캐러셀" aria-label={label}>
    <div
      ref={viewportRef}
      className={`swipe-carousel__viewport ${dragging ? 'is-dragging' : ''}`}
      tabIndex={items.length > 1 ? 0 : undefined}
      aria-label={items.length > 1
        ? `${label} 목록. 왼쪽·오른쪽 방향키나 드래그로 이동할 수 있습니다.`
        : `${label} 목록. 항목 ${items.length}개.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onKeyDown={onKeyDown}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {items.map((item, itemIndex) => <div
        className={`swipe-carousel__slide ${itemIndex === index ? 'is-active' : ''}`}
        key={item.id}
        role="group"
        aria-roledescription="슬라이드"
        aria-label={`${itemIndex + 1} / ${items.length}`}
        aria-current={itemIndex === index ? 'true' : undefined}
        onFocus={() => { if (itemIndex !== index) selectIndex(itemIndex) }}
      >{item.content}</div>)}
    </div>
    <div className="swipe-carousel__controls">
      <button type="button" className="button button-secondary" onClick={() => selectIndex(index - 1)} disabled={index === 0} aria-label={`${label} 이전 항목`}>{compactControls && variant === 'photo' ? <img src="/figma/source/photo-previous.svg" alt="" aria-hidden="true" /> : compactControls ? <NucleoIcon name="previous" /> : '이전'}</button>
      <span className="swipe-carousel__count" aria-live="polite">{items.length ? index + 1 : 0} / {items.length}</span>
      <button type="button" className="button button-secondary" onClick={() => selectIndex(index + 1)} disabled={index >= items.length - 1} aria-label={`${label} 다음 항목`}>{compactControls && variant === 'photo' ? <img src="/figma/source/photo-next.svg" alt="" aria-hidden="true" /> : compactControls ? <NucleoIcon name="next" /> : '다음'}</button>
    </div>
  </div>
}
