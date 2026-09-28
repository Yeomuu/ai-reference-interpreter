import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Area, Camera, CommonPatch, DesignElement, ElementKind, FloorPlan, PlacementTarget, Point, Project, Rect, Reference, Result, SourceImage, Structure, ValidationIssue } from '../domain'
import { addCamera, allowedTargetKinds, appendResult, cameraConditionsChanged, createEmptyProject, isStructureLocked, moveStructure, placeElement, removeDesignElement, removeReference, setResultApproved, setStructurePreservation, structureMovementReason, structurePosition, targetLabel, updateCamera, updateCommon, updateElement, updateKeep, updatePhotoAnchor, validateAreaDrawing, validateCamera, validatePreflight, validateStructureDrawing, validateStructureOperation } from '../domain'
import { createSampleProject } from '../data/sample'
import { loadProjects, saveProject } from '../services/persistence'
import { deleteImageAsset, putImageAsset, resolveImageUri, revokeImageUrl, validateImageFile } from '../services/assets'
import { GenerationOutcomeUnknownError, OFFLINE_DEMO_NOTICE, createApiImageProvider, getGenerationStatus, offlineDemoProvider } from '../services/imageProvider'
import type { GenerationStatus } from '../services/imageProvider'
import { referencePreparationFor } from '../services/generationContract'
import AssetImage from '../components/AssetImage'
import PlanCanvas from '../components/PlanCanvas'
import PhotoKeepOverlay from '../components/PhotoKeepOverlay'
import SwipeCarousel from '../components/SwipeCarousel'
import NucleoIcon from '../components/NucleoIcon'
import ReferenceRegionPicker, { validReferenceRegion } from '../components/ReferenceRegionPicker'
import type { NucleoIconName } from '../components/NucleoIcon'
import { STEPS, useProjectRoute } from './routes'
import type { Step } from './routes'
import ExperimentPanel from '../components/ExperimentPanel'
import { ExperimentRecorder, targetPayload } from '../services/experiment'

const STEP_LABELS: Record<Step, string> = {
  projects: '프로젝트', space: '공간 준비', keep: '유지할 요소', references: '참고 이미지',
  placement: '배치', camera: '시점', review: '생성 전 확인', results: '시안',
}
const NEXT_ACTIONS: Record<Exclude<Step, 'projects'>, string> = {
  space: '유지할 요소 설정', keep: '참고 이미지 선택', references: '배치하기',
  placement: '시점 설정', camera: '생성 전 확인', review: '시안 보기', results: '시안',
}
const STEP_DESCRIPTIONS: Record<Exclude<Step, 'projects'>, string> = {
  space: '기존 공간 사진과 평면도를 각각 등록하고 기본 정보를 확인하세요.',
  keep: '보존할 기존 구조를 지정하고 허용되는 표면 연출을 기록하세요.',
  references: '분위기와 제품 이미지를 구분하고 적용·제외할 요소를 정하세요.',
  placement: '요소 유형에 맞는 위치만 평면도에 지정할 수 있습니다.',
  camera: '대표 시점의 위치와 바라보는 방향을 정하세요. 추가 시점은 선택 사항입니다.',
  review: '보존·적용·제외·배치·시점을 검토하고 샘플을 열거나 AI 이미지를 생성하세요.',
  results: '조건과 결과 이력을 비교하고 필요한 항목만 수정하세요.',
}
const ELEMENT_LABELS: Record<ElementKind, string> = {
  'freestanding-fixture': '독립형 진열대', furniture: '가구', photozone: '포토존',
  'wall-graphic': '벽면 그래픽', 'wall-mounted-product': '벽 부착 제품',
  'ceiling-light': '천장 조명', 'hanging-display': '천장 행잉', 'wall-light': '벽 조명',
  'standing-light': '스탠딩 조명', 'ambient-light': '공간 조명 분위기',
  'global-palette': '전체 색채', 'floor-material': '바닥 재료', 'wall-material': '벽 재료',
}
const STRUCTURE_LABELS: Record<Structure['kind'], string> = {
  wall: '벽', window: '창', pillar: '기둥', door: '문', entrance: '출입구', 'existing-light': '기존 천장 조명', ceiling: '천장', floor: '바닥',
}

const UNKNOWN_GENERATION_RETRY_MS = 180_000
const UNKNOWN_GENERATION_SESSION_KEY = 'ai-reference-interpreter:uncertain-generation-at'

function pendingGenerationTime(): number | null {
  try {
    const raw = sessionStorage.getItem(UNKNOWN_GENERATION_SESSION_KEY)
    const time = Number(raw)
    return raw && Number.isFinite(time) && time > 0 ? time : null
  } catch { return null }
}

function makeId(prefix: string) { return `${prefix}-${crypto.randomUUID()}` }
function pct(value: number) { return Math.round(value * 100) }
function fraction(value: string) { return Number(value) / 100 }
async function imageDimensions(file: File) {
  try {
    const bitmap = await createImageBitmap(file)
    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dimensions
  } catch {
    throw new Error('이미지를 열 수 없습니다. PNG, JPG 또는 WebP 파일을 확인해 주세요.')
  }
}
function spanOnWall(wall: Structure | undefined, start: { x: number, y: number }, end: { x: number, y: number }) {
  if (!wall || wall.geometry.kind !== 'segment') return undefined
  const origin = wall.geometry.start
  const dx = wall.geometry.end.x - origin.x, dy = wall.geometry.end.y - origin.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return undefined
  const position = (point: { x: number, y: number }) => ((point.x - origin.x) * dx + (point.y - origin.y) * dy) / lengthSquared
  const a = position(start), b = position(end)
  const distance = (point: { x: number, y: number }, t: number) => Math.hypot(point.x - origin.x - t * dx, point.y - origin.y - t * dy)
  if (a < 0 || a > 1 || b < 0 || b > 1 || distance(start, a) > .015 || distance(end, b) > .015) return undefined
  return { start: Math.min(a, b), end: Math.max(a, b) }
}
function entranceClearance(plan: FloorPlan, wall: Structure, start: { x: number, y: number }, end: { x: number, y: number }) {
  if (wall.geometry.kind !== 'segment') return undefined
  const dx = wall.geometry.end.x - wall.geometry.start.x, dy = wall.geometry.end.y - wall.geometry.start.y
  const length = Math.hypot(dx, dy)
  if (!length) return undefined
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const floor = plan.areas.find((area) => area.kind === 'floor')
  const center = floor ? { x: floor.bounds.x + floor.bounds.width / 2, y: floor.bounds.y + floor.bounds.height / 2 } : { x: .5, y: .5 }
  let nx = -dy / length, ny = dx / length
  if ((center.x - mid.x) * nx + (center.y - mid.y) * ny < 0) { nx = -nx; ny = -ny }
  const points = [start, end, { x: start.x + nx * .18, y: start.y + ny * .18 }, { x: end.x + nx * .18, y: end.y + ny * .18 }]
  const x1 = Math.max(0, Math.min(...points.map((point) => point.x)) - .015)
  const y1 = Math.max(0, Math.min(...points.map((point) => point.y)) - .015)
  const x2 = Math.min(1, Math.max(...points.map((point) => point.x)) + .015)
  const y2 = Math.min(1, Math.max(...points.map((point) => point.y)) + .015)
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}
function newPlan(kind: FloorPlan['kind'], imageUri?: string): FloorPlan {
  return {
    kind, imageUri, width: 1000, height: 700, units: 'unknown', geometryConfidence: 'schematic',
    structures: kind === 'schematic' ? [
      { id: makeId('wall'), kind: 'wall', name: '윗벽', geometry: { kind: 'segment', start: { x: .08, y: .10 }, end: { x: .92, y: .10 } }, role: 'base', immutable: true, protected: true },
      { id: makeId('wall'), kind: 'wall', name: '오른쪽 벽', geometry: { kind: 'segment', start: { x: .92, y: .10 }, end: { x: .92, y: .90 } }, role: 'base', immutable: true, protected: true },
      { id: makeId('wall'), kind: 'wall', name: '아랫벽', geometry: { kind: 'segment', start: { x: .92, y: .90 }, end: { x: .08, y: .90 } }, role: 'base', immutable: true, protected: true },
      { id: makeId('wall'), kind: 'wall', name: '왼쪽 벽', geometry: { kind: 'segment', start: { x: .08, y: .90 }, end: { x: .08, y: .10 } }, role: 'base', immutable: true, protected: true },
    ] : [],
    areas: kind === 'schematic' ? [
      { id: makeId('floor'), name: '사용 바닥', kind: 'floor', bounds: { x: .08, y: .10, width: .84, height: .80 } },
      { id: makeId('ceiling'), name: '천장 범위', kind: 'ceiling', bounds: { x: .08, y: .10, width: .84, height: .80 } },
    ] : [],
  }
}
function sourceFor(project: Project, referenceId: string) {
  const reference = project.references.find((item) => item.id === referenceId)
  return project.sourceImages.find((image) => image.id === reference?.imageId)
}
function targetDescription(project: Project, target: PlacementTarget | null) {
  if (!target) return '위치 미지정'
  if (target.kind === 'floor-point') return `바닥 위치 ${pct(target.x)}%, ${pct(target.y)}%`
  if (target.kind === 'wall-segment') return `${project.floorPlan?.structures.find((item) => item.id === target.wallId)?.name ?? '벽'} · ${pct(target.start)}–${pct(target.end)}%`
  if (target.kind === 'ceiling-zone') return project.floorPlan?.areas.find((item) => item.id === target.zoneId)?.name ?? '천장 영역'
  if (target.kind === 'floor-area' || target.kind === 'named-area') return project.floorPlan?.areas.find((item) => item.id === target.areaId)?.name ?? '지정 영역'
  return '공간 전체'
}

/** Add annotations introduced after the original demo without changing a saved design decision. */
function restoreSampleAnnotations(project: Project): Project {
  if (project.id !== 'aura-popup' || !project.floorPlan) return project
  const template = createSampleProject()
  const baseline = new Map(template.floorPlan?.structures.map((item) => [item.id, item]) ?? [])
  let changed = false
  const structures = project.floorPlan.structures.map((item) => {
    const standard = baseline.get(item.id)
    if (!standard) return item
    const next = { ...item, photoAnchor: item.photoAnchor ?? standard.photoAnchor, role: 'base' as const,
      immutable: item.immutable ?? true, protected: item.immutable === false ? item.protected : true }
    if (JSON.stringify(next) !== JSON.stringify(item)) changed = true
    return next
  })
  const keeps = [...project.keeps]
  for (const keep of template.keeps) {
    if (structures.some((item) => item.id === keep.structureId && item.immutable) && !keeps.some((item) => item.structureId === keep.structureId)) { keeps.push(keep); changed = true }
  }
  const elements = project.elements.map((item) => {
    if (item.id !== 'element-warm-light' || item.label !== '따뜻한 간접 조명') return item
    changed = true
    return { ...item, label: '추가 분위기 · 따뜻한 간접 조명' }
  })
  return changed ? updateCommon(project, { floorPlan: { ...project.floorPlan, structures }, keeps, elements }) : project
}
/** Promote the four original scaffold walls saved by earlier schematic versions. */
function restoreDefaultSchematicWalls(project: Project): Project {
  const plan = project.floorPlan
  if (plan?.kind !== 'schematic') return project
  const boundaries = new Set([
    '윗벽|0.08,0.1|0.92,0.1',
    '오른쪽 벽|0.92,0.1|0.92,0.9',
    '아랫벽|0.92,0.9|0.08,0.9',
    '왼쪽 벽|0.08,0.9|0.08,0.1',
  ])
  let changed = false
  const structures = plan.structures.map((structure) => {
    if (structure.kind !== 'wall' || structure.geometry.kind !== 'segment' || structure.immutable !== undefined || structure.protected) return structure
    const { start, end } = structure.geometry
    if (!boundaries.has(`${structure.name}|${start.x},${start.y}|${end.x},${end.y}`)) return structure
    changed = true
    return { ...structure, role: 'base' as const, immutable: true, protected: true }
  })
  if (!changed) return project
  const keeps = [...project.keeps]
  for (const structure of structures) {
    if (structure.immutable && !keeps.some((keep) => keep.structureId === structure.id)) {
      keeps.push({ id: makeId('keep'), structureId: structure.id, intent: 'preserve', description: `${structure.name}의 위치와 형태 보존` })
    }
  }
  return updateCommon(project, { floorPlan: { ...plan, structures }, keeps })
}
function restoreProjectAnnotations(project: Project): Project {
  return restoreDefaultSchematicWalls(restoreSampleAnnotations(project))
}
function Button({ children, onClick, tone = 'secondary', disabled, loading = false, pressed, type = 'button', className = '', icon, iconAfter = false }: {
  children: ReactNode, onClick?: () => void, tone?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'danger-quiet',
  disabled?: boolean, loading?: boolean, pressed?: boolean, type?: 'button' | 'submit', className?: string, icon?: NucleoIconName, iconAfter?: boolean,
}) {
  return <button type={type} className={`button button-${tone} ${className}`} onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined} aria-pressed={pressed}>{icon && !iconAfter && <NucleoIcon name={icon} />}{children}{icon && iconAfter && <NucleoIcon name={icon} />}</button>
}
function FilePick({ label, onFile, accept = 'image/png,image/jpeg,image/webp', tone = 'secondary', disabled = false }: {
  label: string, onFile: (file: File) => void, accept?: string, tone?: 'primary' | 'secondary', disabled?: boolean,
}) {
  return <label className={`button button-${tone} file-pick`} aria-disabled={disabled}><span>{label}</span><input type="file" disabled={disabled} accept={accept} onChange={(event) => {
    const file = event.target.files?.[0]
    if (file) onFile(file)
    event.target.value = ''
  }} /></label>
}
function Badge({ children, tone = 'neutral' }: { children: ReactNode, tone?: 'neutral' | 'keep' | 'info' | 'selected' | 'error' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
function Empty({ children }: { children: ReactNode }) { return <div className="empty-state">{children}</div> }

export default function App() {
  const [experiment] = useState(() => new ExperimentRecorder({ getItem: (key) => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) }))
  const [route, navigate] = useProjectRoute()
  const step = route.step
  const [projects, setProjects] = useState<Project[]>(() => { try { return loadProjects() } catch { return [] } })
  const [project, setProject] = useState<Project>(() => { try { return restoreProjectAnnotations(loadProjects().find((item) => item.id === (route.projectId ?? 'aura-popup')) ?? createSampleProject()) } catch { return createSampleProject() } })
  const projectRef = useRef(project)
  const [notice, setNotice] = useState('')
  const [noticeSerial, setNoticeSerial] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null)
  const [generationStatusLoading, setGenerationStatusLoading] = useState(false)
  const [generationExistingPhotoId, setGenerationExistingPhotoId] = useState(() => project.sourceImages.find((item) => item.role === 'existing-space')?.id ?? '')
  const [uncertainGenerationAt, setUncertainGenerationAt] = useState<number | null>(pendingGenerationTime)
  const [generationClock, setGenerationClock] = useState(() => Date.now())
  const [saveFailed, setSaveFailed] = useState(false)
  const [alignmentChecked, setAlignmentChecked] = useState(false)
  const [selectedStructureId, setSelectedStructureId] = useState(() => project.floorPlan?.structures[0]?.id ?? '')
  const [selectedElementId, setSelectedElementId] = useState(() => project.elements.find((item) => item.status === 'apply')?.id ?? '')
  const [selectedCameraId, setSelectedCameraId] = useState(() => project.cameras.find((item) => item.primary)?.id ?? project.cameras[0]?.id ?? '')
  const [selectedResultId, setSelectedResultId] = useState(() => project.results.at(-1)?.id ?? '')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('')
  const [newConcept, setNewConcept] = useState('')
  const [elementLabel, setElementLabel] = useState('')
  const [elementKind, setElementKind] = useState<ElementKind>('freestanding-fixture')
  const [structureKind, setStructureKind] = useState<Structure['kind']>('wall')
  const [structureName, setStructureName] = useState('')
  const [structureX, setStructureX] = useState('50')
  const [structureY, setStructureY] = useState('50')
  const [structureEndX, setStructureEndX] = useState('65')
  const [structureEndY, setStructureEndY] = useState('50')
  const [structureParent, setStructureParent] = useState('')
  const [structureRole, setStructureRole] = useState<'base' | 'partition'>('partition')
  const [structureLightTone, setStructureLightTone] = useState('온백색')
  const [planDetailTab, setPlanDetailTab] = useState<'plan' | 'structure' | 'area'>('plan')
  const [planEditError, setPlanEditError] = useState('')
  const [showWorkspaceLeft, setShowWorkspaceLeft] = useState(true)
  const [showWorkspaceRight, setShowWorkspaceRight] = useState(true)
  const [areaKind, setAreaKind] = useState<Area['kind']>('spatial')
  const [areaName, setAreaName] = useState('')
  const [areaX, setAreaX] = useState('30')
  const [areaY, setAreaY] = useState('30')
  const [areaWidth, setAreaWidth] = useState('20')
  const [areaHeight, setAreaHeight] = useState('20')
  const [referenceFocus, setReferenceFocus] = useState('')
  const [referenceRegionMode, setReferenceRegionMode] = useState<'whole' | 'region'>('whole')
  const [referenceRegionDraft, setReferenceRegionDraft] = useState<Rect | null>(null)
  const [regionEditingElementId, setRegionEditingElementId] = useState<string | null>(null)
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const [conditionDraft, setConditionDraft] = useState('')
  const [appearanceDraft, setAppearanceDraft] = useState('')
  const [kindDraft, setKindDraft] = useState<ElementKind>('freestanding-fixture')
  const [pendingPlacement, setPendingPlacement] = useState<{ elementId: string, target: PlacementTarget, warnings: string[] } | null>(null)
  const [pendingReferenceDelete, setPendingReferenceDelete] = useState<string | null>(null)
  const [undoAction, setUndoAction] = useState<{ projectId: string, revision: number, patch: CommonPatch, label: string, referenceId?: string, structureId?: string } | null>(null)
  const [placementSelection, setPlacementSelection] = useState<'element' | 'structure'>('element')
  const pageTitleRef = useRef<HTMLHeadingElement>(null)
  const stepNavRef = useRef<HTMLElement>(null)
  const referenceDeleteConfirmRef = useRef<HTMLElement>(null)
  const generationInFlightRef = useRef(false)
  const deletedAssetCandidatesRef = useRef(new Set<string>())
  const conditionEditStartedRef = useRef(0)

  const selectedElement = project.elements.find((item) => item.id === selectedElementId)
  const selectedStructure = project.floorPlan?.structures.find((item) => item.id === selectedStructureId)
  const selectedCamera = project.cameras.find((item) => item.id === selectedCameraId) ?? project.cameras[0]
  const selectedResult = project.results.find((item) => item.id === selectedResultId) ?? project.results.at(-1)
  const preflight = useMemo(() => validatePreflight(project, selectedCameraId || undefined), [project, selectedCameraId])
  const unknownRetrySeconds = uncertainGenerationAt === null ? 0 : Math.max(0, Math.ceil((uncertainGenerationAt + UNKNOWN_GENERATION_RETRY_MS - generationClock) / 1000))

  useEffect(() => {
    if (!route.projectId || route.projectId === projectRef.current.id) return
    const saved = loadProjects().find((item) => item.id === route.projectId)
    if (!saved && route.projectId !== 'aura-popup') {
      navigate({ step: 'projects' }, true)
      setError('이 브라우저에서 해당 프로젝트를 찾을 수 없습니다. 저장된 프로젝트를 열어 주세요.')
      return
    }
    const restored = restoreProjectAnnotations(saved ?? createSampleProject())
    projectRef.current = restored
    setProject(restored)
    setSelectedStructureId(restored.floorPlan?.structures[0]?.id ?? '')
    setSelectedElementId(restored.elements.find((item) => item.status === 'apply')?.id ?? '')
    setSelectedCameraId(restored.cameras.find((item) => item.primary)?.id ?? restored.cameras[0]?.id ?? '')
    setSelectedResultId(restored.results.at(-1)?.id ?? '')
    setGenerationExistingPhotoId(restored.sourceImages.find((item) => item.role === 'existing-space')?.id ?? '')
    setPlanDetailTab('plan'); setPlanEditError(''); setStructureParent('')
    setReferenceFocus(''); setReferenceRegionMode('whole'); setReferenceRegionDraft(null)
    setRegionEditingElementId(null); setEditingElementId(null); setUndoAction(null)
    setPlacementSelection('element'); setAlignmentChecked(false)
  }, [route.projectId, navigate])
  useEffect(() => {
    setPendingPlacement(null); setPendingReferenceDelete(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
    const frame = window.requestAnimationFrame(() => pageTitleRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [route.step, route.projectId])
  useEffect(() => {
    experiment.resume(route.step, projectRef.current.id)
    experiment.transition(route.step, projectRef.current, route.navigation)
  }, [experiment, route.step, route.projectId, route.navigation])
  useEffect(() => {
    const focus = () => experiment.focus(true), blur = () => experiment.focus(false)
    const visibility = () => experiment.focus(document.visibilityState === 'visible')
    window.addEventListener('focus', focus); window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('focus', focus); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility) }
  }, [experiment])
  useEffect(() => {
    if (step === 'keep' && selectedStructureId) experiment.record('preservation_detail_open', 'structure', selectedStructureId, { source: 'plan' })
  }, [experiment, step, selectedStructureId])
  useEffect(() => {
    if (step === 'results' && selectedResultId) experiment.record('result_view', 'result', selectedResultId)
  }, [experiment, step, selectedResultId])

  function recordCanvasDrag(phase: 'start' | 'end' | 'cancel', kind: string, id: string) {
    experiment.record(`drag_${phase}`, kind.startsWith('camera') ? 'camera' : kind.startsWith('structure') ? 'structure' : 'element', id, { drag_kind: kind }, phase === 'cancel' ? 'cancel' : 'success')
  }
  function drawingWall() {
    const walls = project.floorPlan?.structures.filter((item) => item.kind === 'wall' && item.geometry.kind === 'segment') ?? []
    return walls.find((wall) => wall.id === structureParent) ?? walls.find((wall) => wall.id === selectedStructureId) ?? walls[0]
  }
  function selectDrawingWall(id: string) {
    const wall = project.floorPlan?.structures.find((item) => item.id === id && item.kind === 'wall')
    if (!wall || wall.geometry.kind !== 'segment') return
    setStructureParent(id)
    setSelectedStructureId(id)
    setPlanEditError('')
    const start = wall.geometry.start, end = wall.geometry.end
    const wallPercent = (value: number) => String(Math.round(value * 10_000) / 100)
    setStructureX(wallPercent(start.x + (end.x - start.x) * .25))
    setStructureY(wallPercent(start.y + (end.y - start.y) * .25))
    setStructureEndX(wallPercent(start.x + (end.x - start.x) * .5))
    setStructureEndY(wallPercent(start.y + (end.y - start.y) * .5))
  }
  function chooseStructureTool(kind: Structure['kind'], role: 'base' | 'partition' = 'base') {
    setStructureKind(kind)
    setStructureRole(role)
    setPlanDetailTab('structure')
    setPlanEditError('')
    setStructureName('')
    if (['window', 'door', 'entrance'].includes(kind)) {
      const wall = drawingWall()
      if (wall) selectDrawingWall(wall.id)
    }
  }
  function rejectPlanEdit(message: string) { experiment.record(planDetailTab === 'area' ? 'area_invalid' : 'structure_invalid', 'structure', selectedStructureId, { invalid_reason: 'invalid_geometry' }, 'invalid'); setPlanEditError(message); setError(message) }

  function showNotice(message: string) { setNotice(message); setNoticeSerial((value) => value + 1) }
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [notice, noticeSerial])
  useEffect(() => {
    if (!pendingReferenceDelete) return
    referenceDeleteConfirmRef.current?.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.focus({ preventScroll: true })
    const cancelWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setPendingReferenceDelete(null)
      document.querySelector<HTMLButtonElement>('.reference-header-actions button')?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', cancelWithEscape)
    return () => document.removeEventListener('keydown', cancelWithEscape)
  }, [pendingReferenceDelete])
  useEffect(() => {
    const retainedProjects = [...projects, project]
    for (const uri of deletedAssetCandidatesRef.current) {
      const inUndo = undoAction?.patch.sourceImages?.some((image) => image.uri === uri)
      const inProject = retainedProjects.some((item) => item.sourceImages.some((image) => image.uri === uri) || item.floorPlan?.imageUri === uri ||
        item.results.some((result) => result.imageUri === uri || result.conditionsSnapshot.common?.sourceImages?.some((image) => image.uri === uri)))
      if (inUndo || inProject) continue
      deletedAssetCandidatesRef.current.delete(uri)
      void deleteImageAsset(uri).catch(() => setError('레퍼런스 목록은 삭제했지만 사용하지 않는 원본 파일을 정리하지 못했습니다.'))
    }
  }, [project, projects, undoAction])
  useEffect(() => {
    if (uncertainGenerationAt === null) return
    const timer = window.setInterval(() => setGenerationClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [uncertainGenerationAt])
  useEffect(() => {
    const nav = stepNavRef.current
    if (!nav) return
    const centerCurrentStep = () => {
      const active = nav.querySelector<HTMLElement>('.step-link.is-current')
      if (!active) return
      const left = active.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft - (nav.clientWidth - active.clientWidth) / 2
      nav.scrollTo({ left, behavior: 'instant' })
    }
    centerCurrentStep()
    const observer = new ResizeObserver(centerCurrentStep)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [step])
  useEffect(() => {
    if (step !== 'review') return
    let cancelled = false
    setGenerationStatusLoading(true)
    getGenerationStatus().then((status) => {
      if (!cancelled) setGenerationStatus(status)
    }).catch(() => {
      if (!cancelled) setGenerationStatus(null)
    }).finally(() => {
      if (!cancelled) setGenerationStatusLoading(false)
    })
    return () => { cancelled = true }
  }, [step])

  function commit(next: Project, message?: string): boolean {
    if (next === projectRef.current) return true
    try {
      saveProject(next)
      experiment.changes(projectRef.current, next)
      setSaveFailed(false)
      projectRef.current = next
      setProject(next)
      setProjects(loadProjects())
      setError('')
      setUndoAction(null)
      if (message) showNotice(message)
      return true
    } catch (cause) {
      setSaveFailed(true)
      setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
      setNotice('')
      return false
    }
  }
  function open(next: Project) {
    const restored = restoreProjectAnnotations(next)
    projectRef.current = restored
    setProject(restored)
    setSelectedStructureId(restored.floorPlan?.structures[0]?.id ?? '')
    setSelectedElementId(restored.elements[0]?.id ?? '')
    setSelectedCameraId(restored.cameras.find((item) => item.primary)?.id ?? restored.cameras[0]?.id ?? '')
    setSelectedResultId(restored.results.at(-1)?.id ?? '')
    setNotice('')
    setError('')
    setAlignmentChecked(false)
    setStructureParent('')
    setPlanDetailTab('plan')
    setPlanEditError('')
    setReferenceFocus('')
    setReferenceRegionMode('whole')
    setReferenceRegionDraft(null)
    setRegionEditingElementId(null)
    setGenerationExistingPhotoId(restored.sourceImages.find((image) => image.role === 'existing-space')?.id ?? '')
    setEditingElementId(null)
    setPendingReferenceDelete(null); setUndoAction(null); setPlacementSelection('element')
    navigate({ step: 'space', projectId: restored.id })
    try { saveProject(restored); setProjects(loadProjects()); setSaveFailed(false) } catch (cause) { setSaveFailed(true); setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.') }
  }
  function createProject() {
    if (!newName.trim()) { setError('프로젝트 이름을 입력해 주세요.'); return }
    const next = updateCommon(createEmptyProject(makeId('project'), newName.trim()), { spaceType: newType.trim(), concept: newConcept.trim() })
    if (!commit(next, '새 프로젝트를 만들었습니다.')) return
    setSelectedStructureId(''); setSelectedElementId(''); setSelectedCameraId(''); setSelectedResultId('')
    setAlignmentChecked(false); setStructureParent(''); setReferenceFocus('')
    setPlanDetailTab('plan'); setPlanEditError('')
    setReferenceRegionMode('whole'); setReferenceRegionDraft(null); setRegionEditingElementId(null)
    setGenerationExistingPhotoId('')
    setEditingElementId(null)
    setNewName(''); setNewType(''); setNewConcept(''); setUndoAction(null); setPendingReferenceDelete(null); setPlacementSelection('element')
    navigate({ step: 'space', projectId: next.id })
  }
  function go(next: Step) {
    if (step === 'results' && next !== 'results' && next !== 'projects') experiment.record('result_revise', 'result', selectedResultId, { to_step: next })
    if (next === 'placement' && !project.elements.some((item) => item.id === selectedElementId && item.status === 'apply')) {
      setSelectedElementId(project.elements.find((item) => item.status === 'apply')?.id ?? '')
    }
    setPendingPlacement(null)
    setPendingReferenceDelete(null)
    navigate({ step: next, projectId: next === 'projects' ? undefined : projectRef.current.id })
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.requestAnimationFrame(() => pageTitleRef.current?.focus({ preventScroll: true }))
  }
  function editElement(id: string) {
    const element = project.elements.find((item) => item.id === id)
    if (!element) { go('references'); setError('현재 작업에서 삭제한 요소입니다. 이전 결과의 조건 기록은 보관되어 있습니다.'); return }
    if (element.status === 'exclude') { go('references'); setSelectedElementId(id); setReferenceFocus(element.sourceReferenceId); return }
    go('placement'); setPlacementSelection('element'); setSelectedElementId(id)
  }
  function selectPlacementStructure(id: string) { setSelectedStructureId(id); setPlacementSelection('structure'); setPendingPlacement(null); setPlanEditError('') }
  function selectPlacementElement(id: string) { setSelectedElementId(id); setPlacementSelection('element'); setPendingPlacement(null); setPlanEditError('') }
  function editStructurePosition(id: string) { go('placement'); selectPlacementStructure(id) }

  function commitDeletion(next: Project, label: string, focus: { referenceId?: string, structureId?: string } = {}) {
    const previous = projectRef.current
    const patch: CommonPatch = {}
    for (const key of ['sourceImages', 'references', 'elements', 'floorPlan', 'keeps'] as const) {
      if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) Object.assign(patch, { [key]: previous[key] })
    }
    if (!commit(next, `${label}했습니다.`)) return false
    for (const image of previous.sourceImages) {
      if (image.uri.startsWith('asset://') && !next.sourceImages.some((item) => item.uri === image.uri)) deletedAssetCandidatesRef.current.add(image.uri)
    }
    setUndoAction({ projectId: previous.id, revision: next.commonRevision, patch, label, ...focus })
    return true
  }
  function undoDeletion() {
    if (!undoAction || undoAction.projectId !== project.id || undoAction.revision !== project.commonRevision) return
    const focus = undoAction
    if (!commit(updateCommon(project, undoAction.patch), '삭제를 되돌렸습니다.')) return
    experiment.record('deletion_undo')
    if (focus.referenceId) setReferenceFocus(focus.referenceId)
    if (focus.structureId) setSelectedStructureId(focus.structureId)
    window.requestAnimationFrame(() => {
      const restoredControl = document.querySelector<HTMLButtonElement>(focus.referenceId ? '.reference-thumb[aria-pressed="true"]' : '.preservation-switch')
      if (restoredControl) restoredControl.focus({ preventScroll: true })
      else pageTitleRef.current?.focus({ preventScroll: true })
    })
  }
  function deleteReferenceImage(referenceId: string) {
    const reference = project.references.find((item) => item.id === referenceId)
    if (!reference || busy) return
    if (!commitDeletion(removeReference(project, referenceId), '레퍼런스를 삭제', { referenceId })) return
    setReferenceFocus(''); setPendingReferenceDelete(null); setReferenceRegionMode('whole')
    setReferenceRegionDraft(null); setRegionEditingElementId(null); setEditingElementId(null); setPendingPlacement(null)
    if (!projectRef.current.elements.some((item) => item.id === selectedElementId)) setSelectedElementId(projectRef.current.elements[0]?.id ?? '')
    window.requestAnimationFrame(() => pageTitleRef.current?.focus({ preventScroll: true }))
  }
  function deleteElement(element: DesignElement) {
    if (!commitDeletion(removeDesignElement(project, element.id), '디자인 요소를 삭제', { referenceId: element.sourceReferenceId })) return
    setEditingElementId(null); setRegionEditingElementId(null); setPendingPlacement(null)
    setSelectedElementId(projectRef.current.elements[0]?.id ?? '')
  }
  function beginConditionEdit(element: DesignElement) {
    experiment.record('condition_edit_start', 'element', element.id)
    conditionEditStartedRef.current = Date.now()
    setSelectedElementId(element.id)
    setReferenceFocus(element.sourceReferenceId)
    setConditionDraft(element.conditions ?? '')
    setAppearanceDraft(element.appearance ?? '')
    setKindDraft(element.kind)
    setEditingElementId(element.id)
  }
  function cancelConditionEdit() {
    if (editingElementId) experiment.record('condition_edit_cancel', 'element', editingElementId, {}, 'cancel')
    setEditingElementId(null)
  }
  function saveConditionEdit(element: DesignElement) {
    const changedFields = [(element.conditions?.trim() ?? '') !== conditionDraft.trim() ? 'conditions' : '', (element.appearance?.trim() ?? '') !== appearanceDraft.trim() ? 'appearance' : '', element.kind !== kindDraft ? 'kind' : ''].filter(Boolean).join(',') || 'none'
    const next = updateElement(project, element.id, { conditions: conditionDraft.trim(), appearance: appearanceDraft.trim(), kind: kindDraft })
    const targetCleared = Boolean(element.target && !next.elements.find((item) => item.id === element.id)?.target)
    if (commit(next, targetCleared ? '조건과 유형을 저장했습니다. 바뀐 유형에 맞춰 위치를 다시 지정해 주세요.' : '조건을 저장했습니다.')) {
      experiment.record('condition_edit_save', 'element', element.id, { changed_fields: changedFields, edit_duration_ms: Math.max(0, Date.now() - conditionEditStartedRef.current), character_count: conditionDraft.trim().length + appearanceDraft.trim().length, element_type: kindDraft })
      setEditingElementId(null)
    }
  }
  function applyTarget(target: PlacementTarget) {
    if (!selectedElement) return
    applyElementTarget(selectedElement.id, target)
  }
  function applyElementTarget(elementId: string, target: PlacementTarget, acknowledgedWarnings = false) {
    if (!acknowledgedWarnings) experiment.record('placement_start', 'element', elementId, targetPayload(target))
    const placed = placeElement(project, elementId, target)
    if (!placed.validation.valid) { experiment.record('placement_invalid', 'element', elementId, { ...targetPayload(target), invalid_reason: placed.validation.issues.map((issue) => issue.code).join(',') }, 'invalid'); setPendingPlacement(null); setError(placed.validation.issues.map((item) => item.message).join(' ')); return }
    const warnings = placed.validation.issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message)
    if (warnings.length && !acknowledgedWarnings) { setPendingPlacement({ elementId, target, warnings }); setError(''); return }
    setPendingPlacement(null)
    commit(placed.project, `${project.elements.find((item) => item.id === elementId)?.label ?? '요소'}의 배치를 저장했습니다.`)
  }
  function applyCameraChange(cameraId: string, patch: Partial<Omit<Camera, 'id'>>) {
    const next = updateCamera(project, cameraId, patch)
    const checked = validateCamera(next, cameraId)
    if (!checked.valid) { setError(checked.issues.map((issue) => issue.message).join(' ')); return }
    commit(next, '카메라 위치와 방향을 저장했습니다.')
  }
  function renderWorkspaceToolbar(leftLabel: string) {
    return <div className="workspace-toolbar" aria-label="작업 패널 표시"><Button tone="quiet" pressed={showWorkspaceLeft} onClick={() => setShowWorkspaceLeft((value) => !value)}>{leftLabel} {showWorkspaceLeft ? '숨기기' : '보이기'}</Button><Button tone="quiet" pressed={showWorkspaceRight} onClick={() => setShowWorkspaceRight((value) => !value)}>속성 {showWorkspaceRight ? '숨기기' : '보이기'}</Button></div>
  }
  async function uploadImage(file: File, role: SourceImage['role'], referenceRole?: Reference['role']) {
    if (busy) return
    const uploadProjectId = projectRef.current.id
    setBusy(true); setError(''); setNotice('')
    try {
      const validation = await validateImageFile(file, 'photo')
      if (!validation.valid) throw new Error(validation.message)
      const dimensions = await imageDimensions(file)
      const saved = await putImageAsset(file, 'photo')
      const current = projectRef.current
      if (current.id !== uploadProjectId) {
        await deleteImageAsset(saved.uri)
        throw new Error('업로드 중 프로젝트가 변경되어 이미지를 등록하지 않았습니다. 다시 선택해 주세요.')
      }
      const imageId = makeId('image')
      const referenceId = referenceRole ? makeId('reference') : undefined
      const image: SourceImage = { id: imageId, role, uri: saved.uri, name: file.name, referenceId, ...dimensions }
      const references = referenceId ? [...current.references, { id: referenceId, imageId, role: referenceRole!, note: '', extractedElements: [], exclusions: [] }] : current.references
      if (!commit(updateCommon(current, { sourceImages: [...current.sourceImages, image], references }), '이미지를 등록했습니다.')) {
        await deleteImageAsset(saved.uri)
        return
      }
      if (referenceId) { setReferenceFocus(referenceId); setReferenceRegionMode('whole'); setReferenceRegionDraft(null); setRegionEditingElementId(null) }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '이미지를 등록하지 못했습니다.') }
    finally { setBusy(false) }
  }
  async function uploadPlan(file: File) {
    if (busy) return
    const uploadProjectId = projectRef.current.id
    setBusy(true); setError(''); setNotice('')
    try {
      const validation = await validateImageFile(file, 'floor-plan')
      if (!validation.valid) throw new Error(validation.message)
      const dimensions = await imageDimensions(file)
      const saved = await putImageAsset(file, 'floor-plan')
      const current = projectRef.current
      if (current.id !== uploadProjectId) {
        await deleteImageAsset(saved.uri)
        throw new Error('업로드 중 프로젝트가 변경되어 평면도를 등록하지 않았습니다. 다시 선택해 주세요.')
      }
      const previous = current.floorPlan
      const next = { ...newPlan('uploaded', saved.uri), ...dimensions }
      if (previous) { next.structures = previous.structures; next.areas = previous.areas }
      if (!commit(updateCommon(current, { floorPlan: next, planAlignmentPending: true }), '평면도 이미지를 등록했습니다. 바닥·구조·배치의 대응을 확인하기 전에는 미리보기를 열 수 없습니다.')) {
        await deleteImageAsset(saved.uri)
        return
      }
      setAlignmentChecked(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '평면도를 등록하지 못했습니다.') }
    finally { setBusy(false) }
  }
  function addStructure(coordinates?: { start: { x: number, y: number }, end: { x: number, y: number }, wallId?: string }) {
    if (!project.floorPlan) { rejectPlanEdit('먼저 평면도를 등록하거나 개략 도면을 만드세요.'); return }
    const x = coordinates?.start.x ?? fraction(structureX), y = coordinates?.start.y ?? fraction(structureY)
    const endX = coordinates?.end.x ?? fraction(structureEndX), endY = coordinates?.end.y ?? fraction(structureEndY)
    if ([x,y,endX,endY].some((value) => !Number.isFinite(value) || value < 0 || value > 1)) { rejectPlanEdit('좌표는 0–100% 범위로 입력해 주세요.'); return }
    if (structureKind === 'pillar' && (x > .92 || y > .90)) { rejectPlanEdit('기둥의 전체 크기가 도면 안에 들어와야 합니다.'); return }
    if (structureKind === 'existing-light' && (x < .03 || x > .97 || y < .03 || y > .97)) { rejectPlanEdit('기존 조명의 표시가 도면 안에 들어와야 합니다.'); return }
    if (structureKind !== 'pillar' && structureKind !== 'existing-light' && x === endX && y === endY) { rejectPlanEdit('선의 시작점에서 끝점까지 누른 채 끌어 주세요.'); return }
    const name = structureName.trim() || `${STRUCTURE_LABELS[structureKind]} ${project.floorPlan.structures.filter((item) => item.kind === structureKind).length + 1}`
    const id = makeId('structure')
    const segment = { kind: 'segment' as const, start: { x, y }, end: { x: endX, y: endY } }
    const geometry = structureKind === 'pillar' ? { kind: 'rect' as const, bounds: { x, y, width: .08, height: .10 } } : structureKind === 'existing-light' ? { kind: 'circle' as const, center: { x, y }, radius: .025 } : segment
    const requiresWall = ['window','door','entrance'].includes(structureKind)
    const parentWallId = requiresWall ? coordinates?.wallId ?? drawingWall()?.id : undefined
    const wall = project.floorPlan.structures.find((item) => item.id === parentWallId)
    if (requiresWall && (!wall || wall.kind !== 'wall')) { rejectPlanEdit('창·문·출입구를 붙일 벽이 없습니다. 먼저 ‘기존 벽’으로 벽 선을 표시하세요.'); return }
    const wallSpan = requiresWall ? spanOnWall(wall, { x, y }, { x: endX, y: endY }) : undefined
    if (requiresWall && (!wallSpan || wallSpan.start === wallSpan.end)) { rejectPlanEdit(`‘${wall?.name ?? '연결 벽'}’ 선을 따라 시작점에서 끝점까지 끌어 주세요. 벽 이름이 도면 위에 표시됩니다.`); return }
    const immutable = structureKind !== 'wall' || structureRole === 'base'
    const structure: Structure = { id, kind: structureKind, name, geometry, role: structureKind === 'wall' ? structureRole : 'base', immutable, protected: immutable, parentWallId,
      wallSpan, lightTone: structureKind === 'existing-light' ? structureLightTone.trim() || '온백색' : undefined,
      clearance: (structureKind === 'door' || structureKind === 'entrance') && wall ? entranceClearance(project.floorPlan, wall, { x, y }, { x: endX, y: endY }) : undefined }
    const checked = validateStructureDrawing(project, structure)
    if (!checked.valid) { rejectPlanEdit(checked.issues.map((issue) => issue.message).join(' ')); return }
    const keep = immutable ? { id: makeId('keep'), structureId: id, intent: 'preserve' as const, description: `${name}의 위치와 형태 보존` } : undefined
    if (!commit(updateCommon(project, { floorPlan: { ...project.floorPlan, structures: [...project.floorPlan.structures, structure] }, keeps: keep ? [...project.keeps, keep] : project.keeps }), immutable ? '필수 보존 기본 구조를 추가했습니다.' : '수정 가능한 가벽을 추가했습니다.')) return
    setSelectedStructureId(id); setStructureName(''); setPlanEditError('')
  }
  function createSchematicPlan() {
    const plan = newPlan('schematic')
    const keeps = plan.structures.map((structure) => ({
      id: makeId('keep'), structureId: structure.id, intent: 'preserve' as const,
      description: `${structure.name}의 위치와 형태 보존`,
    }))
    commit(updateCommon(project, { floorPlan: plan, keeps }), '개략 도면을 만들었습니다. 기본 벽은 필수 보존입니다. 치수는 확인되지 않았습니다.')
  }
  function deleteStructure(structure: Structure) {
    if (!project.floorPlan) return
    const validation = validateStructureOperation(project, structure.id, 'remove')
    if (!validation.valid) { setError(validation.issues.map((issue) => issue.message).join(' ')); return }
    if (project.floorPlan.structures.some((item) => item.parentWallId === structure.id) || project.elements.some((element) => element.target?.kind === 'wall-segment' && element.target.wallId === structure.id)) {
      setError('연결된 개구부나 디자인 요소가 있습니다. 먼저 연결 위치를 변경하세요.'); return
    }
    if (commitDeletion(updateCommon(project, { floorPlan: { ...project.floorPlan, structures: project.floorPlan.structures.filter((item) => item.id !== structure.id) }, keeps: project.keeps.filter((keep) => keep.structureId !== structure.id) }), '구조를 삭제', { structureId: structure.id })) setSelectedStructureId('')
  }
  function moveOptionalStructure(id: string, delta: Point) {
    const structure = project.floorPlan?.structures.find((item) => item.id === id)
    if (!structure) return false
    const moved = moveStructure(project, id, delta)
    if (!moved.validation.valid) { rejectPlanEdit(moved.validation.issues.map((issue) => issue.message).join(' ')); return false }
    const saved = commit(moved.project, `${structure.name}의 도면 위치를 저장했습니다.`)
    if (saved) setPlanEditError('')
    return saved
  }
  function setStructureCoordinate(structure: Structure, axis: 'x' | 'y', input: HTMLInputElement) {
    const position = structurePosition(structure)
    const value = fraction(input.value)
    if (!input.value.trim() || !Number.isFinite(value) || value < 0 || value > 1) {
      input.value = String(pct(position[axis]))
      rejectPlanEdit('위치는 0–100% 사이의 숫자로 입력해 주세요.')
      return
    }
    if (value !== position[axis] && !moveOptionalStructure(structure.id, axis === 'x' ? { x: value - position.x, y: 0 } : { x: 0, y: value - position.y })) input.value = String(pct(position[axis]))
  }
  function addArea(bounds?: { x: number, y: number, width: number, height: number }) {
    if (!project.floorPlan) { rejectPlanEdit('먼저 평면도를 준비해 주세요.'); return }
    const x = bounds?.x ?? fraction(areaX), y = bounds?.y ?? fraction(areaY)
    const width = bounds?.width ?? fraction(areaWidth), height = bounds?.height ?? fraction(areaHeight)
    if ([x,y,width,height].some((value) => !Number.isFinite(value)) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
      rejectPlanEdit('영역의 위치와 크기가 도면의 0–100% 범위 안에 들어야 합니다.'); return
    }
    const area: Area = { id: makeId('area'), name: areaName.trim() || `새 ${areaKind === 'spatial' ? '공간' : areaKind === 'passage' ? '동선' : areaKind === 'floor' ? '바닥' : '천장'} 영역`, kind: areaKind, bounds: { x, y, width, height } }
    const checked = validateAreaDrawing(project, area)
    if (!checked.valid) { rejectPlanEdit(checked.issues.map((issue) => issue.message).join(' ')); return }
    if (!commit(updateCommon(project, { floorPlan: { ...project.floorPlan, areas: [...project.floorPlan.areas, area] } }), '평면도 영역을 추가했습니다.')) return
    setAreaName(''); setPlanEditError('')
  }
  function drawStructure(start: { x: number, y: number }, end: { x: number, y: number }, wallId?: string) {
    if (structureKind === 'pillar') {
      addStructure({ start: { x: start.x - .04, y: start.y - .05 }, end: start })
      return
    }
    if (structureKind === 'existing-light') {
      addStructure({ start, end: start })
      return
    }
    if (Math.hypot((end.x - start.x) * (project.floorPlan?.width ?? 1), (end.y - start.y) * (project.floorPlan?.height ?? 1)) < 16) {
      rejectPlanEdit('선이 너무 짧습니다. 시작점에서 조금 더 길게 끌어 주세요.')
      return
    }
    addStructure({ start, end, wallId })
  }
  function drawArea(start: { x: number, y: number }, end: { x: number, y: number }) {
    const bounds = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(start.x - end.x), height: Math.abs(start.y - end.y) }
    if (bounds.width < .02 || bounds.height < .02) { rejectPlanEdit('범위의 한쪽 모서리에서 대각선 모서리까지 조금 더 크게 끌어 주세요.'); return }
    addArea(bounds)
  }
  function toggleKeep(structure: Structure) {
    const enabled = !isStructureLocked(project, structure)
    if (commit(setStructurePreservation(project, structure.id, enabled), enabled ? `${structure.name}의 필수 보존을 켰습니다. 위치가 고정됩니다.` : `${structure.name}의 필수 보존을 껐습니다. 도면에서 위치를 수정할 수 있습니다.`)) setPlanEditError('')
  }

  function renderStructureInspector() {
    const structure = selectedStructure
    if (!structure) return <Empty>도면이나 목록에서 구조를 선택하세요.</Empty>
    const keep = project.keeps.find((item) => item.structureId === structure.id)
    const locked = isStructureLocked(project, structure)
    const movementReason = structureMovementReason(project, structure)
    const children = project.floorPlan?.structures.filter((item) => item.parentWallId === structure.id) ?? []
    const position = structurePosition(structure)
    const wall = project.floorPlan?.structures.find((item) => item.id === structure.parentWallId)
    const opening = wall?.geometry.kind === 'segment' && structure.wallSpan
    return <div className="inspector-block">
      <h3>{structure.name}</h3><p className="muted">{STRUCTURE_LABELS[structure.kind]} · {structure.role === 'partition' ? '추가 가벽' : '기존 구조 표시'}</p>
      <label className="field"><span>구조 이름</span><input defaultValue={structure.name} key={`${structure.id}-label`} onBlur={(event) => {
        if (!project.floorPlan) return
        const name = event.target.value.trim()
        if (!name) { event.target.value = structure.name; setError('구조 이름을 입력해 주세요.'); return }
        commit(updateCommon(project, { floorPlan: { ...project.floorPlan, structures: project.floorPlan.structures.map((item) => item.id === structure.id ? { ...item, name } : item) } }))
      }} /></label>
      <button type="button" className="preservation-switch" role="switch" aria-checked={locked} aria-label={`${structure.name} 필수 보존 (위치 고정)`} onClick={() => toggleKeep(structure)}>
        <span><strong>필수 보존 (위치 고정)</strong><small>{locked ? '켬 · 이동·삭제 잠금' : '끔 · 도면 위치 수정 가능'}</small></span><span className="preservation-switch__track" aria-hidden="true"><span /></span>
      </button>
      <p className="muted small">{movementReason ?? '구조나 ‘이동 가능’ 이름표를 끌어 위치를 바꾸세요. 방향키는 1%, Shift와 방향키는 5%씩 이동합니다.'}</p>
      <p className="muted small">보존을 끄면 도면 표시와 생성 조건을 수정합니다. 실제 구조 변경 가능 여부는 별도로 확인하세요.</p>
      {children.length > 0 && <div className="structure-connections"><strong>연결된 구조</strong>{children.map((child) => <Button key={child.id} tone="quiet" onClick={() => setSelectedStructureId(child.id)}>{child.name} · {isStructureLocked(project, child) ? '고정' : '이동 가능'}</Button>)}</div>}
      {!locked && <>
        {opening && wall.geometry.kind === 'segment' ? <label className="field"><span>{wall.name}을 따라 이동 · 시작 {pct(opening.start)}%</span><input type="range" min="0" max={Math.round((1 - (opening.end - opening.start)) * 100)} step="1" value={pct(opening.start)} disabled={!!movementReason} onChange={(event) => {
          const offset = Number(event.target.value) / 100 - opening.start
          if (wall.geometry.kind !== 'segment') return
          moveOptionalStructure(structure.id, { x: (wall.geometry.end.x - wall.geometry.start.x) * offset, y: (wall.geometry.end.y - wall.geometry.start.y) * offset })
        }} /></label> : <div className="field-row"><label className="field"><span>{structure.geometry.kind === 'segment' ? '시작' : structure.geometry.kind === 'rect' ? '왼쪽 위' : '중심'} X (%)</span><input type="number" min="0" max="100" step="1" disabled={!!movementReason} defaultValue={pct(position.x)} key={`${structure.id}-x-${position.x}`} onBlur={(event) => setStructureCoordinate(structure, 'x', event.target)} /></label><label className="field"><span>Y (%)</span><input type="number" min="0" max="100" step="1" disabled={!!movementReason} defaultValue={pct(position.y)} key={`${structure.id}-y-${position.y}`} onBlur={(event) => setStructureCoordinate(structure, 'y', event.target)} /></label></div>}
        <div className="keep-actions"><Button icon="edit" onClick={() => editStructurePosition(structure.id)}>공간 배치에서 편집</Button><Button tone="danger" icon="trash" onClick={() => deleteStructure(structure)}>구조 삭제</Button></div>
      </>}
      {structure.kind === 'existing-light' && <label className="field"><span>기존 조명 색감</span><input defaultValue={structure.lightTone ?? '온백색'} key={`${structure.id}-tone`} onBlur={(event) => {
        if (!project.floorPlan) return
        const lightTone = event.target.value.trim() || '온백색'
        commit(updateCommon(project, { floorPlan: { ...project.floorPlan, structures: project.floorPlan.structures.map((item) => item.id === structure.id ? { ...item, lightTone } : item) } }), '기존 조명 색감을 저장했습니다.')
      }} /><small>{locked ? '보존 중에는 색감만 변경할 수 있습니다.' : '위치와 색감을 수정할 수 있습니다.'}</small></label>}
      {keep && <><label className="field"><span>보존 설명</span><textarea rows={3} defaultValue={keep.description} key={keep.id} onBlur={(event) => commit(updateKeep(project, keep.id, { description: event.target.value }))} /></label>{structure.kind === 'wall' && <label className="checkbox-row"><input type="checkbox" checked={!!keep.allowedSurfaceTreatment} onChange={(event) => commit(updateKeep(project, keep.id, { allowedSurfaceTreatment: event.target.checked }))} /><span>탈착식 표면 연출 허용</span></label>}</>}
    </div>
  }

  function renderProjects() {
    const sampleSaved = projects.find((item) => item.id === 'aura-popup')
    const others = projects.filter((item) => item.id !== 'aura-popup')
    return <>
      <div className="intro-row"><div><p className="eyebrow">공간 콘셉트 디자인</p><h1>프로젝트를 시작하세요</h1><p className="lede">기존 공간, 레퍼런스, 배치 조건을 하나의 설계 흐름에서 관리합니다.</p></div><Badge tone="info">오프라인 데모 사용 가능</Badge></div>
      <div className="project-layout">
        <section className="project-list" aria-labelledby="project-list-title">
          <div className="section-heading"><h2 id="project-list-title">내 프로젝트</h2><span className="meta">이 브라우저에 저장</span></div>
          <button className="project-card sample-card" onClick={() => open(sampleSaved ?? createSampleProject())}>
            <AssetImage uri="/sample/result.png" alt="AURA POP-UP 사전 준비된 데모 결과" />
            <span className="project-card-body"><span className="project-card-top"><strong>AURA POP-UP</strong><Badge tone="info">샘플</Badge></span><span>기존 벽·창·기둥을 보존하는 코스메틱 팝업</span><span className="meta">공간 자료부터 결과 검토까지 살펴보기</span></span>
          </button>
          {others.map((item) => <button key={item.id} className="project-card project-card-plain" onClick={() => open(item)}><span className="project-monogram" aria-hidden="true">{item.name.slice(0, 1)}</span><span className="project-card-body"><strong>{item.name}</strong><span>{item.spaceType || '공간 유형 미입력'}</span><span className="meta">{item.results.length}개 결과 · {item.elements.length}개 요소</span></span></button>)}
          {others.length === 0 && <p className="list-footnote">새 프로젝트는 이 기기의 브라우저에 보관됩니다.</p>}
        </section>
        <section className="new-project" aria-labelledby="new-project-title">
          <p className="eyebrow">새 작업</p><h2 id="new-project-title">새 프로젝트 만들기</h2><p className="muted">이름과 방향만 입력하면 시작할 수 있습니다.</p>
          <label className="field"><span>프로젝트 이름 <span className="required">필수</span></span><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="예: 여름 쇼룸 리뉴얼" /></label>
          <label className="field"><span>공간 유형</span><input value={newType} onChange={(event) => setNewType(event.target.value)} placeholder="예: 팝업 스토어" /></label>
          <label className="field"><span>콘셉트 메모</span><textarea rows={3} value={newConcept} onChange={(event) => setNewConcept(event.target.value)} placeholder="보존할 공간과 원하는 분위기를 간단히 적으세요." /></label>
          <Button tone="primary" icon="add" onClick={createProject}>프로젝트 만들기</Button>
        </section>
      </div>
    </>
  }

  function renderSpace() {
    const existing = project.sourceImages.filter((image) => image.role === 'existing-space')
    const movablePartitions = project.floorPlan?.structures.filter((item) => !structureMovementReason(project, item)) ?? []
    const requiresDrawingWall = planDetailTab === 'structure' && ['window', 'door', 'entrance'].includes(structureKind)
    const hostWall = requiresDrawingWall ? drawingWall() : undefined
    const structureTools: { kind: Structure['kind'], role: 'base' | 'partition', label: string }[] = [
      { kind: 'wall', role: 'partition', label: '추가 가벽' },
      { kind: 'pillar', role: 'base', label: '기존 기둥' },
      { kind: 'wall', role: 'base', label: '기존 벽' },
      { kind: 'window', role: 'base', label: '창' },
      { kind: 'door', role: 'base', label: '문' },
      { kind: 'entrance', role: 'base', label: '출입구' },
      { kind: 'existing-light', role: 'base', label: '기존 천장 조명' },
    ]
    const currentStructureLabel = structureTools.find((tool) => tool.kind === structureKind && tool.role === structureRole)?.label ?? STRUCTURE_LABELS[structureKind]
    const areaTools: { kind: Area['kind'], label: string, description: string }[] = [
      { kind: 'floor', label: '사용 바닥', description: '가구를 놓을 수 있는 범위' },
      { kind: 'spatial', label: '분위기 영역', description: '특정 연출을 적용할 범위' },
      { kind: 'ceiling', label: '천장 영역', description: '천장 조명·행잉을 적용할 범위' },
      { kind: 'passage', label: '통행 동선', description: '가구 없이 비워 둘 통로' },
    ]
    const currentAreaTool = areaTools.find((tool) => tool.kind === areaKind)!
    const planOrigin = project.floorPlan?.kind === 'uploaded' ? '사용자 업로드 도면' : project.id === 'aura-popup' ? '사전 준비된 샘플 개략 도면' : '직접 작성하는 개략 도면'
    const planExplanation = project.floorPlan?.kind === 'uploaded'
      ? '업로드한 이미지를 2D 배치 바탕으로 사용합니다. 벽·사용 바닥·동선은 직접 표시해야 하며 사진이나 도면에서 자동으로 추출하지 않습니다.'
      : project.id === 'aura-popup'
        ? 'AURA POP-UP 예시를 위해 미리 등록한 개략 배치입니다. 왼쪽 사진을 분석해 만든 도면이나 실측 결과가 아닙니다.'
        : '기본 사각형 윤곽에서 시작해 구조와 사용 바닥을 직접 표시하는 배치 캔버스입니다. 사진 분석이나 실측 결과가 아닙니다.'
    return <div className="space-screen">
      {project.planAlignmentPending && <section className="plan-alignment-alert" aria-labelledby="plan-alignment-title"><div><p className="eyebrow">도면 대응 확인 필요</p><h3 id="plan-alignment-title">새 평면도의 사용 바닥과 배치를 확인하세요</h3><p>업로드한 이미지에서 사용 가능한 바닥 영역을 표시하고 구조·Keep·요소·카메라 좌표가 실제 도면과 맞는지 확인해야 미리보기를 열 수 있습니다. 이전 도면의 표시가 있다면 좌표는 임시로 유지됩니다.</p>{!project.floorPlan?.areas.some((area) => area.kind === 'floor') && <p className="plan-alignment-alert__required">아래 ‘영역·동선 그리기’에서 ‘사용 바닥’을 먼저 표시하세요.</p>}</div><div className="plan-alignment-alert__actions"><label className="checkbox-row"><input type="checkbox" checked={alignmentChecked} onChange={(event) => setAlignmentChecked(event.target.checked)} /><span>새 도면의 바닥·구조·배치·시점을 확인했습니다</span></label><Button tone="primary" disabled={!alignmentChecked || !project.floorPlan?.areas.some((area) => area.kind === 'floor')} onClick={() => { commit(updateCommon(project, { planAlignmentPending: false }), '평면도 대응 확인을 저장했습니다.'); setAlignmentChecked(false) }}>도면 대응 확인 완료</Button></div></section>}
      <div className={`space-two-col ${planDetailTab !== 'plan' ? 'is-editing-plan' : ''}`}>
        <section className="surface-panel" aria-labelledby="existing-title"><div className="panel-heading"><div><p className="eyebrow">01 · 실제 공간</p><h2 id="existing-title">기존 공간 사진</h2></div><FilePick label={busy ? "등록 중…" : "사진 추가"} disabled={busy} onFile={(file) => uploadImage(file, 'existing-space')} /></div>
          {existing.length ? <div className="photo-carousel-wrap"><SwipeCarousel label="기존 공간 사진" variant="photo" items={existing.map((image) => ({ id: image.id, content: <figure><AssetImage uri={image.uri} alt={`${image.name} · 기존 공간 사진`} className="space-photo" /><figcaption>{image.name}<span>현장 외관 참고 · 치수 근거 아님</span></figcaption></figure> }))} /></div> : <Empty>실제 공간 사진을 추가하세요. 분위기 레퍼런스를 대신 사용할 수 없습니다.</Empty>}
        </section>
        <section className={`surface-panel space-plan-panel ${planDetailTab !== 'plan' ? 'is-drawing' : ''}`} aria-labelledby="plan-title"><div className="panel-heading"><div><p className="eyebrow">02 · 배치 기준</p><h2 id="plan-title">평면도</h2></div><FilePick label={busy ? "등록 중…" : "도면 업로드"} disabled={busy} onFile={uploadPlan} /></div>
          {project.floorPlan ? <div className="plan-panel-content">
            <div className="plan-origin" role="note">
              <details><summary><Badge tone="info">{planOrigin}</Badge> 도면 출처·사용 방법</summary><p><strong>도면은 Keep·요소 배치·시점의 2D 기준입니다.</strong></p><p>{planExplanation}</p><p>사진은 공간의 모습 참고용이며 도면 좌표와 별도로 보관됩니다.</p></details>
            </div>
            <div className="plan-detail-tabs" role="group" aria-label="평면도 작업 도구">
              <button type="button" aria-pressed={planDetailTab === 'plan'} onClick={() => { setPlanDetailTab('plan'); setPlanEditError('') }}>확인·가벽 이동</button>
              <button type="button" aria-pressed={planDetailTab === 'structure'} onClick={() => chooseStructureTool(structureKind, structureRole)}>구조 그리기</button>
              <button type="button" aria-pressed={planDetailTab === 'area'} onClick={() => { setPlanDetailTab('area'); setPlanEditError('') }}>영역·동선 그리기</button>
            </div>
            {planDetailTab !== 'plan' && <div className="plan-editor-focus-heading"><span>사진을 접고 도면을 넓혀 표시했습니다. 구조와 범위를 도면 위에 직접 그립니다.</span><Button tone="quiet" onClick={() => { setPlanDetailTab('plan'); setPlanEditError('') }}>사진·도면 함께 보기</Button></div>}
            <div className={`plan-editor-body ${planDetailTab !== 'plan' ? 'is-drawing' : ''}`}>
            {planDetailTab === 'structure' && <div className="plan-edit-tools" aria-label="구조 그리기 도구">
              <h3>1. 표시할 구조 선택</h3>
              <div className="plan-tool-grid" role="group" aria-label="표시할 구조">{structureTools.map((tool) => <button key={`${tool.kind}-${tool.role}`} type="button" aria-pressed={structureKind === tool.kind && structureRole === tool.role} onClick={() => chooseStructureTool(tool.kind, tool.role)}>{tool.label}</button>)}</div>
              {requiresDrawingWall && <div className="plan-wall-choice"><label className="field"><span>붙일 벽 · 도면에서 이름으로 확인</span><select value={hostWall?.id ?? ''} onChange={(event) => selectDrawingWall(event.target.value)}>{!hostWall && <option value="">먼저 기존 벽을 표시하세요</option>}{project.floorPlan.structures.filter((item) => item.kind === 'wall' && item.geometry.kind === 'segment').map((wall) => <option key={wall.id} value={wall.id}>{wall.name}</option>)}</select></label>{hostWall && <p><strong>‘{hostWall.name}’이 강조되어 있습니다.</strong> 도면에서 다른 벽을 누르면 붙일 벽을 바꿀 수 있습니다.</p>}</div>}
              <div className="plan-gesture-cue"><strong>2. {currentStructureLabel} {structureKind === 'pillar' || structureKind === 'existing-light' ? '위치를 한 번 누르세요' : '시작점 → 끝점으로 끌어 주세요'}</strong><p>{requiresDrawingWall ? hostWall ? '이름이 표시된 벽 선 가까이에서 누른 채 끌면, 표시가 그 벽에 맞춰 붙습니다.' : '붙일 벽이 있어야 창·문·출입구를 그릴 수 있습니다.' : structureKind === 'wall' && structureRole === 'partition' ? '공간 안에 선을 그립니다. 저장 후에는 ‘확인·가벽 이동’에서 선을 끌어 옮길 수 있습니다.' : '실제 공간에 있는 구조를 표시합니다. 저장하면 필수 보존되어 위치가 고정됩니다.'}</p></div>
              <details className="plan-tool-options"><summary>이름{structureKind === 'existing-light' ? '·조명 색감' : ''} 설정 (선택)</summary><div className="plan-edit-tools__fields"><label className="field"><span>이름</span><input value={structureName} onChange={(event) => setStructureName(event.target.value)} placeholder="비우면 자동 이름" /></label>{structureKind === 'existing-light' && <label className="field"><span>조명 색감</span><input value={structureLightTone} onChange={(event) => setStructureLightTone(event.target.value)} placeholder="예: 온백색" /></label>}</div></details>
            </div>}
            {planDetailTab === 'area' && <div className="plan-edit-tools" aria-label="영역과 동선 그리기 도구">
              <h3>1. 표시할 범위 선택</h3>
              <div className="plan-tool-grid plan-tool-grid--areas" role="group" aria-label="표시할 범위">{areaTools.map((tool) => <button key={tool.kind} type="button" aria-pressed={areaKind === tool.kind} onClick={() => { setAreaKind(tool.kind); setPlanEditError('') }}><span>{tool.label}</span><small>{tool.description}</small></button>)}</div>
              <div className="plan-gesture-cue"><strong>2. {currentAreaTool.label}의 한쪽 모서리 → 대각선 모서리로 끌어 주세요</strong><p>사각형 범위를 표시합니다. 영역은 물건이 아니므로 사용 바닥·천장·분위기 범위는 같은 위치에 겹칠 수 있습니다. 같은 종류의 범위를 같은 위치·크기로 중복 표시하거나 가구·기둥·가벽을 가로질러 동선을 그릴 수는 없습니다.</p></div>
              <details className="plan-tool-options"><summary>영역 이름 설정 (선택)</summary><label className="field"><span>이름</span><input value={areaName} onChange={(event) => setAreaName(event.target.value)} placeholder="비우면 자동 이름" /></label></details>
            </div>}
            <PlanCanvas key={`${project.id}-${planDetailTab}-${structureKind}-${structureRole}-${areaKind}`} project={project} onDragEvent={recordCanvasDrag} mode="view" selectedStructureId={selectedStructureId} onStructureSelect={setSelectedStructureId} onStructureMove={moveOptionalStructure}
              drawTool={planDetailTab === 'structure' ? (structureKind === 'pillar' || structureKind === 'existing-light' ? 'point' : 'segment') : planDetailTab === 'area' ? 'rect' : undefined}
              drawWallId={hostWall?.id} onDrawWallSelect={requiresDrawingWall ? selectDrawingWall : undefined}
              validationMessage={planEditError}
              onDraw={planDetailTab === 'structure' ? drawStructure : planDetailTab === 'area' ? drawArea : undefined} />
            {planDetailTab !== 'plan' && <div className="plan-drawing-exit"><span>그린 항목은 자동 저장됩니다. 마칠 때 직접 돌아가세요.</span><Button tone="quiet" onClick={() => { setPlanDetailTab('plan'); setPlanEditError('') }}>그리기 마치기</Button></div>}
            {planDetailTab === 'plan' && <div className="plan-task-hint">
              <div className="plan-task-hint__heading"><strong>{selectedStructure ? `선택: ${selectedStructure.name}` : '선택·이동 모드'}</strong><Button icon="add" onClick={() => chooseStructureTool('wall', 'partition')}>가벽 추가</Button></div>
              <p>{selectedStructure && structureMovementReason(project, selectedStructure) ? structureMovementReason(project, selectedStructure) : movablePartitions.length ? '‘이동 가능’ 이름표나 구조를 잡고 끌어 주세요.' : '이동 가능한 구조가 없습니다. 유지할 요소에서 필수 보존을 끄면 위치를 수정할 수 있습니다.'}</p>
            </div>}
            {planDetailTab === 'plan' && movablePartitions.length > 0 && <div className="plan-partitions" aria-label="이동 가능한 구조 목록"><h3>이동 가능한 구조</h3>{movablePartitions.map((partition) => <div key={partition.id} className="plan-partition-row"><button type="button" aria-pressed={selectedStructureId === partition.id} onClick={() => setSelectedStructureId(partition.id)}>{partition.name}<span>도면에서 선택</span></button><Button tone="danger" onClick={() => deleteStructure(partition)}>제거</Button></div>)}</div>}
            {planDetailTab === 'structure' && <details className="plan-numeric-fallback"><summary>좌표로 구조 표시 (키보드 대체)</summary><p>도면 왼쪽 위가 0%, 오른쪽 아래가 100%입니다.{hostWall && ` ‘${hostWall.name}’의 한 구간을 미리 입력했습니다. 시작과 끝을 같은 벽 위에 유지하세요.`}</p><div className="structure-form">
              <label className="field compact-field"><span>시작 X (%)</span><input type="number" min="0" max="100" value={structureX} onChange={(event) => setStructureX(event.target.value)} /></label>
              <label className="field compact-field"><span>시작 Y (%)</span><input type="number" min="0" max="100" value={structureY} onChange={(event) => setStructureY(event.target.value)} /></label>
              {!['pillar','existing-light'].includes(structureKind) && <><label className="field compact-field"><span>끝 X (%)</span><input type="number" min="0" max="100" value={structureEndX} onChange={(event) => setStructureEndX(event.target.value)} /></label><label className="field compact-field"><span>끝 Y (%)</span><input type="number" min="0" max="100" value={structureEndY} onChange={(event) => setStructureEndY(event.target.value)} /></label></>}
              <Button icon="add" onClick={() => addStructure()}>입력한 구조 추가</Button>
            </div></details>}
            {planDetailTab === 'area' && <details className="plan-numeric-fallback"><summary>좌표로 영역 표시 (키보드 대체)</summary><p>왼쪽 위 모서리의 위치와 사각형의 폭·깊이를 도면 전체에 대한 비율로 입력합니다.</p><div className="structure-form">
              <label className="field compact-field"><span>X (%)</span><input type="number" min="0" max="100" value={areaX} onChange={(event) => setAreaX(event.target.value)} /></label><label className="field compact-field"><span>Y (%)</span><input type="number" min="0" max="100" value={areaY} onChange={(event) => setAreaY(event.target.value)} /></label>
              <label className="field compact-field"><span>폭 (%)</span><input type="number" min="1" max="100" value={areaWidth} onChange={(event) => setAreaWidth(event.target.value)} /></label><label className="field compact-field"><span>깊이 (%)</span><input type="number" min="1" max="100" value={areaHeight} onChange={(event) => setAreaHeight(event.target.value)} /></label>
              <Button icon="add" onClick={() => addArea()}>입력한 영역 추가</Button>
            </div></details>}
            </div>
          </div> : <div className="plan-empty"><p>평면도가 아직 없습니다.</p><p className="muted">도면 이미지가 없다면 치수를 주장하지 않는 개략 도면으로 시작할 수 있습니다.</p><Button icon="layers" onClick={createSchematicPlan}>개략 도면 만들기</Button></div>}
        </section>
      </div>
      <details className="space-project-details"><summary>프로젝트 기본 정보</summary><section className="details-strip"><div><h3>프로젝트 기본 정보</h3><p className="muted">변경한 항목만 저장되며 기존 결과는 이전 조건으로 보관됩니다.</p></div><div className="details-fields"><label className="field"><span>이름</span><input defaultValue={project.name} key={`${project.id}-name`} onBlur={(event) => commit(updateCommon(project, { name: event.target.value.trim() || project.name }))} /></label><label className="field"><span>공간 유형</span><input defaultValue={project.spaceType} key={`${project.id}-type`} onBlur={(event) => commit(updateCommon(project, { spaceType: event.target.value }))} /></label><label className="field field-wide"><span>콘셉트</span><input defaultValue={project.concept} key={`${project.id}-concept`} onBlur={(event) => commit(updateCommon(project, { concept: event.target.value }))} /></label></div></section></details>

    </div>
  }

  function renderKeep() {
    const structures = project.floorPlan?.structures.filter((item) => ['wall','window','pillar','door','entrance','existing-light'].includes(item.kind)) ?? []
    const firstPhoto = project.sourceImages.find((image) => image.role === 'existing-space')
    return <div className="keep-layout">
      <section className="surface-panel"><div className="panel-heading"><div><p className="eyebrow">도면에서 선택</p><h2>유지할 구조</h2></div><Badge tone="keep">필수 보존 {project.keeps.length}개</Badge></div><PlanCanvas project={project} onDragEvent={recordCanvasDrag} mode="keep" selectedStructureId={selectedStructureId} onStructureSelect={setSelectedStructureId} onStructureMove={moveOptionalStructure} /></section>
      <aside className="side-panel"><div className="panel-heading"><div><p className="eyebrow">선택한 요소</p><h2>{selectedStructure?.name ?? '구조를 선택하세요'}</h2></div></div>
        {firstPhoto ? <PhotoKeepOverlay compact imageUri={firstPhoto.uri} structures={project.floorPlan?.structures ?? []} keeps={project.keeps} selectedStructureId={selectedStructureId} onSelect={setSelectedStructureId} onSetAnchor={(id, point) => { commit(updatePhotoAnchor(project, id, point), '사진 라벨 위치를 저장했습니다. 도면 구조는 변경되지 않았습니다.') }} /> : <Empty>기존 공간 사진을 먼저 등록하세요.</Empty>}
        {renderStructureInspector()}
        <details className="keep-structure-picker"><summary>다른 구조 선택 · {structures.length}개</summary>{structures.length ? <div className="structure-list">{structures.map((structure) => { const isKept = isStructureLocked(project, structure); return <button key={structure.id} className={`list-row ${selectedStructureId === structure.id ? 'is-selected' : ''}`} aria-pressed={selectedStructureId === structure.id} onClick={() => setSelectedStructureId(structure.id)}><span><strong>{structure.name}</strong><small>{STRUCTURE_LABELS[structure.kind]}</small></span>{isKept && <NucleoIcon name="lock" />}</button> })}</div> : <Empty>평면도에 구조를 먼저 표시하세요.</Empty>}</details>
      </aside>
    </div>
  }

  function renderReferences() {
    const focused = project.references.find((item) => item.id === referenceFocus) ?? project.references[0]
    const focusedImage = project.sourceImages.find((image) => image.id === focused?.imageId)
    const regionEditingElement = project.elements.find((element) => element.id === regionEditingElementId)
    const sourceGroups = [
      { label: '분위기·공간 참고', role: 'ambience' as const, sourceRole: 'inspiration' as const },
      { label: '요소·그래픽 참고', role: 'element' as const, sourceRole: 'inspiration' as const },
      { label: '제품 사진', role: 'product' as const, sourceRole: 'product' as const },
    ]
    function chooseReference(id: string) {
      experiment.record('reference_select', 'reference', id, { role: project.references.find((item) => item.id === id)?.role ?? '' })
      setReferenceFocus(id)
      setPendingReferenceDelete(null)
      setReferenceRegionMode('whole')
      setReferenceRegionDraft(null)
      setRegionEditingElementId(null)
    }
    function editSourceRegion(element: DesignElement) {
      setSelectedElementId(element.id)
      setReferenceFocus(element.sourceReferenceId)
      setReferenceRegionMode(element.sourceRegion ? 'region' : 'whole')
      setReferenceRegionDraft(element.sourceRegion ?? null)
      setRegionEditingElementId(element.id)
    }
    function saveSourceRegion() {
      if (!regionEditingElement) return
      if (referenceRegionMode === 'region' && (!referenceRegionDraft || !validReferenceRegion(referenceRegionDraft))) {
        setError('이미지에서 참조할 영역을 먼저 드래그해 주세요.')
        return
      }
      if (!commit(updateElement(project, regionEditingElement.id, { sourceRegion: referenceRegionMode === 'region' ? referenceRegionDraft! : undefined }), '요소의 이미지 참조 범위를 저장했습니다.')) return
      setRegionEditingElementId(null)
    }
    function addElement() {
      if (regionEditingElementId) { setError('기존 요소의 참조 범위 편집을 저장하거나 취소해 주세요.'); return }
      if (!elementLabel.trim()) { setError('요소 이름을 입력해 주세요.'); return }
      const referenceId = focused?.id
      if (!referenceId || !project.references.some((item) => item.id === referenceId)) { setError('현재 프로젝트의 레퍼런스를 먼저 선택해 주세요.'); return }
      if (referenceRegionMode === 'region' && (!referenceRegionDraft || !validReferenceRegion(referenceRegionDraft))) {
        setError('이미지에서 참조할 영역을 먼저 드래그하거나 전체 이미지를 선택해 주세요.'); return
      }
      const id = makeId('element')
      const element: DesignElement = { id, sourceReferenceId: referenceId, sourceRegion: referenceRegionMode === 'region' ? referenceRegionDraft! : undefined, label: elementLabel.trim(), kind: elementKind, status: 'apply', target: null, conditions: '' }
      const references = project.references.map((item) => item.id === referenceId ? { ...item, extractedElements: [...item.extractedElements, id] } : item)
      if (!commit(updateCommon(project, { references, elements: [...project.elements, element] }), '요소를 추가했습니다. 배치 단계에서 위치를 지정하세요.')) return
      setSelectedElementId(id); setElementLabel('')
    }
    return <div className="reference-layout">
      <aside className="library-panel"><div className="panel-heading"><div><p className="eyebrow">참고 이미지</p><h2>참고 이미지</h2></div></div>
        {sourceGroups.map((group) => <div key={group.role} className="library-group"><div className="group-heading"><h3>{group.label}</h3><FilePick label={busy ? "등록 중…" : "추가"} disabled={busy} onFile={(file) => uploadImage(file, group.sourceRole, group.role)} /></div>
          {project.references.filter((item) => item.role === group.role).length === 0 && <p className="muted small">등록된 이미지가 없습니다.</p>}
          {project.references.filter((item) => item.role === group.role).map((reference) => { const image = project.sourceImages.find((entry) => entry.id === reference.imageId); return <button key={reference.id} className={`reference-thumb ${focused?.id === reference.id ? 'is-selected' : ''}`} aria-pressed={focused?.id === reference.id} onClick={() => chooseReference(reference.id)}><span className="thumb-image">{image && <AssetImage uri={image.uri} alt={`${image.name} 미리보기`} />}</span><span><strong>{image?.name ?? '이미지 없음'}</strong><small>{group.role === 'product' ? '제품' : group.role === 'ambience' ? '분위기' : '요소'}</small></span></button> })}
        </div>)}
      </aside>
      <section className="reference-preview"><div className="panel-heading"><div><p className="eyebrow">선택한 레퍼런스</p><h2>{focusedImage?.name ?? '이미지를 선택하세요'}</h2></div>{focused && <div className="reference-header-actions"><Badge tone="info">{focused.role === 'ambience' ? '분위기' : focused.role === 'product' ? '제품' : '요소'}</Badge><Button tone="danger-quiet" icon="trash" disabled={busy} onClick={() => setPendingReferenceDelete(focused.id)}>이미지 삭제</Button></div>}</div>
        {focused && pendingReferenceDelete === focused.id && <section ref={referenceDeleteConfirmRef} className="reference-delete-confirm" aria-label="레퍼런스 삭제 확인" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setPendingReferenceDelete(null) } }}><h3>이 레퍼런스를 삭제할까요?</h3><p>{focusedImage?.name}</p><p>이미지와 연결된 디자인 요소 {project.elements.filter((element) => element.sourceReferenceId === focused.id).length}개가 현재 작업에서 삭제됩니다. 기존 결과와 당시 조건은 보관됩니다.</p><div className="keep-actions"><Button tone="danger" icon="trash" disabled={busy} onClick={() => deleteReferenceImage(focused.id)}>이미지와 연결 요소 삭제</Button><button className="button button-secondary" data-action="cancel" type="button" onClick={() => { setPendingReferenceDelete(null); document.querySelector<HTMLButtonElement>('.reference-header-actions button')?.focus({ preventScroll: true }) }}>취소</button></div></section>}
        {focusedImage ? <>
          <div className="reference-scope-control" role="group" aria-label="요소의 이미지 참조 범위">
            <span>{regionEditingElement ? `${regionEditingElement.label}의 참조 범위 수정` : '새 요소의 참조 범위'}</span>
            <div className="reference-scope-control__choices">
              <button type="button" aria-pressed={referenceRegionMode === 'whole'} onClick={() => { setReferenceRegionMode('whole'); setReferenceRegionDraft(null) }}>이미지 전체</button>
              <button type="button" aria-pressed={referenceRegionMode === 'region'} onClick={() => setReferenceRegionMode('region')}>영역 지정</button>
            </div>
          </div>
          <ReferenceRegionPicker key={focusedImage.id} uri={focusedImage.uri} name={focusedImage.name} imageWidth={focusedImage.width} imageHeight={focusedImage.height} enabled={referenceRegionMode === 'region'} selection={referenceRegionDraft} onChange={setReferenceRegionDraft} />
          <div className="reference-scope-status"><strong>현재 선택</strong><span>{referenceRegionMode === 'whole' ? '이미지 전체' : referenceRegionDraft ? '이미지 일부 · 선택 영역 표시됨' : '영역을 아직 선택하지 않았습니다'}</span>
            {referenceRegionMode === 'region' && referenceRegionDraft && <Button tone="quiet" onClick={() => setReferenceRegionDraft(null)}>영역 다시 선택</Button>}
            {regionEditingElement && <div className="reference-scope-status__actions"><Button tone="primary" onClick={saveSourceRegion}>참조 범위 저장</Button><Button onClick={() => { setRegionEditingElementId(null); setReferenceRegionMode('whole'); setReferenceRegionDraft(null) }}>취소</Button></div>}
          </div>
          <details className="reference-note"><summary>해석 메모·자료 안내</summary><label className="field"><span>해석 메모</span><textarea rows={2} defaultValue={focused?.note} key={focused?.id} onBlur={(event) => commit(updateCommon(project, { references: project.references.map((item) => item.id === focused?.id ? { ...item, note: event.target.value } : item) }))} /></label><p className="muted small">{focused?.role === 'product' ? '제품 사진은 형태·재료 참고입니다. 실제 공간의 구조나 치수를 증명하지 않습니다.' : focused?.role === 'element' ? '요소·그래픽 사진은 디자인 참고입니다. 실제 공간의 구조나 치수를 증명하지 않습니다.' : '분위기 사진은 실제 공간의 크기나 구조를 증명하지 않습니다.'} 영역 지정은 이미지 안에서 참고할 부분을 가리킵니다. 도면 위치는 다음 단계에서 정합니다.</p></details>
        </> : <Empty>분위기, 요소, 제품 사진을 각각 등록하세요.</Empty>}
      </section>
      <aside className="element-panel"><div className="panel-heading"><div><p className="eyebrow">적용할 내용</p><h2>디자인 요소</h2></div></div>
        <div className="element-scroll">{project.elements.map((element) => {
          const source = sourceFor(project, element.sourceReferenceId)
          const selected = selectedElementId === element.id
          const editing = editingElementId === element.id
          return <div key={element.id} className={`element-card ${selected ? 'is-selected' : ''}`}>
            <div className="element-card-top"><strong>{element.label}</strong><Badge tone={element.status === 'exclude' ? 'error' : element.target ? 'selected' : 'neutral'}>{element.status === 'exclude' ? '제외' : element.target ? '적용 · 배치됨' : '적용 · 위치 미지정'}</Badge></div>
            <p>{ELEMENT_LABELS[element.kind]} · {source?.name ?? '출처 없음'}</p><Button tone="quiet" onClick={() => { chooseReference(element.sourceReferenceId); setSelectedElementId(element.id) }}>원본 레퍼런스 보기</Button>
            <p className="muted small">출처 범위 · {element.sourceRegion ? '이미지 일부' : '이미지 전체'}</p>
            <p className="muted small">{element.status === 'exclude' ? '배치와 미리보기 조건에서 제외' : targetDescription(project, element.target)}</p>
            <div className="element-card-actions">
              <Button tone="danger-quiet" icon="trash" onClick={() => deleteElement(element)}>요소 삭제</Button>
              <Button tone="quiet" onClick={() => editSourceRegion(element)}>출처 범위 편집</Button>
              <Button tone="quiet" icon="edit" onClick={() => editing ? cancelConditionEdit() : beginConditionEdit(element)}>{editing ? '편집 닫기' : '조건 편집'}</Button>
              <Button tone="quiet" onClick={() => commit(updateElement(project, element.id, { status: element.status === 'apply' ? 'exclude' : 'apply' }), element.status === 'apply' ? '요소를 제외했습니다.' : '요소를 적용 대상으로 바꿨습니다.')}>{element.status === 'apply' ? '제외' : '적용'}</Button>
            </div>
            {selected && <div className="element-inline-edit">
              {editing ? <>
                <label className="field"><span>적용·제외 조건</span><textarea aria-label="적용·제외 조건" rows={2} value={conditionDraft} onChange={(event) => setConditionDraft(event.target.value)} /></label>
                <label className="field"><span>모양·재료 조건</span><textarea aria-label="모양·재료 조건" rows={2} value={appearanceDraft} onChange={(event) => setAppearanceDraft(event.target.value)} /></label>
                <label className="field"><span>요소 유형</span><select value={kindDraft} onChange={(event) => setKindDraft(event.target.value as ElementKind)}>{Object.entries(ELEMENT_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
                <div className="element-edit-actions"><Button tone="primary" icon="check" onClick={() => saveConditionEdit(element)}>변경 저장</Button><Button onClick={cancelConditionEdit}>취소</Button></div>
              </> : <>
                <div className="element-readonly-field"><strong>적용·제외 조건</strong><p>{element.conditions?.trim() || '등록된 조건 없음'}</p></div>
                <div className="element-readonly-field"><strong>모양·재료 조건</strong><p>{element.appearance?.trim() || '등록된 조건 없음'}</p></div>
                <div className="element-readonly-field"><strong>요소 유형</strong><p>{ELEMENT_LABELS[element.kind]}</p></div>
                {element.status === 'apply' && <Button icon="edit" onClick={() => editElement(element.id)}>위치 편집</Button>}
              </>}
            </div>}
          </div>
        })}</div>
        <div className="add-element"><h3>요소 추가</h3><p className="muted small">선택한 이미지 · {focusedImage?.name ?? '없음'}<br />참조 범위 · {referenceRegionMode === 'whole' ? '이미지 전체' : referenceRegionDraft ? '선택 영역' : '선택 필요'}</p><label className="field"><span>요소 이름</span><input value={elementLabel} onChange={(event) => setElementLabel(event.target.value)} placeholder="예: 곡선형 진열대" /></label><label className="field"><span>요소 유형</span><select value={elementKind} onChange={(event) => setElementKind(event.target.value as ElementKind)}>{Object.entries(ELEMENT_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label><Button icon="add" onClick={addElement} disabled={!focused || !!regionEditingElementId || (referenceRegionMode === 'region' && !referenceRegionDraft)}>요소 추가</Button></div>
      </aside>
    </div>
  }

  function renderPlacementInspector() {
    if (!selectedElement) return <Empty>왼쪽에서 요소를 선택하세요.</Empty>
    if (selectedElement.status === 'exclude') return <div className="inspector-block"><Badge tone="error">제외</Badge><h3>{selectedElement.label}</h3><p>제외한 요소는 배치할 수 없습니다. 레퍼런스 단계에서 적용으로 변경할 수 있습니다.</p><Button onClick={() => go('references')}>레퍼런스에서 변경</Button></div>
    if (!project.floorPlan) return <Empty>먼저 평면도를 등록하세요.</Empty>
    const allowed = allowedTargetKinds(selectedElement.kind)
    const floorAreas = project.floorPlan.areas.filter((area) => area.kind === 'floor')
    const ceilingAreas = project.floorPlan.areas.filter((area) => area.kind === 'ceiling')
    const spatialAreas = project.floorPlan.areas.filter((area) => area.kind === 'spatial' || area.kind === 'floor')
    const walls = project.floorPlan.structures.filter((structure) => structure.kind === 'wall')
    const floorTarget = selectedElement.target?.kind === 'floor-point' ? selectedElement.target : null
    const wallTarget = selectedElement.target?.kind === 'wall-segment' ? selectedElement.target : null
    return <div className="inspector-content"><div className="inspector-block"><h3>{selectedElement.label}</h3><p className="muted">{ELEMENT_LABELS[selectedElement.kind]}</p><p className="rule-line">허용 위치 · {allowed.map(targetLabel).join(' / ')}</p>{selectedElement.kind === 'ambient-light' && <p className="muted small">이 항목은 레퍼런스에서 가져온 공간 분위기 조건입니다. 기존 천장 등기구는 도면 구조로 등록하고 유지할 요소에서 보존 여부와 색감을 조정합니다.</p>}<p className="muted small">현재 위치: {targetDescription(project, selectedElement.target)}</p></div>
      {allowed.includes('floor-point') && <form className="inspector-block" key={`${selectedElement.id}-floor-${floorTarget?.x}-${floorTarget?.y}-${floorTarget?.rotationDegrees}-${floorTarget?.footprint?.width}-${floorTarget?.footprint?.height}`} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); applyTarget({ kind: 'floor-point', x: fraction(String(data.get('x'))), y: fraction(String(data.get('y'))), rotationDegrees: Number(data.get('rotation')), footprint: { width: fraction(String(data.get('width'))), height: fraction(String(data.get('height'))) } }) }}><h3>바닥 위치</h3><p className="muted small">평면도를 클릭하거나 비율을 입력하세요.</p><div className="field-grid"><label className="field"><span>X (%)</span><input name="x" type="number" min="0" max="100" defaultValue={pct(floorTarget?.x ?? .5)} /></label><label className="field"><span>Y (%)</span><input name="y" type="number" min="0" max="100" defaultValue={pct(floorTarget?.y ?? .5)} /></label><label className="field"><span>폭 (%)</span><input name="width" type="number" min="1" max="100" defaultValue={pct(floorTarget?.footprint?.width ?? .10)} /></label><label className="field"><span>깊이 (%)</span><input name="height" type="number" min="1" max="100" defaultValue={pct(floorTarget?.footprint?.height ?? .08)} /></label></div><label className="field"><span>회전 (도)</span><input name="rotation" type="number" min="0" max="359" defaultValue={floorTarget?.rotationDegrees ?? 0} /></label><Button type="submit">바닥 위치 적용</Button></form>}
      {allowed.includes('wall-segment') && <form className="inspector-block" key={`${selectedElement.id}-wall-${wallTarget?.wallId}-${wallTarget?.start}-${wallTarget?.end}`} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); applyTarget({ kind: 'wall-segment', wallId: String(data.get('wallId')), start: fraction(String(data.get('start'))), end: fraction(String(data.get('end'))) }) }}><h3>벽 구간</h3><p className="muted small">배치된 구간을 벽을 따라 끌거나 다른 벽을 선택하세요. 창·문과 겹치면 적용되지 않습니다.</p><label className="field"><span>벽</span><select name="wallId" defaultValue={wallTarget?.wallId ?? walls[0]?.id}>{walls.map((wall) => <option key={wall.id} value={wall.id}>{wall.name}</option>)}</select></label><div className="field-grid"><label className="field"><span>시작 (%)</span><input name="start" type="number" min="0" max="99" defaultValue={pct(wallTarget?.start ?? .10)} /></label><label className="field"><span>끝 (%)</span><input name="end" type="number" min="1" max="100" defaultValue={pct(wallTarget?.end ?? .30)} /></label></div><Button type="submit" disabled={!walls.length}>벽 구간 적용</Button></form>}
      {allowed.includes('whole-space') && <div className="inspector-block"><h3>공간 범위</h3><p className="muted small">조명 분위기나 전체 색채는 한 점에 놓지 않습니다.</p><Button onClick={() => applyTarget({ kind: 'whole-space' })}>공간 전체 적용</Button>{spatialAreas.length > 0 && <label className="field"><span>또는 지정 영역</span><select value={selectedElement.target?.kind === 'named-area' ? selectedElement.target.areaId : ''} onChange={(event) => { if (event.target.value) applyTarget({ kind: 'named-area', areaId: event.target.value }) }}><option value="">영역 선택</option>{spatialAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>}</div>}
      {allowed.includes('ceiling-zone') && <div className="inspector-block"><h3>천장 영역</h3><label className="field"><span>영역 선택</span><select value={selectedElement.target?.kind === 'ceiling-zone' ? selectedElement.target.zoneId : ''} onChange={(event) => { if (event.target.value) applyTarget({ kind: 'ceiling-zone', zoneId: event.target.value }) }}><option value="">천장 영역 선택</option>{ceilingAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label></div>}
      {allowed.includes('floor-area') && <div className="inspector-block"><h3>바닥 영역</h3><label className="field"><span>영역 선택</span><select value={selectedElement.target?.kind === 'floor-area' ? selectedElement.target.areaId : ''} onChange={(event) => { if (event.target.value) applyTarget({ kind: 'floor-area', areaId: event.target.value }) }}><option value="">바닥 영역 선택</option>{floorAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label></div>}
      <div className="inspector-block"><h3>저장된 조건</h3><div className="element-readonly-field"><strong>적용·제외 조건</strong><p>{selectedElement.conditions?.trim() || '등록된 조건 없음'}</p></div><div className="element-readonly-field"><strong>모양·재료 조건</strong><p>{selectedElement.appearance?.trim() || '등록된 조건 없음'}</p></div><Button icon="edit" onClick={() => { beginConditionEdit(selectedElement); go('references') }}>조건 편집</Button></div>
    </div>
  }

  function renderPlacement() {
    const active = project.elements.filter((item) => item.status === 'apply')
    return <div className={`workspace-layout ${showWorkspaceLeft ? '' : 'is-left-hidden'} ${showWorkspaceRight ? '' : 'is-right-hidden'}`}>
      <aside className="workspace-side workspace-side--left"><div className="panel-heading"><div><p className="eyebrow">적용 요소</p><h2>배치 목록</h2></div><Badge>{active.length}개</Badge></div><div className="workspace-catalog"><div className="workspace-list">{active.map((element) => <button key={element.id} className={`element-list-button ${placementSelection === 'element' && selectedElementId === element.id ? 'is-selected' : ''}`} aria-pressed={placementSelection === 'element' && selectedElementId === element.id} onClick={() => selectPlacementElement(element.id)}><strong>{element.label}</strong><small>{ELEMENT_LABELS[element.kind]}</small><span className={`status-line ${element.target ? 'is-placed' : ''}`}>{element.target ? targetDescription(project, element.target) : '위치 미지정'}</span></button>)}</div>{active.length === 0 && <Empty>적용할 요소가 없습니다. 레퍼런스에서 적용 요소를 선택하세요.</Empty>}<div className="workspace-structure-list"><h3>도면 구조</h3><p className="muted small">보존을 끈 구조는 위치를 수정할 수 있습니다.</p>{project.floorPlan?.structures.map((structure) => <button key={structure.id} type="button" className={`element-list-button ${placementSelection === 'structure' && selectedStructureId === structure.id ? 'is-selected' : ''}`} aria-pressed={placementSelection === 'structure' && selectedStructureId === structure.id} onClick={() => selectPlacementStructure(structure.id)}><strong>{structure.name}</strong><span>{structureMovementReason(project, structure) ? '위치 고정 · 조건 확인' : '이동 가능'}</span></button>)}</div>{project.elements.some((item) => item.status === 'exclude') && <div className="side-bottom"><p className="muted small">제외 요소 {project.elements.length - active.length}개는 배치하지 않습니다.</p><Button tone="quiet" onClick={() => go('references')}>제외 조건 보기</Button></div>}</div></aside>
      <section className="workspace-main"><div className="panel-heading"><div><p className="eyebrow">평면도 작업</p><h2>배치 도면</h2></div>{renderWorkspaceToolbar('요소 목록')}<Badge tone="info">{project.floorPlan?.geometryConfidence === 'schematic' ? '개략 도면 · 치수 미확인' : '평면도'}</Badge></div><p className="narrow-notice">도면의 요소를 끌어 이동하고 회전 손잡이로 각도를 조정하세요. 수치 입력도 사용할 수 있습니다.</p>{pendingPlacement && <div className="placement-warning" role="alert"><NucleoIcon name="warning" /><div><strong>보존 조건 확인</strong>{pendingPlacement.warnings.map((message) => <p key={message}>{message}</p>)}<div className="placement-warning__actions"><Button tone="primary" onClick={() => applyElementTarget(pendingPlacement.elementId, pendingPlacement.target, true)}>확인하고 배치</Button><Button onClick={() => setPendingPlacement(null)}>취소</Button></div></div></div>}<PlanCanvas project={project} onDragEvent={recordCanvasDrag} mode="place" selectedElementId={placementSelection === 'element' ? selectedElementId : undefined} selectedStructureId={selectedStructureId} selectedCameraId={selectedCameraId} onElementSelect={selectPlacementElement} onElementMove={(id, x, y) => { const element = project.elements.find((item) => item.id === id); if (element?.target?.kind === 'floor-point') applyElementTarget(id, { ...element.target, x, y }) }} onElementRotate={(id, rotationDegrees) => { const element = project.elements.find((item) => item.id === id); if (element?.target?.kind === 'floor-point') applyElementTarget(id, { ...element.target, rotationDegrees }) }} onWallElementMove={(id, wallId, start, end) => { const element = project.elements.find((item) => item.id === id); if (element?.target?.kind === 'wall-segment') applyElementTarget(id, { ...element.target, wallId, start, end }) }} onStructureSelect={selectPlacementStructure} onStructureMove={moveOptionalStructure} validationMessage={planEditError} onPlacePoint={(x, y) => {
        if (placementSelection !== 'element' || !selectedElement) return
        if (!allowedTargetKinds(selectedElement.kind).includes('floor-point')) { setError(`${selectedElement.label}은(는) 바닥의 한 점에 놓을 수 없습니다. ${allowedTargetKinds(selectedElement.kind).map(targetLabel).join(' 또는 ')}을 선택하세요.`); return }
        const old = selectedElement.target?.kind === 'floor-point' ? selectedElement.target : null
        applyTarget({ kind: 'floor-point', x, y, footprint: old?.footprint ?? { width: .10, height: .08 }, rotationDegrees: old?.rotationDegrees ?? 0 })
      }} onWallSelect={placementSelection === 'element' ? (wallId) => {
        if (placementSelection !== 'element' || !selectedElement) return
        if (!allowedTargetKinds(selectedElement.kind).includes('wall-segment')) { setError(`${selectedElement.label}은(는) 벽에 배치할 수 없습니다. ${allowedTargetKinds(selectedElement.kind).map(targetLabel).join(' 또는 ')}을 선택하세요.`); return }
        const old = selectedElement.target?.kind === 'wall-segment' ? selectedElement.target : null
        applyTarget({ kind: 'wall-segment', wallId, start: old?.wallId === wallId ? old.start : .10, end: old?.wallId === wallId ? old.end : .30 })
      } : undefined} /><div className="canvas-help"><span>바닥 요소: 선택 후 드래그</span><span>회전: 선택 요소의 손잡이 드래그</span><span>벽 요소: 벽 구간 드래그</span></div></section>
      <aside className="workspace-side inspector"><div className="panel-heading"><div><p className="eyebrow">유형별 설정</p><h2>속성 편집</h2></div></div>{placementSelection === 'structure' ? <div className="inspector-content">{renderStructureInspector()}</div> : renderPlacementInspector()}</aside>
    </div>
  }

  function addView(): boolean {
    if (!project.floorPlan) { setError('먼저 평면도를 준비하세요.'); return false }
    if (project.cameras.length >= 3) { setError('시점은 최대 3개까지 관리할 수 있습니다.'); return false }
    const preferred = [{ x: .50, y: .78 }, { x: .32, y: .70 }, { x: .68, y: .70 }][project.cameras.length]
    const camera: Camera = { id: makeId('camera'), name: project.cameras.length ? `추가 시점 ${project.cameras.length}` : '대표 시점', ...preferred, directionDegrees: 270, fovPreset: 'standard', primary: project.cameras.length === 0 }
    const candidates = [preferred, ...Array.from({ length: 19 * 19 }, (_, index) => ({
      x: .05 + (index % 19) * .05,
      y: .05 + Math.floor(index / 19) * .05,
    })).sort((a, b) => (a.x - preferred.x) ** 2 + (a.y - preferred.y) ** 2 - (b.x - preferred.x) ** 2 - (b.y - preferred.y) ** 2)]
    const position = candidates.find(({ x, y }) => validateCamera(addCamera(project, { ...camera, x, y }), camera.id).valid)
    if (!position) { setError('카메라를 놓을 수 있는 바닥 위치가 없습니다. 평면도와 배치 요소를 먼저 확인해 주세요.'); return false }
    if (!commit(addCamera(project, { ...camera, ...position }), '시점을 추가했습니다. 평면도에서 위치와 방향을 확인하세요.')) return false
    setSelectedCameraId(camera.id)
    return true
  }

  function renderCamera() {
    const cameraIssues = selectedCamera ? validateCamera(project, selectedCamera.id).issues : []
    return <div className={`workspace-layout ${showWorkspaceLeft ? '' : 'is-left-hidden'} ${showWorkspaceRight ? '' : 'is-right-hidden'}`}>
      <aside className="workspace-side workspace-side--left"><div className="panel-heading"><div><p className="eyebrow">시점 관리</p><h2>카메라</h2></div></div><div className="workspace-list">{project.cameras.map((camera) => <button key={camera.id} className={`camera-list-button ${selectedCamera?.id === camera.id ? 'is-selected' : ''}`} aria-pressed={selectedCamera?.id === camera.id} onClick={() => setSelectedCameraId(camera.id)}><strong>{camera.name}</strong><small>{camera.primary ? '대표 시점' : '추가 시점'}</small><span className="status-line">위치 {pct(camera.x)}%, {pct(camera.y)}% · 방향 {camera.directionDegrees}°</span></button>)}</div>{project.cameras.length === 0 && <Empty>대표 시점을 추가해 주세요.</Empty>}<div className="side-bottom"><Button icon="camera" onClick={() => addView()} disabled={project.cameras.length >= 3}>{project.cameras.length ? '시점 추가' : '대표 시점 만들기'}</Button><p className="muted small">추가 시점은 선택 사항입니다. 최대 3개까지 관리합니다.</p></div></aside>
      <section className="workspace-main"><div className="panel-heading"><div><p className="eyebrow">시점 위치</p><h2>시점 도면</h2></div>{renderWorkspaceToolbar('카메라 목록')}<Badge tone="info">{project.floorPlan?.geometryConfidence === 'schematic' ? '개략 도면' : '평면도'}</Badge></div><p className="narrow-notice">카메라 아이콘을 끌어 이동하고 회전 손잡이를 돌리세요. 수치 입력도 사용할 수 있습니다.</p><PlanCanvas project={project} onDragEvent={recordCanvasDrag} mode="camera" selectedCameraId={selectedCamera?.id} onCameraSelect={setSelectedCameraId} onCameraMove={(id, x, y) => applyCameraChange(id, { x, y })} onCameraRotate={(id, directionDegrees) => applyCameraChange(id, { directionDegrees })} /><div className="canvas-help"><span>카메라 아이콘: 드래그 이동</span><span>회전 손잡이: 시선 방향 조정</span><span>시점 추가는 선택 사항</span></div></section>
      <aside className="workspace-side inspector"><div className="panel-heading"><div><p className="eyebrow">시점 설정</p><h2>카메라 속성</h2></div></div>{selectedCamera ? <div className="inspector-content">{cameraIssues.length > 0 && <div className="camera-validation" role="alert"><strong>시점 위치를 확인해 주세요</strong>{cameraIssues.map((issue) => <p key={`${issue.code}-${issue.message}`}>{issue.message}</p>)}</div>}<div className="inspector-block"><label className="field"><span>시점 이름</span><input defaultValue={selectedCamera.name} key={`${selectedCamera.id}-name`} onBlur={(event) => commit(updateCamera(project, selectedCamera.id, { name: event.target.value.trim() || selectedCamera.name }))} /></label><label className="checkbox-row"><input type="checkbox" checked={selectedCamera.primary} onChange={() => commit(updateCamera(project, selectedCamera.id, { primary: true }), '대표 시점을 변경했습니다.')} /><span>대표 시점으로 사용</span></label></div><div className="inspector-block"><h3>위치</h3><p className="muted">도면의 카메라 본체를 끌어 이동하세요.</p><details className="inspector-numeric"><summary>좌표로 위치 조정</summary><form className="inspector-numeric__form" key={`${selectedCamera.id}-position-${selectedCamera.x}-${selectedCamera.y}`} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const x = fraction(String(data.get('x'))), y = fraction(String(data.get('y'))); if (![x,y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) { setError('위치는 0–100% 범위로 입력해 주세요.'); return } applyCameraChange(selectedCamera.id, { x, y }) }}><div className="field-grid"><label className="field"><span>X (%)</span><input name="x" type="number" min="0" max="100" defaultValue={pct(selectedCamera.x)} /></label><label className="field"><span>Y (%)</span><input name="y" type="number" min="0" max="100" defaultValue={pct(selectedCamera.y)} /></label></div><Button type="submit">위치 적용</Button></form></details></div><div className="inspector-block"><label className="field"><span>바라보는 방향 · {selectedCamera.directionDegrees}°</span><input type="range" min="0" max="359" value={selectedCamera.directionDegrees} onPointerDown={() => experiment.beginCameraEdit(project)} onPointerUp={() => experiment.endCameraEdit(projectRef.current)} onKeyDown={() => experiment.beginCameraEdit(project)} onKeyUp={() => experiment.endCameraEdit(projectRef.current)} onBlur={() => experiment.endCameraEdit(projectRef.current)} onChange={(event) => applyCameraChange(selectedCamera.id, { directionDegrees: Number(event.target.value) })} /></label><p className="muted small">0° 오른쪽 · 90° 아래 · 180° 왼쪽 · 270° 위쪽</p><label className="field"><span>화각</span><select value={selectedCamera.fovPreset ?? 'standard'} onChange={(event) => commit(updateCamera(project, selectedCamera.id, { fovPreset: event.target.value as Camera['fovPreset'] }))}><option value="narrow">좁게</option><option value="standard">기본</option><option value="wide">넓게</option></select></label></div><div className="inspector-block"><p className="muted small">시점만 수정하면 이 카메라의 이전 결과에만 오래됨 표시가 붙습니다. 공간 공통 조건은 유지됩니다.</p></div></div> : <Empty>카메라를 추가하면 속성을 편집할 수 있습니다.</Empty>}</aside>
    </div>
  }

  function issueStep(issue: ValidationIssue): Step {
    if (['missing-plan', 'missing-existing-photo', 'plan-alignment-pending', 'missing-area', 'partition-conflict'].includes(issue.code)) return 'space'
    if (['missing-applied-element', 'missing-reference'].includes(issue.code)) return 'references'
    if (['missing-primary-camera', 'invalid-camera'].includes(issue.code)) return 'camera'
    if (issue.code === 'keep-conflict') {
      const element = project.elements.find((item) => item.id === issue.elementId)
      if (element?.kind === 'wall-material') return 'references'
      return issue.structureId ? 'keep' : 'placement'
    }
    if (issue.code === 'missing-structure') return 'keep'
    return 'placement'
  }
  async function previewSample() {
    if (generationInFlightRef.current || busy) return
    if (!preflight.valid) { setError('먼저 아래 필수 조건을 해결해 주세요.'); return }
    const cameraId = project.cameras.find((item) => item.id === selectedCameraId)?.id ?? project.cameras.find((item) => item.primary)?.id
    if (!cameraId) { setError('대표 시점을 선택해 주세요.'); return }
    setBusy(true); setError(''); setNotice('')
    generationInFlightRef.current = true
    experiment.record('sample_preview_request', 'camera', cameraId, { origin: 'sample' })
    try {
      const result = await offlineDemoProvider.createResult(project, cameraId)
      if (!commit(appendResult(project, result), '사전 준비된 데모 샘플을 열었습니다. 현재 설정을 반영한 생성 결과가 아닙니다.')) return
      setSelectedResultId(result.id); go('results')
      experiment.record('sample_preview_complete', 'result', result.id, { origin: 'sample' })
    } catch (cause) { setError(cause instanceof Error ? cause.message : '샘플을 열지 못했습니다.') }
    finally { generationInFlightRef.current = false; setBusy(false) }
  }
  function allowGenerationRetry() {
    if (unknownRetrySeconds > 0) return
    try { sessionStorage.removeItem(UNKNOWN_GENERATION_SESSION_KEY) } catch { /* The current page state remains authoritative. */ }
    setUncertainGenerationAt(null)
    setError('')
    showNotice('재요청 잠금을 해제했습니다. 비용이 다시 발생할 수 있으니 결과 이력과 사용량을 확인한 뒤 결정해 주세요.')
  }
  async function generateImage() {
    if (generationInFlightRef.current) return
    if (uncertainGenerationAt !== null) { setError('이전 이미지 생성 요청의 결과가 불확실합니다. 결과 이력과 사용량을 확인하고 대기 시간이 지난 뒤 재시도를 허용해 주세요.'); return }
    if (saveFailed) { setError('프로젝트 기록 저장 문제를 해결하고 저장을 다시 시도한 뒤 AI 이미지를 생성해 주세요.'); return }
    if (!preflight.valid) { setError('먼저 아래 필수 조건을 해결해 주세요.'); return }
    if (!generationStatus?.available) { setError('AI 생성 서버가 준비되지 않았습니다. 데모 샘플은 계속 사용할 수 있습니다.'); return }
    const cameraId = project.cameras.find((item) => item.id === selectedCameraId)?.id ?? project.cameras.find((item) => item.primary)?.id
    if (!cameraId) { setError('대표 시점을 선택해 주세요.'); return }
    const sourceProject = project
    const existingPhotoId = sourceProject.sourceImages.find((image) => image.id === generationExistingPhotoId && image.role === 'existing-space')?.id ??
      sourceProject.sourceImages.find((image) => image.role === 'existing-space')?.id
    generationInFlightRef.current = true
    setBusy(true); setError(''); setNotice('')
    const requestId = crypto.randomUUID(), generationStarted = Date.now()
    experiment.record('generation_request', 'camera', cameraId, { origin: 'ai', request_id: requestId, common_revision: sourceProject.commonRevision })
    try {
      const result = await createApiImageProvider(requestId).createResult(sourceProject, cameraId, existingPhotoId)
      experiment.record('generation_complete', 'result', result.id, { origin: 'ai', request_id: requestId, duration_ms: Date.now() - generationStarted })
      const latest = loadProjects().find((item) => item.id === sourceProject.id) ?? sourceProject
      const latestCamera = latest.cameras.find((item) => item.id === cameraId)
      const originalCamera = result.conditionsSnapshot.camera
      const cameraChanged = cameraConditionsChanged(latestCamera, originalCamera)
      const savedResult = { ...result, stale: latest.commonRevision !== result.commonRevision || cameraChanged }
      const updated = appendResult(latest, savedResult)
      let persisted = false
      try {
        saveProject(updated)
        setProjects(loadProjects())
        setSaveFailed(false)
        persisted = true
      } catch {
        setSaveFailed(true)
        setError('AI 이미지는 생성됐고 비용이 발생했을 수 있으나 프로젝트 기록 저장에 실패했습니다. 결과는 현재 탭에만 남아 있습니다. 새로고침하거나 다른 프로젝트로 이동하기 전에 이미지를 내보내고 저장 공간을 확인한 뒤 저장을 다시 시도해 주세요.')
      }
      // A paid image without a persisted project record must remain visible even
      // if the user opened another project while the request was running.
      if (projectRef.current.id === sourceProject.id || !persisted) {
        projectRef.current = updated
        setProject(updated)
        setSelectedResultId(result.id)
        go('results')
      }
      if (persisted) showNotice(savedResult.stale ? 'AI 이미지 1장을 저장했습니다. 생성 중 조건이 바뀌어 이전 조건으로 표시합니다.' : 'AI 이미지 1장을 저장했습니다. 구조와 조건을 직접 대조해 주세요.')
    } catch (cause) {
      if (cause instanceof GenerationOutcomeUnknownError) {
        experiment.record('generation_fail', 'camera', cameraId, { request_id: requestId, outcome_unknown: true, duration_ms: Date.now() - generationStarted }, 'failure')
        const now = Date.now()
        setUncertainGenerationAt(now)
        setGenerationClock(now)
        try { sessionStorage.setItem(UNKNOWN_GENERATION_SESSION_KEY, String(now)) } catch { /* Page state still blocks retry. */ }
      } else experiment.record('generation_fail', 'camera', cameraId, { request_id: requestId, outcome_unknown: false, duration_ms: Date.now() - generationStarted }, 'failure')
      setError(cause instanceof Error ? cause.message : 'AI 이미지를 생성하지 못했습니다. 이전 결과는 그대로 보관됩니다.')
    }
    finally { generationInFlightRef.current = false; setBusy(false); setGenerationStatus(await getGenerationStatus()) }
  }
  function renderReview() {
    const applied = project.elements.filter((item) => item.status === 'apply')
    const excluded = project.elements.filter((item) => item.status === 'exclude')
    const existingPhotos = project.sourceImages.filter((image) => image.role === 'existing-space')
    const activeExistingPhotoId = existingPhotos.some((image) => image.id === generationExistingPhotoId) ? generationExistingPhotoId : existingPhotos[0]?.id ?? ''
    const primary = project.cameras.find((item) => item.primary)
    const reviewCamera = project.cameras.find((item) => item.id === selectedCameraId) ?? primary
    const placed = applied.filter((item) => item.target)
    const atmosphere = applied.find((item) => item.kind === 'ambient-light' || item.kind === 'global-palette')
    const feel = atmosphere?.appearance?.trim() || atmosphere?.label || project.concept.trim()
    const generationReferenceCount = new Set(applied.map((item) => project.references.find((reference) => reference.id === item.sourceReferenceId)?.imageId).filter(Boolean)).size
    const tooManyGenerationReferences = generationReferenceCount > 3
    let referencePreparationError = ''
    try {
      for (const image of project.sourceImages.filter((item) => item.role !== 'existing-space')) referencePreparationFor(project, image.id)
    } catch (cause) { referencePreparationError = cause instanceof Error ? cause.message : '레퍼런스 선택 영역을 확인해 주세요.' }
    return <div className="review-layout"><div className="review-main">
      <section className="review-overview"><h2>이대로 시안을 만들까요?</h2><dl className="review-brief"><div><dt>유지</dt><dd>{project.keeps.map((keep) => project.floorPlan?.structures.find((item) => item.id === keep.structureId)?.name ?? keep.description).join(' · ') || '보존할 구조 없음'}</dd></div><div><dt>배치</dt><dd>{placed.length ? placed.map((element) => <p key={element.id}><strong>{element.label}</strong><span>{targetDescription(project, element.target)}</span></p>) : '위치를 지정한 요소 없음'}</dd></div><div><dt>제외</dt><dd>{excluded.map((element) => element.label).join(' · ') || '제외한 요소 없음'}</dd></div><div><dt>시점</dt><dd>{reviewCamera ? `${reviewCamera.name} · ${reviewCamera.fovPreset === 'wide' ? '넓은' : reviewCamera.fovPreset === 'narrow' ? '좁은' : '기본'} 화각` : '시점을 지정해 주세요'}</dd></div></dl><div className="condition-synthesis"><strong>시안의 방향</strong><p>{feel ? `분위기는 ‘${feel}’을 의도합니다.` : '분위기 조건을 추가하면 이곳에 함께 정리됩니다.'} {reviewCamera ? `${reviewCamera.name} 시점에서 검토합니다.` : '시점을 지정해 주세요.'}</p><small>입력한 조건을 정리한 설명입니다. 이미지 분석이나 생성 결과 예측은 아닙니다.</small></div></section>
      <details className="review-condition-details" open={!preflight.valid || undefined}><summary>세부 조건 확인·수정</summary><div>
      <section className="review-section"><div className="section-heading"><div><p className="eyebrow">01 · 보존</p><h2>유지할 구조</h2></div><Button tone="quiet" icon="edit" onClick={() => go('keep')}>보존 조건 편집</Button></div>{project.keeps.length ? <details className="review-details" open={project.keeps.length <= 3}><summary>보존 구조 {project.keeps.length}개 · 목록 {project.keeps.length <= 3 ? '접기' : '펼쳐서 확인하기'}</summary>{project.keeps.map((keep) => <div className="summary-row" key={keep.id}><span><strong>{project.floorPlan?.structures.find((item) => item.id === keep.structureId)?.name ?? '구조 없음'}</strong><small>{keep.description}</small></span><Badge tone="keep">보존</Badge></div>)}</details> : <Empty>보존할 구조가 등록되지 않았습니다.</Empty>}</section>
      <section className="review-section"><div className="section-heading"><div><p className="eyebrow">02 · 적용</p><h2>디자인 요소와 위치</h2></div><Button tone="quiet" icon="edit" onClick={() => go('references')}>요소 편집</Button></div>{applied.length ? applied.map((element) => <div className="summary-row" key={element.id}><span><strong>{element.label}</strong><small>{sourceFor(project, element.sourceReferenceId)?.name ?? '출처 없음'} · {element.sourceRegion ? '이미지 일부' : '이미지 전체'} · {targetDescription(project, element.target)}</small>{element.conditions && <small>{element.conditions}</small>}</span><Button tone="quiet" icon="edit" onClick={() => editElement(element.id)}>위치 수정</Button></div>) : <Empty>적용할 요소가 없습니다.</Empty>}</section>
      <section className="review-section"><div className="section-heading"><div><p className="eyebrow">03 · 제외</p><h2>반영하지 않을 요소</h2></div><Button tone="quiet" icon="edit" onClick={() => go('references')}>제외 조건 편집</Button></div>{excluded.length ? excluded.map((element) => <div className="summary-row" key={element.id}><span><strong>{element.label}</strong><small>{element.conditions || '결과 조건에서 제외'}</small></span><Badge tone="error">제외</Badge></div>) : <p className="muted">제외한 요소가 없습니다.</p>}</section>
      <section className="review-section"><div className="section-heading"><div><p className="eyebrow">04 · 시점</p><h2>카메라 시점</h2></div><Button tone="quiet" icon="edit" onClick={() => go('camera')}>시점 편집</Button></div>{primary ? project.cameras.map((camera) => <div className="summary-row" key={camera.id}><span><strong>{camera.name}</strong><small>위치 {pct(camera.x)}%, {pct(camera.y)}% · 방향 {camera.directionDegrees}° · {camera.fovPreset === 'wide' ? '넓은' : camera.fovPreset === 'narrow' ? '좁은' : '기본'} 화각</small></span><Badge tone={camera.primary ? 'selected' : 'neutral'}>{camera.primary ? '대표' : '추가'}</Badge></div>) : <Empty>대표 카메라가 필요합니다.</Empty>}</section>
    </div></details><div className="review-sample"><div className="offline-note"><Badge tone="info">무료 샘플</Badge><p>{OFFLINE_DEMO_NOTICE}</p></div><Button tone={generationStatus?.available ? 'secondary' : 'primary'} loading={busy} onClick={previewSample} disabled={!preflight.valid || busy}>{busy ? '여는 중…' : '사전 제공 샘플 열기'}</Button>{project.results.length > 0 && <Button tone="quiet" onClick={() => go('results')}>저장된 결과 보기 · {project.results.length}개</Button>}</div></div><aside className="review-side">
      <div className="panel-heading"><div><p className="eyebrow">미리보기 전</p><h2>조건 확인</h2></div></div>
      <div className={`review-state ${preflight.valid ? 'ready' : 'blocked'}`}><strong>{preflight.valid ? '필수 조건이 준비되었습니다' : `${preflight.issues.filter((item) => item.severity === 'error').length}개 조건을 확인하세요`}</strong><p>{preflight.valid ? '선택한 시점으로 진행할 수 있습니다.' : '각 항목을 선택하면 관련 설정으로 이동합니다.'}</p></div>

      {preflight.issues.map((issue, index) => <button key={`${issue.code}-${index}`} className="issue-row" onClick={() => { const destination = issueStep(issue); experiment.record('review_edit_target', 'condition', issue.elementId ?? issue.structureId ?? null, { to_step: destination, invalid_reason: issue.code }); go(destination); if (issue.elementId) setSelectedElementId(issue.elementId); if (issue.structureId) setSelectedStructureId(issue.structureId) }}><span>{issue.message}</span><strong>수정하기</strong></button>)}
      <div className="review-camera-choice"><label className="field"><span>결과를 볼 시점</span><select value={project.cameras.some((item) => item.id === selectedCameraId) ? selectedCameraId : primary?.id ?? ''} onChange={(event) => setSelectedCameraId(event.target.value)}>{project.cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}{camera.primary ? ' · 대표' : ''}</option>)}</select></label></div>
      <div className="generation-panel"><div className="generation-panel__heading"><Badge tone="selected">실제 생성</Badge><strong>AI 이미지 1장 만들기</strong></div>{existingPhotos.length > 1 ? <label className="field"><span>생성 기준 기존 공간 사진</span><select value={activeExistingPhotoId} disabled={busy} onChange={(event) => setGenerationExistingPhotoId(event.target.value)}>{existingPhotos.map((image) => <option key={image.id} value={image.id}>{image.name}</option>)}</select></label> : existingPhotos[0] ? <p className="muted small">생성 기준 기존 공간 사진 · {existingPhotos[0].name}</p> : null}<p>설정한 조건과 선택한 시점으로 이미지 1장을 만듭니다.</p><details className="generation-details"><summary>사용 자료·결과 안내</summary><p>기존 공간 사진 1장, 등록한 도면, 적용 레퍼런스 최대 3장과 설정한 조건을 이미지 생성 서비스에 전송합니다. 일부 영역을 선택한 레퍼런스는 해당 부분만 사용합니다. 업로드한 도면이 없으면 직접 그린 도면 조건을 사용합니다. 결과의 구조·치수는 직접 확인해 주세요.</p></details>{tooManyGenerationReferences && <p className="generation-panel__warning">적용 레퍼런스가 {generationReferenceCount}장입니다. 한 번에 사용할 수 있는 레퍼런스는 최대 3장입니다. <button type="button" onClick={() => go('references')}>레퍼런스 수정</button></p>}{referencePreparationError && <p className="generation-panel__warning">{referencePreparationError} <button type="button" onClick={() => go('references')}>레퍼런스 수정</button></p>}{saveFailed && <p className="generation-panel__warning">프로젝트 기록 저장 문제를 해결해야 새 유료 요청을 할 수 있습니다. <button type="button" onClick={() => commit(project, '프로젝트 기록을 저장했습니다.')}>저장 다시 시도</button></p>}{uncertainGenerationAt !== null && <div className="generation-panel__warning"><strong>이전 요청의 결과가 불확실합니다</strong><p>비용이 발생했을 수 있습니다. 결과 이력과 OpenAI 사용량을 확인해 주세요. {unknownRetrySeconds > 0 ? `재시도 허용까지 ${unknownRetrySeconds}초` : '대기 시간이 지났습니다. 위험을 확인한 뒤 재시도를 허용할 수 있습니다.'}</p><button type="button" onClick={allowGenerationRetry} disabled={busy || unknownRetrySeconds > 0}>위험 확인 후 재시도 허용</button></div>}{generationStatusLoading ? <p className="muted">생성 서버 상태 확인 중…</p> : generationStatus?.available ? <>{generationStatus.quota && <p className="muted small">전체 남은 생성 {generationStatus.quota.remaining} / {generationStatus.quota.totalLimit}회 · 오늘 남은 생성 {generationStatus.quota.dailyRemaining} / {generationStatus.quota.dailyLimit}회{generationStatus.quota.busy ? ' · 서버에서 생성 요청 처리 중' : ''}</p>}{generationStatus.quota && <p className="muted small">이 횟수는 모든 사용자가 공유합니다. 서버에 접수된 요청은 실패해도 차감됩니다.</p>}{generationStatus.quota?.remaining === 0 ? <p role="status">전체 생성 한도를 모두 사용했습니다. 무료 샘플과 편집은 계속 사용할 수 있습니다.</p> : generationStatus.quota?.dailyRemaining === 0 ? <p role="status">오늘 생성 한도를 모두 사용했습니다. 한국 시간 자정 이후 다시 사용할 수 있습니다.</p> : generationStatus.quota?.busy ? <p role="status">다른 요청이 접수되어 있습니다. 잠시 후 생성 가능 여부를 다시 확인해 주세요.</p> : null}<Button tone="primary" loading={busy} onClick={generateImage} disabled={!preflight.valid || busy || tooManyGenerationReferences || !!referencePreparationError || uncertainGenerationAt !== null || saveFailed || (!!generationStatus.quota && (generationStatus.quota.remaining === 0 || generationStatus.quota.dailyRemaining === 0 || generationStatus.quota.busy))}>{busy ? '처리 중…' : 'AI 이미지 생성'}</Button></> : <p className="muted">{generationStatus?.reason ?? '생성 서버를 확인할 수 없습니다. 무료 샘플은 계속 사용할 수 있습니다.'}</p>}<Button tone="quiet" loading={generationStatusLoading} disabled={busy} onClick={async () => { setGenerationStatusLoading(true); setGenerationStatus(await getGenerationStatus()); setGenerationStatusLoading(false) }}>{generationStatusLoading ? '확인 중…' : '생성 가능 여부 확인'}</Button></div>

    </aside></div>
  }

  async function downloadResult(result: Result) {
    setBusy(true); setError('')
    let resolved = ''
    try {
      resolved = await resolveImageUri(result.imageUri)
      const response = await fetch(resolved)
      if (!response.ok) throw new Error('이미지를 내려받지 못했습니다.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'
      anchor.href = url; anchor.download = `${project.name.replace(/[^\p{L}\p{N}-]+/gu, '-')}-${result.id.slice(0, 8)}.${extension}`
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
      experiment.record('result_save', 'result', result.id, { origin: result.origin })
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      showNotice('결과 이미지를 내려받았습니다.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '내려받지 못했습니다.') }
    finally { revokeImageUrl(resolved); setBusy(false) }
  }
  function exportRecord() {
    const json = JSON.stringify({ schemaVersion: 1, project, note: '업로드 원본과 AI 결과 이미지 파일은 포함되지 않습니다. 같은 브라우저의 이미지 저장소에 보관됩니다.' }, null, 2)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `${project.name.replace(/[^\p{L}\p{N}-]+/gu, '-')}-작업기록.json`
    document.body.appendChild(anchor); anchor.click(); anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    showNotice('작업 기록 JSON을 내려받았습니다. 업로드 원본과 AI 결과 이미지 파일은 포함되지 않습니다.')
  }
  function renderResults() {
    const current = selectedResult
    const approved = project.results.filter((item) => item.approved)
    const snapshot = current?.conditionsSnapshot
    const snapshotProject = snapshot?.common ? { ...project, ...snapshot.common, sourceImages: snapshot.common.sourceImages ?? project.sourceImages } : project
    return <div className="results-layout"><section className="result-main"><div className="panel-heading"><div><p className="eyebrow">시안 확인</p><h2>{project.cameras.find((item) => item.id === current?.cameraId)?.name ?? '결과'}</h2></div><div className="badge-line">{current?.stale && <Badge tone="error">이전 조건</Badge>}{current && <Badge tone="info">{current.origin === 'ai' ? 'AI 생성' : '사전 제공 샘플'}</Badge>}</div></div>
      {current ? <><div className="result-image-frame"><AssetImage uri={current.imageUri} alt={current.origin === 'ai' ? '현재 시점에서 AI가 생성한 공간 콘셉트 이미지' : '사전 준비된 AURA POP-UP 데모 공간 이미지'} className="result-image" /><span className="result-watermark">{current.origin === 'ai' ? 'AI 생성 · 실제 시공·치수 확인 필요' : '사전 제공 샘플 · 생성 결과 아님'}</span></div><div className="result-caption"><span>버전 {project.results.indexOf(current) + 1} · {new Date(current.createdAt).toLocaleDateString('ko-KR')} · {current.approved ? '승인됨' : '검토 중'}</span><span>{current.stale ? '현재 조건과 다릅니다. 이 이미지는 그대로 보관됩니다.' : current.origin === 'ai' ? '현재 입력 조건으로 생성한 콘셉트 이미지' : '조건 기록 · 샘플 이미지와 별개'}</span></div><div className="result-actions"><Button tone={current.approved ? 'secondary' : 'primary'} icon={current.approved ? undefined : 'check'} onClick={() => commit(setResultApproved(project, current.id, !current.approved), current.approved ? '승인을 취소했습니다.' : '결과를 승인했습니다.')}>{current.approved ? '승인 취소' : '이 결과 승인'}</Button><Button onClick={() => downloadResult(current)} disabled={busy}>이미지 내보내기</Button><Button onClick={exportRecord}>작업 기록 JSON</Button>{saveFailed && <Button onClick={() => commit(project, '프로젝트 기록을 저장했습니다.')}>프로젝트 저장 다시 시도</Button>}</div><p className="muted small">{current.origin === 'ai' ? '이미지 모델은 Keep·위치·치수의 완전한 일치를 보장하지 않습니다. 승인 전에 직접 대조해 주세요.' : OFFLINE_DEMO_NOTICE} 작업 기록 JSON에는 업로드 원본과 결과 이미지 파일이 포함되지 않습니다.</p></> : <div className="result-empty"><Empty>아직 결과가 없습니다. 생성 전 확인에서 샘플 미리보기를 열거나 AI 이미지를 생성하세요.</Empty><Button onClick={() => go('review')}>생성 전 확인으로 이동</Button></div>}
      <details className="history-section"><summary>결과 이력 · {project.results.length}개</summary><SwipeCarousel label="결과 이력" variant="history" activeId={current?.id} onActiveIdChange={setSelectedResultId} items={project.results.map((result, index) => ({ id: result.id, content: <button type="button" className={`history-item ${current?.id === result.id ? 'is-selected' : ''}`} aria-pressed={current?.id === result.id} onClick={() => setSelectedResultId(result.id)}><AssetImage uri={result.imageUri} alt={`결과 ${index + 1} 미리보기`} /><span><strong>버전 {index + 1} · {project.cameras.find((camera) => camera.id === result.cameraId)?.name ?? '삭제된 시점'}</strong><small>{result.origin === 'ai' ? 'AI 생성' : '사전 제공 샘플'} · {result.approved ? '승인됨' : '검토 중'} · {result.stale ? '이전 조건' : '현재 조건'}</small></span></button> }))} /></details>
      {approved.length > 0 && <details className="moodboard-section"><summary>승인 이미지 모아보기 · {approved.length}개</summary><SwipeCarousel label="승인 이미지" variant="gallery" activeId={current?.approved ? current.id : undefined} onActiveIdChange={setSelectedResultId} items={approved.map((result) => ({ id: result.id, content: <button type="button" className={`approved-result-card ${current?.id === result.id ? 'is-selected' : ''}`} aria-pressed={current?.id === result.id} onClick={() => setSelectedResultId(result.id)}><AssetImage uri={result.imageUri} alt={`승인된 ${result.origin === 'ai' ? 'AI 생성' : '사전 제공 샘플'} 결과 버전 ${project.results.indexOf(result) + 1}`} /><span>버전 {project.results.indexOf(result) + 1} · {project.cameras.find((camera) => camera.id === result.cameraId)?.name ?? '시점'}</span></button> }))} /></details>}
    </section><aside className="result-inspector"><div className="panel-heading"><div><p className="eyebrow">이 결과의 조건</p><h2>조건 기록</h2></div></div>{snapshot ? <div className="result-conditions">{current?.origin === 'ai' && <div className="condition-group"><h3>생성 기준 사진</h3><p>{snapshot.existingPhotoId ? snapshotProject.sourceImages.find((image) => image.id === snapshot.existingPhotoId)?.name ?? '선택한 사진이 현재 목록에 없습니다.' : '이전 결과에는 기준 사진 기록이 없습니다.'}</p></div>}<div className="condition-group"><div className="group-heading"><h3>유지할 구조</h3><Button tone="quiet" onClick={() => go('keep')}>수정</Button></div><details className="result-details"><summary>보존 구조 {snapshot.common?.keeps.length ?? 0}개 펼쳐보기</summary>{(snapshot.common?.keeps ?? []).map((keep) => <p key={keep.id}>{snapshotProject.floorPlan?.structures.find((structure) => structure.id === keep.structureId)?.name ?? keep.description}</p>)}</details></div><div className="condition-group"><div className="group-heading"><h3>적용 요소</h3><Button tone="quiet" onClick={() => go('references')}>수정</Button></div>{(snapshot.common?.elements ?? []).filter((element) => element.status === 'apply').map((element) => <button key={element.id} className="condition-link" disabled={!project.elements.some((item) => item.id === element.id)} onClick={() => editElement(element.id)}><strong>{element.label}{!project.elements.some((item) => item.id === element.id) && ' · 현재 작업에서 삭제됨'}</strong><span>{sourceFor(snapshotProject, element.sourceReferenceId)?.name ?? '이전 레퍼런스'} → {targetDescription(snapshotProject, element.target)}</span></button>)}</div><div className="condition-group"><div className="group-heading"><h3>제외</h3><Button tone="quiet" onClick={() => go('references')}>수정</Button></div>{(snapshot.common?.elements ?? []).filter((element) => element.status === 'exclude').map((element) => <p key={element.id}>{element.label}</p>)}</div><div className="condition-group"><div className="group-heading"><h3>시점</h3><Button tone="quiet" onClick={() => go('camera')}>수정</Button></div><p>{project.cameras.find((camera) => camera.id === snapshot.camera.id)?.name ?? '시점'} · {pct(snapshot.camera.x)}%, {pct(snapshot.camera.y)}% · {snapshot.camera.directionDegrees}°</p></div></div> : <Empty>조건 기록이 없습니다.</Empty>}<div className="result-inspector-bottom"><Button onClick={() => go('review')}>생성 전 확인으로 돌아가기</Button><Button onClick={() => { if (addView()) go('camera') }} disabled={project.cameras.length >= 3}>추가 시점 설정</Button></div></aside></div>
  }

  const stepIndex = step === 'projects' ? -1 : STEPS.indexOf(step)
  return <div className={`app-shell ${step === 'projects' ? 'app-shell--projects' : 'app-shell--project'}`}><header className="app-header"><div className="header-inner"><button className="brand" onClick={() => go('projects')} aria-label="프로젝트 목록으로 이동"><img className="brand-mark" src="/brand/mark.svg" alt="" aria-hidden="true" width="30" height="30" /><span>공간 레퍼런스 해석기</span></button><div className="header-right"><span className={`save-status ${saveFailed ? 'save-status--error' : ''}`} role="status"><NucleoIcon name={saveFailed ? 'warning' : 'check'} />{saveFailed ? '저장 확인 필요' : '이 브라우저에 자동 저장'}</span>{step !== 'projects' && <button className="project-switch" onClick={() => go('projects')}>{project.name} · 프로젝트 목록</button>}</div></div></header>
    {step !== 'projects' && <nav ref={stepNavRef} className="step-nav" aria-label="작업 단계"><p className="step-nav-heading">공간 시안 만들기</p><div className="step-nav-inner">{STEPS.map((item, index) => <button key={item} className={`step-link ${item === step ? 'is-current' : ''} ${index < stepIndex ? 'is-complete' : ''}`} aria-current={item === step ? 'step' : undefined} onClick={() => go(item)}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><span>{STEP_LABELS[item]}</span></button>)}</div></nav>}
    <main className={`main-content ${step === 'projects' ? 'project-main' : ''}`}><div className="notification-stack" aria-label="작업 알림">      {error && <div className="alert alert-error" role="alert"><NucleoIcon name="warning" /><strong>확인 필요</strong><span>{error}</span><button onClick={() => setError('')} aria-label="오류 닫기" title="닫기"><NucleoIcon name="close" /></button></div>}{notice && <div key={noticeSerial} className="alert alert-info" role="status"><NucleoIcon name="info" /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="알림 닫기" title="닫기"><NucleoIcon name="close" /></button></div>}
      {undoAction && undoAction.projectId === project.id && <div className="undo-banner" role="status"><span>{undoAction.label}했습니다.</span><Button onClick={undoDeletion}>삭제 되돌리기</Button><button className="undo-banner__dismiss" type="button" aria-label="되돌리기 안내 닫기" onClick={() => setUndoAction(null)}><NucleoIcon name="close" /></button></div>}
</div><div className="content-wrap">{step !== 'projects' && <div className="page-intro"><div><p className="eyebrow">{project.name} · {String(stepIndex + 1).padStart(2, '0')} / 07</p><h1 ref={pageTitleRef} tabIndex={-1}>{STEP_LABELS[step]}</h1><p className="lede">{STEP_DESCRIPTIONS[step]}</p></div><div className="page-intro-right"><div className="page-actions" aria-label="단계 이동"><Button tone="quiet" icon="previous" onClick={() => go(stepIndex === 0 ? 'projects' : STEPS[stepIndex - 1])}>{stepIndex === 0 ? '프로젝트 목록' : '이전 단계'}</Button>{stepIndex < STEPS.length - 1 && step !== 'review' && <Button tone="primary" icon="next" iconAfter onClick={() => go(STEPS[stepIndex + 1])}>{NEXT_ACTIONS[step]}</Button>}</div><div className="page-status"><Badge tone="info">{project.floorPlan?.geometryConfidence === 'schematic' ? '개략 도면' : project.floorPlan ? '도면 등록' : '도면 없음'}</Badge><span>수정 버전 {project.commonRevision}</span></div></div></div>}
      <div className={`page-workspace page-workspace--${step}`} role="region" aria-label={`${STEP_LABELS[step]} 작업 영역`}>{step === 'projects' && renderProjects()}{step === 'space' && renderSpace()}{step === 'keep' && renderKeep()}{step === 'references' && renderReferences()}{step === 'placement' && renderPlacement()}{step === 'camera' && renderCamera()}{step === 'review' && renderReview()}{step === 'results' && renderResults()}</div>
      <ExperimentPanel recorder={experiment} project={project} step={step} />
    </div></main>

  </div>
}
