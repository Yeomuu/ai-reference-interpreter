import WorkspaceRegistration from '../components/WorkspaceRegistration';
import LayoutWorkspace from '../components/LayoutWorkspace';
import MappingWorkspace from '../components/MappingWorkspace';
import { bindReference, changeBindingScope, createLayoutItem, LAYOUT_LABELS, migrateLayout, targetCondition, unbindReference } from '../domain/layoutMapping';
import { LIGHT_PLAN_FOOTPRINT } from '../domain/layoutDefaults';
import { AREA_DESCRIPTIONS } from '../domain/areaDescriptions';
import TimedNotice from '../components/TimedNotice';
import { translatedElementTarget } from '../domain/movementFeedback';
import type { LayoutKind } from '../domain/types';
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import type { Area, Camera, CommonPatch, DesignElement, ElementKind, FloorPlan, PlacementTarget, Point, Project, Rect, Reference, Result, SourceImage, Structure, ValidationIssue } from '../domain'
import { addCamera, allowedTargetKinds, isDisplaySupport, outlineBounds, reshapeStructure, appendResult, cameraConditionsChanged, createEmptyProject, isStructureLocked, moveStructure, placeElement, removeDesignElement, removeReference, removeCamera, setResultApproved, setStructurePreservation, structureMovementReason, structurePosition, targetLabel, updateCamera, updateCommon, updateElement, updateKeep, updatePhotoAnchor, validateAreaDrawing, validateCamera, validatePreflight, validateStructureDrawing, validateStructureOperation } from '../domain'
import { createSampleProject } from '../data/sample'
import { CAMPUS_PREFIX, CAMPUS_SOURCE, createCampusProject } from '../data/campus'
import { loadProjects, saveProject } from '../services/persistence'
import { loadDeletionUndo, prepareDeletionUndo, type DeletionUndo } from '../services/deletionUndo'
import { deleteImageAsset, putImageAsset, resolveImageUri, revokeImageUrl, validateImageFile } from '../services/assets'
import { GenerationOutcomeUnknownError, OFFLINE_DEMO_NOTICE, createApiImageProvider, getGenerationStatus, offlineDemoProvider } from '../services/imageProvider'
import type { GenerationStatus } from '../services/imageProvider'
import { waitForGenerationSlot } from '../services/generationQueue'
import { referencePreparationFor } from '../services/generationContract'
import AssetImage from '../components/AssetImage'
import PlanCanvas from '../components/PlanCanvas'
import ResultPlanComparison from '../components/ResultPlanComparison'
import CameraSummary from '../components/CameraSummary'
import AreaTargetPicker from '../components/AreaTargetPicker'
import { targetAreaId, targetForArea } from '../domain/areaTargets'
import { displayName } from '../domain/displayName'
import { suggestNextCamera } from '../domain/cameraDefaults'
import { migrateCameraPresets, prepareRecommendedCameras } from '../domain/cameraRecommendations'
import { countLayoutItems, countReferenceImages, validatePrototypeAddition } from '../domain/prototypeLimits'
import { CAMERA_EYE_HEIGHT_PRESETS, CAMERA_PRESETS, EYE_HEIGHT_NOTICE, LAYOUT_LIMIT_MESSAGE, MAX_CAMERAS, MAX_LAYOUT_ITEMS, MAX_REFERENCE_IMAGES, REFERENCE_LIMIT_MESSAGE } from '../domain/prototypeConfig'
import { validatePlacement } from '../domain/validation'
import { wallFaceLabel } from '../domain/wallFaces'
import PhotoKeepOverlay from '../components/PhotoKeepOverlay'
import SwipeCarousel from '../components/SwipeCarousel'
import NucleoIcon from '../components/NucleoIcon'
import WelcomeScreen from '../components/WelcomeScreen'
import SpaceDirection from '../components/SpaceDirection'
import WorkflowNavigation from '../components/WorkflowNavigation'
import WorkflowStepIcon from '../components/WorkflowStepIcon'
import { createStudyProject, STUDY_START } from '../domain/studyStart'
import type { StudyProjectDetails } from '../domain/studyStart'
import ReferenceRegionPicker, { validReferenceRegion } from '../components/ReferenceRegionPicker'
import type { NucleoIconName } from '../components/NucleoIcon'
import { useProjectRoute } from './routes'
import { WORKFLOW, workflowIndex, previousWorkflowStep } from './workflow'
import type { Step } from './routes'
import ExperimentPanel from '../components/ExperimentPanel'
import { ExperimentRecorder, targetPayload } from '../services/experiment'

const STEP_LABELS: Record<Step, string> = {
  projects: '프로젝트', space: '공간 확인', keep: '유지할 구조', references: '참고 요소 선택',
  placement: '도면에 배치', camera: '바라볼 시점', review: '시안 만들기', results: '결과 보고 수정',
}
const NEXT_ACTIONS: Record<Exclude<Step, 'projects'>, string> = {
  space: '참고 요소 선택', keep: '참고 요소 선택', references: '공간에 배치하기',
  placement: '시점 지정하기', camera: '시안 만들기', review: '결과 보기', results: '결과',
}
const STEP_DESCRIPTIONS: Record<Exclude<Step, 'projects'>, string> = {
  space: '실제 공간 사진과 개략 도면을 보고, 그대로 둘 구조를 확인하세요.',
  keep: '도면에서 그대로 둘 벽·창·문을 확인하거나 수정하세요.',
  references: '이미지마다 공간에 가져오고 싶은 조명·그래픽·전시 가구를 고르세요.',
  placement: '선택한 요소를 도면에 놓고 어디에 적용할지 확인하세요.',
  camera: '완성된 공간을 바라볼 위치와 방향을 정하세요.',
  review: '선택한 요소·위치·시점을 확인하고 AI 시안을 만드세요.',
  results: '결과가 기대와 다르면 필요한 요소나 위치만 고쳐 다시 확인하세요.',
}
const ELEMENT_LABELS: Record<ElementKind, string> = {
  'display-product': '진열 상품', 'other-floor': '기타 바닥 요소', 'other-wall': '기타 벽 요소', 'other-ceiling': '기타 천장 요소', 'other-area': '기타 공간 연출',
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
function newPlan(kind: FloorPlan['kind'], imageUri?: string, shape: 'landscape' | 'portrait' | 'outline' = 'landscape'): FloorPlan {
  return {
    kind, imageUri, width: shape === 'portrait' ? 700 : 1000, height: shape === 'portrait' ? 1000 : shape === 'outline' ? 1000 : 700, units: 'unknown', geometryConfidence: 'schematic',
    structures: kind === 'schematic' && shape !== 'outline' ? [
      { id: makeId('wall'), kind: 'wall', name: '윗벽', geometry: { kind: 'segment', start: { x: .08, y: .10 }, end: { x: .92, y: .10 } }, role: 'base', immutable: true, protected: true },
      { id: makeId('wall'), kind: 'wall', name: '오른쪽 벽', geometry: { kind: 'segment', start: { x: .92, y: .10 }, end: { x: .92, y: .90 } }, role: 'base', immutable: true, protected: true },
      { id: makeId('wall'), kind: 'wall', name: '아랫벽', geometry: { kind: 'segment', start: { x: .92, y: .90 }, end: { x: .08, y: .90 } }, role: 'base', immutable: true, protected: true },
      { id: makeId('wall'), kind: 'wall', name: '왼쪽 벽', geometry: { kind: 'segment', start: { x: .08, y: .90 }, end: { x: .08, y: .10 } }, role: 'base', immutable: true, protected: true },
    ] : [],
    areas: kind === 'schematic' && shape !== 'outline' ? [
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
  if (target.kind === 'fixture-surface') return `${project.elements.find(item => item.id === target.fixtureElementId)?.label ?? '진열대'} 위 · ${pct(target.offset.x)}%, ${pct(target.offset.y)}%`
  if (target.kind === 'floor-point') return `바닥 위치 ${pct(target.x)}%, ${pct(target.y)}%`
  if (target.kind === 'wall-segment') {
    const wall = project.floorPlan?.structures.find((item) => item.id === target.wallId)
    const face = wall?.role === 'partition' ? ` · ${target.face ? wallFaceLabel(project, wall.id, target.face) : '붙일 면 미지정'}` : ''
    return `${wall?.name ?? '벽'} · ${pct(target.start)}–${pct(target.end)}%${face}`
  }
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
  return migrateCameraPresets(migrateLayout(restoreDefaultSchematicWalls(restoreSampleAnnotations(project))))
}
function Button({ children, onClick, tone = 'secondary', disabled, loading = false, pressed, type = 'button', className = '', icon, iconAfter = false }: {
  children: ReactNode, onClick?: () => void, tone?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'danger-quiet',
  disabled?: boolean, loading?: boolean, pressed?: boolean, type?: 'button' | 'submit', className?: string, icon?: NucleoIconName, iconAfter?: boolean,
}) {
  return <button type={type} className={`button button-${tone} ${className}`} onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined} aria-pressed={pressed}>{icon && !iconAfter && <NucleoIcon name={icon} />}{children}{icon && iconAfter && <NucleoIcon name={icon} />}</button>
}
type WallFaceSelection = { wallId: string; face?: 'a' | 'b' };
function WallTargetEditor({ project, walls, target, selection, onSelectionChange, onApply }: {
  project: Project, walls: Structure[], target: Extract<PlacementTarget, { kind: 'wall-segment' }> | null,
  selection?: WallFaceSelection, onSelectionChange?: (selection: WallFaceSelection) => void,
  onApply: (target: Extract<PlacementTarget, { kind: 'wall-segment' }>) => void,
}) {
  const [localWallId, setLocalWallId] = useState(target?.wallId ?? walls[0]?.id ?? '')
  const [localFace, setLocalFace] = useState<'a' | 'b' | ''>(target?.face ?? '')
  const wallId = selection?.wallId ?? localWallId;
  const face = selection ? selection.face ?? '' : localFace;
  function chooseFace(nextWallId: string, nextFace?: 'a' | 'b') {
    if (onSelectionChange) onSelectionChange({ wallId: nextWallId, face: nextFace });
    else { setLocalWallId(nextWallId); setLocalFace(nextFace ?? ''); }
  }
  const wall = walls.find(item => item.id === wallId)
  const partition = wall?.role === 'partition'
  return <form className="inspector-block" onSubmit={event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (partition && !face) return
    onApply({ kind: 'wall-segment', wallId, start: fraction(String(data.get('start'))), end: fraction(String(data.get('end'))), ...(partition ? { face: face as 'a' | 'b' } : {}) })
  }}>
    <h3>벽 구간</h3>
    <p className="muted small">도면에서 벽을 선택하거나 아래에서 바꿀 수 있습니다. 창·문과 겹치지 않는 구간에 붙여 주세요.</p>
    <label className="field"><span>붙일 벽</span><select value={wallId} onChange={event => chooseFace(event.target.value, event.target.value === target?.wallId ? target.face : undefined)}>{walls.map(item => <option key={item.id} value={item.id}>{item.name}{item.role === 'partition' ? ' · 가벽' : ''}</option>)}</select></label>
    {partition && <fieldset className="wall-face-choice"><legend>가벽의 어느 면에 붙일까요?</legend><p className="muted small">도면의 A·B 표시를 누르거나 아래에서 면을 고르세요. 반대쪽에서는 이 요소가 보이지 않도록 시안 조건에 전달됩니다.</p>{(['a', 'b'] as const).map(value => <label key={value} className="wall-face-choice__option"><input type="radio" name="face" value={value} checked={face === value} onChange={() => chooseFace(wallId, value)} /><span>{wallFaceLabel(project, wallId, value)}</span></label>)}{!face && <p className="muted small" role="status">붙일 면을 선택해 주세요.</p>}</fieldset>}
    <div className="field-grid"><label className="field"><span>시작 (%)</span><input name="start" type="number" min="0" max="99" defaultValue={pct(target?.wallId === wallId ? target.start : .10)} /></label><label className="field"><span>끝 (%)</span><input name="end" type="number" min="1" max="100" defaultValue={pct(target?.wallId === wallId ? target.end : .30)} /></label></div>
    <Button type="submit" disabled={!wallId || Boolean(partition && !face)}>벽 구간 적용</Button>
  </form>
}
function FilePick({ label, onFile, accept = 'image/png,image/jpeg,image/webp', tone = 'secondary', disabled = false, icon = 'image', sourceIcon }: {
  label: string, onFile: (file: File) => void, accept?: string, tone?: 'primary' | 'secondary', disabled?: boolean, icon?: NucleoIconName, sourceIcon?: ReactNode,
}) {
  return <label className={`button button-${tone} file-pick`} aria-disabled={disabled} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (!disabled && file) onFile(file); }}>{sourceIcon ?? <NucleoIcon name={icon} />}<span>{label}</span><input type="file" disabled={disabled} accept={accept} onChange={(event) => {
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
  const [generationCameraIds, setGenerationCameraIds] = useState<string[] | null>(null)
  const [generationProgress, setGenerationProgress] = useState('')
  const [selectedCameraId, setSelectedCameraId] = useState(() => project.cameras.find((item) => item.primary)?.id ?? project.cameras[0]?.id ?? '')
  const [selectedResultId, setSelectedResultId] = useState(() => project.results.at(-1)?.id ?? '')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('')
  const [newConcept, setNewConcept] = useState('')
  const [elementLabel, setElementLabel] = useState('')
  const [elementKind, setElementKind] = useState<ElementKind>('freestanding-fixture')
  const [registrationLocation, setRegistrationLocation] = useState<{ referenceId: string, kind: ElementKind, target: PlacementTarget | null } | null>(null)
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [structureKind, setStructureKind] = useState<Structure['kind']>('wall')
  const [structureName, setStructureName] = useState('')
  const [structureX, setStructureX] = useState('50')
  const [structureY, setStructureY] = useState('50')
  const [structureEndX, setStructureEndX] = useState('65')
  const [structureEndY, setStructureEndY] = useState('50')
  const [structureParent, setStructureParent] = useState('')
  const [structureRole, setStructureRole] = useState<'base' | 'partition'>('partition')
  const [schematicShape, setSchematicShape] = useState<'landscape' | 'portrait' | 'outline'>('landscape')
  const [planReplacement, setPlanReplacement] = useState<'fresh' | 'retain'>('fresh')
  const [areaShape, setAreaShape] = useState<'rect' | 'polygon'>('rect')
  const [lineConstraint, setLineConstraint] = useState<'snap' | 'horizontal' | 'vertical' | 'free'>('snap')
  const [structureShape, setStructureShape] = useState<'rect' | 'circle'>('rect')
  const [structureWidth, setStructureWidth] = useState('8')
  const [structureDepth, setStructureDepth] = useState('10')
  const [structureRadius, setStructureRadius] = useState('2.5')
  const [structureLightTone, setStructureLightTone] = useState('온백색')
  const [layoutLightMount,setLayoutLightMount] = useState<'floor'|'wall'|'ceiling'>('floor');
  const [layoutTool,setLayoutTool] = useState<LayoutKind|null>(null);
  const [spaceSourceTab,setSpaceSourceTab] = useState<'photo'|'plan'>('photo');
  const [spaceOutlineEditing,setSpaceOutlineEditing] = useState(false);
  const [mappingIds,setMappingIds] = useState<string[]>([]);
  const [mappingMulti,setMappingMulti] = useState(false);
  const [mappingScope,setMappingScope] = useState<'appearance'|'lighting'|'material'>('appearance');
  const [mappingFace,setMappingFace] = useState<'a'|'b'>();
  const [mappingImageRole,setMappingImageRole] = useState<'inspiration'|'product'>('inspiration');
  const [layoutWallDraft,setLayoutWallDraft] = useState<{ kind: LayoutKind; elementKind: ElementKind; target: Extract<PlacementTarget,{kind:'wall-segment'}> } | null>(null);
  const [wallFaceDraft, setWallFaceDraft] = useState<(WallFaceSelection & { editorKey: string }) | null>(null);
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
  const [undoAction, setUndoAction] = useState<DeletionUndo | null>(() => loadDeletionUndo(project))
  const [placementSelection, setPlacementSelection] = useState<'element' | 'structure'>('element')
  const pageTitleRef = useRef<HTMLHeadingElement>(null)
  const projectLibraryDialog = useRef<HTMLDialogElement>(null)
  const stepNavRef = useRef<HTMLElement>(null)
  const referenceDeleteConfirmRef = useRef<HTMLElement>(null)
  const generationInFlightRef = useRef(false)
  const deletedAssetCandidatesRef = useRef(new Set<string>())
  const conditionEditStartedRef = useRef(0)
  const editHistoryRef = useRef(new Map<string, { past: (CommonPatch & { cameras: Camera[] })[], future: (CommonPatch & { cameras: Camera[] })[] }>())
  const historyApplyingRef = useRef(false)
  const preparedStudyRef = useRef<Project | null>(null)

  const selectedElement = project.elements.find((item) => item.id === selectedElementId)
  const wallEditorElement = placementSelection === 'element' && selectedElement && allowedTargetKinds(selectedElement.kind).includes('wall-segment') ? selectedElement : undefined;
  const wallEditorKey = layoutWallDraft ? `${project.id}-new-${layoutWallDraft.kind}-${layoutWallDraft.target.wallId}` : wallEditorElement ? `${project.id}-${wallEditorElement.id}-${JSON.stringify(wallEditorElement.target)}` : '';
  const wallEditorTarget = layoutWallDraft?.target ?? (wallEditorElement?.target?.kind === 'wall-segment' ? wallEditorElement.target : null);
  const wallEditorSelection: WallFaceSelection | undefined = wallEditorKey ? wallFaceDraft?.editorKey === wallEditorKey ? wallFaceDraft : { wallId: wallEditorTarget?.wallId ?? project.floorPlan?.structures.find(wall => wall.kind === 'wall')?.id ?? '', face: wallEditorTarget?.face } : undefined;
  function selectWallFace(wallId: string, face: 'a' | 'b') {
    if (wallEditorKey) setWallFaceDraft({ editorKey: wallEditorKey, wallId, face });
  }
  const selectedStructure = project.floorPlan?.structures.find((item) => item.id === selectedStructureId)
  const selectedCamera = project.cameras.find((item) => item.id === selectedCameraId) ?? project.cameras[0]
  const selectedResult = project.results.find((item) => item.id === selectedResultId) ?? project.results.at(-1)
  const preflight = useMemo(() => validatePreflight(project, selectedCameraId || undefined), [project, selectedCameraId])
  const unknownRetrySeconds = uncertainGenerationAt === null ? 0 : Math.max(0, Math.ceil((uncertainGenerationAt + UNKNOWN_GENERATION_RETRY_MS - generationClock) / 1000))

  useEffect(() => {
    if (!['camera','review'].includes(route.step)) return;
    const current=projectRef.current;
    if(route.projectId&&route.projectId!==current.id)return;
    const next=prepareRecommendedCameras(current);
    if(next!==current&&commit(next)) {
      if(!current.cameraRecommendationVersion)setSelectedCameraId(next.cameras.find(camera=>camera.primary)?.id??next.cameras[0]?.id??'');
    }
    // Camera preparation depends on geometry, not selection or editor drafts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[route.step,route.projectId,project.id,project.commonRevision]);

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
    setSelectedStructureId('')
    setSelectedElementId(restored.elements.find((item) => item.status === 'apply')?.id ?? '')
    setSelectedCameraId(restored.cameras.find((item) => item.primary)?.id ?? restored.cameras[0]?.id ?? '')
    setGenerationCameraIds(null)
    setSelectedResultId(restored.results.at(-1)?.id ?? '')
    setGenerationExistingPhotoId(restored.sourceImages.find((item) => item.role === 'existing-space')?.id ?? '')
    setPlanDetailTab('plan'); setPlanEditError(''); setStructureParent('')
    setMappingIds([]);setLayoutTool(null);setSpaceOutlineEditing(false);setReferenceFocus(''); setReferenceRegionMode('whole'); setReferenceRegionDraft(null)
    setRegionEditingElementId(null); setEditingElementId(null); setUndoAction(loadDeletionUndo(restored))
    setPlacementSelection('element'); setAlignmentChecked(false)
  }, [route.projectId, navigate])
  useEffect(() => {
    setPendingPlacement(null); setPendingReferenceDelete(null); setWallFaceDraft(null)
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
    if (kind === 'pillar') setStructureShape('rect')
    if (kind === 'existing-light') setStructureShape('circle')
    setStructureRole(role)
    setPlanDetailTab('structure')
    setPlanEditError('')
    setStructureName('')
    if (['window', 'door', 'entrance'].includes(kind)) {
      const wall = drawingWall()
      if (wall) selectDrawingWall(wall.id)
    }
  }
  function rejectPlanEdit(message: string) { experiment.record(planDetailTab === 'area' ? 'area_invalid' : 'structure_invalid', 'structure', selectedStructureId, { invalid_reason: 'invalid_geometry' }, 'invalid'); setError(message) }

  function showNotice(message: string) { setNotice(message); setNoticeSerial((value) => value + 1) }
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
      const inUndo = undoAction?.patch.sourceImages?.some((image) => image.uri === uri) || undoAction?.patch.floorPlan?.imageUri === uri
      const inProject = retainedProjects.some((item) => item.sourceImages.some((image) => image.uri === uri) || item.floorPlan?.imageUri === uri ||
        item.results.some((result) => result.imageUri === uri || result.conditionsSnapshot.common?.sourceImages?.some((image) => image.uri === uri)))
      const inHistory = [...editHistoryRef.current.values()].some(history => [...history.past, ...history.future].some(snapshot => snapshot.floorPlan?.imageUri === uri || snapshot.sourceImages?.some(image => image.uri === uri)))
      if (inUndo || inProject || inHistory) continue
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
    const resetsAt = generationStatus?.quota?.resetsAt
    if (step !== 'review' || busy || !resetsAt) return
    const timeout = window.setTimeout(() => {
      void getGenerationStatus().then(setGenerationStatus)
    }, Math.min(86_400_000, Math.max(1000, Date.parse(resetsAt) - Date.now() + 1000)))
    return () => window.clearTimeout(timeout)
  }, [step, busy, generationStatus?.quota?.resetsAt])

  useEffect(() => {
    if (step === 'references') document.querySelector('.element-panel')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [step, referenceFocus, selectedElementId])
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

  function editState(value: Project): CommonPatch & { cameras: Camera[] } {
    return structuredClone({ name: value.name, spaceType: value.spaceType, concept: value.concept, designGoal: value.designGoal, sourceImages: value.sourceImages, floorPlan: value.floorPlan, planAlignmentPending: value.planAlignmentPending, keeps: value.keeps, references: value.references, elements: value.elements, referenceBindings:value.referenceBindings, cameraRecommendationVersion:value.cameraRecommendationVersion, cameras: value.cameras })
  }
  function restoreEdit(direction: 'undo' | 'redo') {
    if (busy) return
    setWallFaceDraft(null)
    const current = projectRef.current, history = editHistoryRef.current.get(current.id)
    const from = direction === 'undo' ? history?.past : history?.future
    const snapshot = from?.at(-1)
    if (!history || !snapshot) { if (direction === 'undo') undoDeletion(); return }
    const { cameras, ...common } = snapshot
    let next = updateCommon(current, common)
    const changedCameras = new Set([...current.cameras, ...cameras].filter(camera => JSON.stringify(current.cameras.find(item => item.id === camera.id)) !== JSON.stringify(cameras.find(item => item.id === camera.id))).map(camera => camera.id))
    next = { ...next, cameras, results: next.results.map(result => changedCameras.has(result.cameraId) ? { ...result, stale: true } : result) }
    historyApplyingRef.current = true
    const saved = commit(next, direction === 'undo' ? '편집을 실행 취소했습니다.' : '편집을 다시 실행했습니다.')
    historyApplyingRef.current = false
    if (saved) { from!.pop(); (direction === 'undo' ? history.future : history.past).push(editState(current)) }
  }
  function commit(next: Project, message?: string, recovery = false): boolean {
    if (next === projectRef.current) return true
    const limit=!recovery&&!historyApplyingRef.current&&validatePrototypeAddition(projectRef.current,next);
    if(limit) { experiment.record(limit.event,'project',next.id,{count:limit.count,limit:limit.limit},'invalid'); setError(limit.message); return false; }
    try {
      saveProject(next)
      const previous = projectRef.current
      if (!historyApplyingRef.current && JSON.stringify(editState(previous)) !== JSON.stringify(editState(next))) {
        const history = editHistoryRef.current.get(previous.id) ?? { past: [], future: [] }
        history.past.push(editState(previous)); history.past = history.past.slice(-50); history.future = []
        editHistoryRef.current.set(previous.id, history)
      }
      experiment.changes(projectRef.current, next)
      setSaveFailed(false)
      projectRef.current = next
      setProject(next)
      setProjects(loadProjects())
      setError('')
      setUndoAction(loadDeletionUndo(next))
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
    setGenerationCameraIds(null)
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
    setPendingReferenceDelete(null); setUndoAction(loadDeletionUndo(restored)); setPlacementSelection('element')
    navigate({ step: 'space', projectId: restored.id })
    try { saveProject(restored); setProjects(loadProjects()); setSaveFailed(false) } catch (cause) { setSaveFailed(true); setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.') }
  }
  function createProject() {
    if (!newName.trim()) { setError('프로젝트 이름을 입력해 주세요.'); return }
    const next = updateCommon(migrateLayout(createEmptyProject(makeId('project'), newName.trim())), { spaceType: newType.trim(), concept: newConcept.trim() })
    if (!commit(next, '새 프로젝트를 만들었습니다.')) return
    setSelectedStructureId(''); setSelectedElementId(''); setSelectedCameraId(''); setGenerationCameraIds(null); setSelectedResultId('')
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
  function prepareStudy(participant: string, details: StudyProjectDetails, edited: (keyof StudyProjectDetails)[]): boolean {
    if (!STUDY_START.participantPattern.test(participant) || !details.projectName.trim() || !details.spaceType.trim()) return false;
    try {
      if (experiment.getSnapshot().fault) throw new Error(experiment.getSnapshot().fault);
      if (experiment.active) {
        if (experiment.active.participant_id !== participant) throw new Error('다른 참가자의 기록이 진행 중입니다. 저장한 프로젝트에서 기록을 먼저 종료해 주세요.');
        const saved = loadProjects().find(item => item.id === experiment.active?.project_id);
        if (!saved) throw new Error('진행 중인 기록의 프로젝트를 찾지 못했습니다. 실험 기록을 확인해 주세요.');
        const resumed = edited.length ? updateCommon(saved, {
          ...(edited.includes('projectName') ? { name: details.projectName.trim() } : {}),
          ...(edited.includes('spaceType') ? { spaceType: details.spaceType.trim() } : {}),
        }) : saved;
        if (resumed !== saved) saveProject(resumed);
        preparedStudyRef.current = resumed;
        return true;
      }
      const next = createStudyProject(crypto.randomUUID(), details);
      saveProject(next);
      experiment.start(participant, STUDY_START.task, next, 'space');
      if (experiment.getSnapshot().fault) throw new Error(experiment.getSnapshot().fault);
      preparedStudyRef.current = next;
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '프로젝트를 시작하지 못했습니다.');
      return false;
    }
  }
  function editElement(id: string) {
    const element = project.elements.find((item) => item.id === id)
    if (!element) { go('references'); setError('현재 작업에서 삭제한 요소입니다. 이전 결과의 조건 기록은 보관되어 있습니다.'); return }
    if (element.status === 'exclude') { go('references'); setSelectedElementId(id); setReferenceFocus(element.sourceReferenceId); return }
    setPlanDetailTab('plan'); setLayoutTool(null); setSelectedAreaId('')
    go('placement'); setPlacementSelection('element'); setSelectedElementId(id)
  }
  function selectPlacementStructure(id: string) { setSelectedAreaId(''); setSelectedStructureId(id); setPlacementSelection('structure'); setPendingPlacement(null); setPlanEditError('') }
  function selectPlacementElement(id: string) { setSelectedAreaId(''); setLayoutWallDraft(null); setSelectedElementId(id); setPlacementSelection('element'); setPendingPlacement(null); setPlanEditError('') }
  function editStructurePosition(id: string) { setPlanDetailTab('plan'); setLayoutTool(null); setSelectedAreaId(''); go('placement'); selectPlacementStructure(id) }

  function commitDeletion(next: Project, label: string, focus: { referenceId?: string, structureId?: string } = {}) {
    const previous = projectRef.current
    const patch: CommonPatch = {}
    for (const key of ['sourceImages', 'references', 'elements', 'floorPlan', 'keeps', 'planAlignmentPending', 'referenceBindings'] as const) {
      if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) Object.assign(patch, { [key]: previous[key] })
    }
    const action: DeletionUndo = { projectId: previous.id, revision: next.commonRevision, patch, label, ...focus }
    let rollback: () => void
    try { rollback = prepareDeletionUndo(action) }
    catch { setError('삭제 복구 기록을 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 삭제해 주세요.'); return false }
    if (!commit(next, `${label}했습니다.`)) {
      try { rollback() } catch { /* A mismatched revision is never offered for recovery. */ }
      return false
    }
    for (const image of previous.sourceImages) {
      if (image.uri.startsWith('asset://') && !next.sourceImages.some((item) => item.uri === image.uri)) deletedAssetCandidatesRef.current.add(image.uri)
    }
    setUndoAction(action)
    return true
  }
  function undoDeletion() {
    if (!undoAction || undoAction.projectId !== project.id || undoAction.revision !== project.commonRevision) return
    const focus = undoAction
    if (!commit(updateCommon(project, undoAction.patch), '삭제를 되돌렸습니다.', true)) return
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
  function deleteLayoutSelection(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (step !== 'placement' || event.key !== 'Backspace' || event.defaultPrevented || busy ||
        event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing ||
        planDetailTab !== 'plan' || layoutTool || layoutWallDraft || pendingPlacement ||
        placementSelection !== 'element' || selectedAreaId || !selectedElement) return
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"]')) return
    event.preventDefault()
    // Holding the key must not delete the next automatically selected object.
    if (!event.repeat) deleteElement(selectedElement)
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
  function openAreaDrawing(kind: Area['kind']) {
    setAreaKind(kind); setPlanDetailTab('area'); setPlanEditError(''); go('placement')
  }
  function applyElementTarget(elementId: string, target: PlacementTarget, acknowledgedWarnings = false) {
    if (!acknowledgedWarnings) experiment.record('placement_start', 'element', elementId, targetPayload(target))
    const placed = placeElement(project, elementId, target)
    if (!placed.validation.valid) { experiment.record('placement_invalid', 'element', elementId, { ...targetPayload(target), invalid_reason: placed.validation.issues.map((issue) => issue.code).join(',') }, 'invalid'); setPendingPlacement(null); rejectPlanEdit(placed.validation.issues.map((item) => item.message).join(' ')); return }
    const warnings = placed.validation.issues.filter((issue) => issue.severity === 'warning' && issue.code !== 'keep-conflict').map((issue) => issue.message)
    if (warnings.length && !acknowledgedWarnings && !project.elements.find(item => item.id === elementId)?.target) { setPendingPlacement({ elementId, target, warnings }); setError(''); return }
    setPendingPlacement(null)
    if (commit(placed.project, `${project.elements.find((item) => item.id === elementId)?.label ?? '요소'}의 배치를 저장했습니다.`)) setPlanEditError('')
  }
  function applyCameraChange(cameraId: string, patch: Partial<Omit<Camera, 'id'>>) {
    const next = updateCamera(project, cameraId, patch)
    const checked = validateCamera(next, cameraId)
    if (!checked.valid) { rejectPlanEdit(checked.issues.map((issue) => issue.message).join(' ')); return }
    if (commit(next, '카메라 위치와 방향을 저장했습니다.')) setPlanEditError('')
  }
  function renderWorkspaceToolbar(leftLabel: string) {
    return <div className="workspace-toolbar" aria-label="작업 패널 표시"><Button tone="quiet" pressed={showWorkspaceLeft} onClick={() => setShowWorkspaceLeft((value) => !value)}>{leftLabel} {showWorkspaceLeft ? '숨기기' : '보이기'}</Button><Button tone="quiet" pressed={showWorkspaceRight} onClick={() => setShowWorkspaceRight((value) => !value)}>속성 {showWorkspaceRight ? '숨기기' : '보이기'}</Button></div>
  }
  async function uploadImage(file: File, role: SourceImage['role'], referenceRole?: Reference['role']) {
    if(referenceRole&&countReferenceImages(projectRef.current)>=MAX_REFERENCE_IMAGES) {
      experiment.record('reference_limit_reached','project',projectRef.current.id,{count:countReferenceImages(projectRef.current),limit:MAX_REFERENCE_IMAGES},'invalid');
      setError(REFERENCE_LIMIT_MESSAGE); return;
    }
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
      if (referenceId) { setSelectedElementId(''); setEditingElementId(null); setElementKind(referenceRole === 'product' ? 'display-product' : referenceRole === 'ambience' ? 'ambient-light' : 'freestanding-fixture'); setRegistrationLocation(null); setElementLabel(''); setReferenceFocus(referenceId); setReferenceRegionMode('whole'); setReferenceRegionDraft(null); setRegionEditingElementId(null) }
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
      if (previous && planReplacement === 'retain') { next.structures = previous.structures; next.areas = previous.areas }
      const fresh = Boolean(previous && planReplacement === 'fresh')
      const updated = updateCommon(current, { floorPlan: next, planAlignmentPending: true, ...(fresh ? { keeps: [], elements: current.elements.map(item => ({ ...item, target: item.target?.kind === 'whole-space' ? item.target : null })) } : {}) })
      if (!(fresh ? commitDeletion(updated, '새 도면으로 표시를 교체') : commit(updated, '도면을 등록했습니다. 사용 바닥과 구조를 직접 표시하고 대응을 확인하세요.'))) {
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
    if (structureKind !== 'pillar' && structureKind !== 'existing-light' && x === endX && y === endY) { rejectPlanEdit('선의 시작점에서 끝점까지 누른 채 끌어 주세요.'); return }
    const name = displayName(project.floorPlan.structures.map(item => item.name), structureName, STRUCTURE_LABELS[structureKind])
    const id = makeId('structure')
    const segment = { kind: 'segment' as const, start: { x, y }, end: { x: endX, y: endY } }
    const geometry = ['pillar', 'existing-light'].includes(structureKind) ? structureShape === 'rect' ? { kind: 'rect' as const, bounds: { x, y, width: fraction(structureWidth), height: fraction(structureDepth) } } : { kind: 'circle' as const, center: { x, y }, radius: fraction(structureRadius) } : segment
    const requiresWall = ['window','door','entrance'].includes(structureKind)
    const parentWallId = requiresWall ? coordinates?.wallId ?? drawingWall()?.id : undefined
    const wall = project.floorPlan.structures.find((item) => item.id === parentWallId)
    if (requiresWall && (!wall || wall.kind !== 'wall')) { rejectPlanEdit('창·문·출입구를 붙일 벽이 없습니다. 먼저 ‘기존 벽’으로 벽 선을 표시하세요.'); return }
    const wallSpan = requiresWall ? spanOnWall(wall, { x, y }, { x: endX, y: endY }) : undefined
    if (requiresWall && (!wallSpan || wallSpan.start === wallSpan.end)) { rejectPlanEdit(`‘${wall?.name ?? '연결 벽'}’ 선을 따라 시작점에서 끝점까지 끌어 주세요. 벽 이름이 도면 위에 표시됩니다.`); return }
    const immutable = structureKind !== 'wall' || structureRole === 'base'
    const structure: Structure = { id, kind: structureKind, name, geometry, role: structureKind === 'wall' ? structureRole : 'base', immutable, protected: immutable, parentWallId,
      wallSpan, lightTone: structureKind === 'existing-light' ? structureLightTone.trim() || '온백색' : undefined,
      ...(structureKind==='door'?{doorSwing:{hinge:'start' as const,side:1 as const}}:{}),
      clearance: (structureKind === 'door' || structureKind === 'entrance') && wall ? entranceClearance(project.floorPlan, wall, { x, y }, { x: endX, y: endY }) : undefined }
    const checked = validateStructureDrawing(project, structure)
    if (!checked.valid) { rejectPlanEdit(checked.issues.map((issue) => issue.message).join(' ')); return }
    const keep = immutable ? { id: makeId('keep'), structureId: id, intent: 'preserve' as const, description: `${name}의 위치와 형태 보존` } : undefined
    if (!commit(updateCommon(project, { floorPlan: { ...project.floorPlan, structures: [...project.floorPlan.structures, structure] }, keeps: keep ? [...project.keeps, keep] : project.keeps }), immutable ? '필수 보존 기본 구조를 추가했습니다.' : '수정 가능한 가벽을 추가했습니다.')) return
    setSelectedStructureId(id); setStructureName(''); setPlanEditError('')
  }
  function createSchematicPlan() {
    const plan = newPlan('schematic', undefined, schematicShape)
    const keeps = plan.structures.map((structure) => ({
      id: makeId('keep'), structureId: structure.id, intent: 'preserve' as const,
      description: `${structure.name}의 위치와 형태 보존`,
    }))
    commit(updateCommon(project, { floorPlan: plan, keeps }), '개략 도면을 만들었습니다. 치수는 확인되지 않았습니다.')
    if (schematicShape === 'outline') { setAreaKind('floor'); setAreaShape('polygon'); setPlanDetailTab('area') }
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
  function addArea(bounds?: { x: number, y: number, width: number, height: number }, outline?: Point[]) {
    if (!project.floorPlan) { rejectPlanEdit('먼저 평면도를 준비해 주세요.'); return }
    const x = bounds?.x ?? fraction(areaX), y = bounds?.y ?? fraction(areaY)
    const width = bounds?.width ?? fraction(areaWidth), height = bounds?.height ?? fraction(areaHeight)
    if ([x,y,width,height].some((value) => !Number.isFinite(value)) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
      rejectPlanEdit('영역의 위치와 크기가 도면의 0–100% 범위 안에 들어야 합니다.'); return
    }
    const area: Area = { id: makeId('area'), name: displayName(project.floorPlan.areas.map(item => item.name), areaName, `${areaKind === 'spatial' ? '공간' : areaKind === 'passage' ? '동선' : areaKind === 'floor' ? '바닥' : '천장'} 영역`), kind: areaKind, bounds: { x, y, width, height }, ...(outline ? { outline } : {}) }
    const checked = validateAreaDrawing(project, area)
    if (!checked.valid) { rejectPlanEdit(checked.issues.map((issue) => issue.message).join(' ')); return }
    if (!commit(updateCommon(project, { floorPlan: { ...project.floorPlan, areas: [...project.floorPlan.areas, area] } }), '평면도 영역을 추가했습니다.')) return
    setAreaName(''); setPlanEditError(''); setSelectedAreaId(area.id)
    return true
  }
  function updateArea(area: Area, form: HTMLFormElement) {
    if (!project.floorPlan) return
    const data = new FormData(form)
    const bounds = { x: fraction(String(data.get('x'))), y: fraction(String(data.get('y'))), width: fraction(String(data.get('width'))), height: fraction(String(data.get('height'))) }
    if (Object.values(bounds).some(value => !Number.isFinite(value)) || bounds.x < 0 || bounds.y < 0 || bounds.width <= 0 || bounds.height <= 0 || bounds.x + bounds.width > 1 || bounds.y + bounds.height > 1) {
      rejectPlanEdit('영역의 위치와 크기를 도면의 0–100% 안으로 입력해 주세요.'); return
    }
    const outline = area.outline?.map(point => ({ x: bounds.x + (point.x - area.bounds.x) / area.bounds.width * bounds.width, y: bounds.y + (point.y - area.bounds.y) / area.bounds.height * bounds.height }))
    const edited: Area = { ...area, name: displayName(project.floorPlan.areas.filter(item => item.id !== area.id).map(item => item.name), String(data.get('name') ?? ''), `${area.kind === 'spatial' ? '공간' : area.kind === 'passage' ? '동선' : area.kind === 'floor' ? '바닥' : '천장'} 영역`), bounds, ...(outline ? { outline } : {}) }
    const checked = validateAreaDrawing(project, edited, area.id)
    if (!checked.valid) { rejectPlanEdit(checked.issues.map(issue => issue.message).join(' ')); return }
    if (commit(updateCommon(project, { floorPlan: { ...project.floorPlan, areas: project.floorPlan.areas.map(item => item.id === area.id ? edited : item) } }), `${edited.name}의 이름과 범위를 저장했습니다.`)) setPlanEditError('')
  }
  function drawStructure(start: { x: number, y: number }, end: { x: number, y: number }, wallId?: string) {
    if (['pillar', 'existing-light'].includes(structureKind) && structureShape === 'rect') {
      addStructure({ start: { x: start.x - fraction(structureWidth) / 2, y: start.y - fraction(structureDepth) / 2 }, end: start })
      return
    }
    if (['pillar', 'existing-light'].includes(structureKind)) {
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
  function createBasicSupport(product: DesignElement) {
    if(countLayoutItems(projectRef.current)>=MAX_LAYOUT_ITEMS) { setError(LAYOUT_LIMIT_MESSAGE); return; }
    const reference = project.references.find(item => item.id === product.sourceReferenceId)
    if (product.kind !== 'display-product' || !reference && project.layoutVersion !== 2) return
    const id = makeId('element')
    const support: DesignElement = project.layoutVersion === 2 ? { ...createLayoutItem(project,id,'display'), conditions:'사용자가 직접 추가한 기본 전시대. 제품 사진에서 추출한 형태가 아닙니다.' } : { id, sourceReferenceId: reference!.id, label: `${product.label} 진열대`, kind: 'freestanding-fixture', origin: 'basic-support', status: 'apply', target: null, conditions: '사용자가 추가한 기본 진열대. 제품 사진에서 추출한 형태가 아닙니다.', appearance: '단순한 진열대.' }
    if (!commit(updateCommon(project, { references: reference && support.origin === 'basic-support' ? project.references.map(item => item.id === reference.id ? { ...item, extractedElements: [...item.extractedElements, id] } : item) : project.references, elements: [...project.elements.map(item => item.id === product.id ? { ...item, target: { kind: 'fixture-surface' as const, fixtureElementId: id, offset: { x: .5, y: .5 } } } : item), support] }), '기본 전시대를 추가하고 상품을 연결했습니다. 도면에서 전시대를 놓을 바닥 위치를 누르세요.')) return
    setLayoutTool(null); setPlanDetailTab('plan'); go('placement'); selectPlacementElement(id)
  }
  function reshapeSelected(structure: Structure, geometry: Structure['geometry']) {
    const changed = reshapeStructure(project, structure.id, geometry)
    if (!changed.validation.valid) { rejectPlanEdit(changed.validation.issues.map(item => item.message).join(' ')); return false }
    return commit(changed.project, `${structure.name}의 도면 모양을 저장했습니다.`)
  }
  function removeArea(area: Area) {
    if (!project.floorPlan) return
    const elements = project.elements.map(item => item.target && ('areaId' in item.target && item.target.areaId === area.id || 'zoneId' in item.target && item.target.zoneId === area.id) ? { ...item, target: null } : item)
    commitDeletion(updateCommon(project, { floorPlan: { ...project.floorPlan, areas: project.floorPlan.areas.filter(item => item.id !== area.id) }, elements }), '영역과 연결 배치를 삭제')
  }
  function toggleKeep(structure: Structure) {
    if (structure.preservationRequired) { setError('기본 구조는 보존을 해제할 수 없습니다. 호환되는 벽면 연출·조명은 적용할 수 있습니다.'); return; }
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
      {structure.kind === 'door' && <label className="field"><span>문 열림 기호</span><select disabled={structure.preservationRequired} value={structure.doorSwing ? `${structure.doorSwing.hinge}:${structure.doorSwing.side}` : ''} onChange={event => {
        if (!project.floorPlan) return
        const [hinge, side] = event.target.value.split(':')
        const doorSwing = hinge ? { hinge: hinge as 'start' | 'end', side: Number(side) as 1 | -1 } : undefined
        commit(updateCommon(project, { floorPlan: { ...project.floorPlan, structures: project.floorPlan.structures.map(item => item.id === structure.id ? { ...item, doorSwing } : item) } }))
      }}><option value="">미지정 · 닫힌 문 표시</option><option value="start:1">시작점 경첩 · 방향 1</option><option value="start:-1">시작점 경첩 · 방향 2</option><option value="end:1">끝점 경첩 · 방향 1</option><option value="end:-1">끝점 경첩 · 방향 2</option></select><small>실제 문을 보고 도면 기호를 맞추세요. 비워 둘 범위는 기존 빗금 표시를 따릅니다.</small></label>}
      <button type="button" className="preservation-switch" role="switch" aria-checked={locked} disabled={structure.preservationRequired} aria-label={`${structure.name} 필수 보존 (위치 고정)`} onClick={() => toggleKeep(structure)}>
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
        {!opening && <form className="structure-reshape" key={`${structure.id}-${JSON.stringify(structure.geometry)}`} onSubmit={event => {
          event.preventDefault(); const data = new FormData(event.currentTarget)
          if (structure.geometry.kind === 'segment') reshapeSelected(structure, { ...structure.geometry, end: { x: fraction(String(data.get('endX'))), y: fraction(String(data.get('endY'))) } })
          else if (data.get('shape') === 'circle') { const center = structure.geometry.kind === 'circle' ? structure.geometry.center : { x: structure.geometry.bounds.x + structure.geometry.bounds.width / 2, y: structure.geometry.bounds.y + structure.geometry.bounds.height / 2 }; reshapeSelected(structure, { kind: 'circle', center, radius: fraction(String(data.get('radius'))) }) }
          else { const size = { width: fraction(String(data.get('width'))), height: fraction(String(data.get('depth'))) }; const center = structure.geometry.kind === 'circle' ? structure.geometry.center : { x: structure.geometry.bounds.x + structure.geometry.bounds.width / 2, y: structure.geometry.bounds.y + structure.geometry.bounds.height / 2 }; reshapeSelected(structure, { kind: 'rect', bounds: { x: center.x - size.width / 2, y: center.y - size.height / 2, ...size } }) }
        }}><h4>모양·방향 수정</h4>{structure.geometry.kind === 'segment' ? <><div className="field-row"><label className="field"><span>끝 X (%)</span><input name="endX" type="number" min="0" max="100" defaultValue={pct(structure.geometry.end.x)} /></label><label className="field"><span>끝 Y (%)</span><input name="endY" type="number" min="0" max="100" defaultValue={pct(structure.geometry.end.y)} /></label></div><div className="keep-actions"><Button disabled={!!movementReason} onClick={() => { if (structure.geometry.kind === 'segment') reshapeSelected(structure, { ...structure.geometry, end: { x: structure.geometry.end.x, y: structure.geometry.start.y } }) }}>수평으로 맞추기</Button><Button disabled={!!movementReason} onClick={() => { if (structure.geometry.kind === 'segment') reshapeSelected(structure, { ...structure.geometry, end: { x: structure.geometry.start.x, y: structure.geometry.end.y } }) }}>수직으로 맞추기</Button></div></> : <><label className="field"><span>모양</span><select name="shape" defaultValue={structure.geometry.kind}><option value="rect">사각형</option><option value="circle">원형</option></select></label><div className="field-row"><label className="field"><span>사각형 폭 (%)</span><input name="width" type="number" min="1" max="100" defaultValue={structure.geometry.kind === 'rect' ? pct(structure.geometry.bounds.width) : 8} /></label><label className="field"><span>사각형 깊이 (%)</span><input name="depth" type="number" min="1" max="100" defaultValue={structure.geometry.kind === 'rect' ? pct(structure.geometry.bounds.height) : 10} /></label></div><label className="field"><span>원 반지름 (% · 짧은 변 기준)</span><input name="radius" type="number" min=".5" max="50" step=".5" defaultValue={structure.geometry.kind === 'circle' ? structure.geometry.radius * 100 : 2.5} /></label></>}<Button type="submit" disabled={!!movementReason}>모양 변경 적용</Button></form>}
        <div className="keep-actions"><Button icon="edit" onClick={() => editStructurePosition(structure.id)}>공간 배치에서 편집</Button><Button tone="danger" icon="trash" onClick={() => deleteStructure(structure)}>구조 삭제</Button></div>
      </>}
      {structure.kind === 'existing-light' && <label className="field"><span>기존 조명 색감</span><input defaultValue={structure.lightTone ?? '온백색'} key={`${structure.id}-tone`} onBlur={(event) => {
        if (!project.floorPlan) return
        const lightTone = event.target.value.trim() || '온백색'
        commit(updateCommon(project, { floorPlan: { ...project.floorPlan, structures: project.floorPlan.structures.map((item) => item.id === structure.id ? { ...item, lightTone } : item) } }), '기존 조명 색감을 저장했습니다.')
      }} /><small>{locked ? '보존 중에는 색감만 변경할 수 있습니다.' : '위치와 색감을 수정할 수 있습니다.'}</small></label>}
      {keep && <><label className="field"><span>보존 설명</span><textarea rows={3} defaultValue={keep.description} key={keep.id} onBlur={(event) => commit(updateKeep(project, keep.id, { description: event.target.value }))} /></label>{structure.kind === 'wall' && <p className="muted small">필수 보존은 벽 자체를 유지합니다. 탈착식 그래픽·조명은 배치할 수 있으며 고정 방식은 직접 확인해 주세요.</p>}</>}
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
          <div className="campus-example"><AssetImage uri="/sample/campus/projectroom-front.jpg" alt="한국공학대학교 디자인공학부 프로젝트룸의 화이트보드와 출입문 사진" /><div><p className="eyebrow">실제 공간으로 시작</p><h3>한국공학대학교 프로젝트룸을 졸업전시 공간으로</h3><p>학교 공식 사진과 개략 도면을 확인하고, 작품 배치를 만든 뒤 참고 디자인을 연결해 보세요.</p><div className="campus-example-actions"><Button tone="primary" onClick={() => open(projects.find(item => item.id === `${CAMPUS_PREFIX}exhibition`) ?? createCampusProject('exhibition'))}>졸업전시 구상 시작</Button><Button onClick={() => open(projects.find(item => item.id === `${CAMPUS_PREFIX}popup`) ?? createCampusProject('popup'))}>같은 공간 · 팝업 구상</Button></div><p className="small">사진: 한국공학대학교 디자인공학부. 도면과 연출은 실측·실제 행사 결과가 아닌 기획 예시입니다. <a href={CAMPUS_SOURCE} target="_blank" rel="noopener noreferrer">공간 사진 출처</a></p></div></div>
          <details className="other-examples"><summary>다른 예시 · AURA 팝업</summary><button className="project-card sample-card" onClick={() => open(sampleSaved ?? createSampleProject())}>
            <AssetImage uri="/sample/result.png" alt="AURA POP-UP 사전 준비된 데모 결과" />
            <span className="project-card-body"><span className="project-card-top"><strong>AURA POP-UP</strong><Badge tone="info">샘플</Badge></span><span>기존 벽·창·기둥을 보존하는 코스메틱 팝업</span><span className="meta">공간 자료부터 결과 검토까지 살펴보기</span></span>
          </button></details>
          {others.map((item) => <button key={item.id} className="project-card project-card-plain" onClick={() => open(item)}><span className="project-monogram" aria-hidden="true">{item.name.slice(0, 1)}</span><span className="project-card-body"><strong>{item.name}</strong><span>{item.spaceType || '공간 유형 미입력'}</span><span className="meta">{item.results.length}개 결과 · {countLayoutItems(item)}개 배치 요소</span></span></button>)}
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
    const planOrigin = project.floorPlan?.kind === 'uploaded' ? '사용자 업로드 도면' : project.id.startsWith(CAMPUS_PREFIX) ? '사진 참고 · 설명용 개략 도면' : project.id === 'aura-popup' ? '사전 준비된 샘플 개략 도면' : '직접 작성하는 개략 도면'
    const planExplanation = project.floorPlan?.kind === 'uploaded'
      ? '업로드한 이미지를 2D 배치 바탕으로 사용합니다. 벽·사용 바닥·동선은 직접 표시해야 하며 사진이나 도면에서 자동으로 추출하지 않습니다.'
      : project.id === 'aura-popup'
        ? 'AURA POP-UP 예시를 위해 미리 등록한 개략 배치입니다. 왼쪽 사진을 분석해 만든 도면이나 실측 결과가 아닙니다.'
        : '가로·세로 사각형 또는 직접 그린 윤곽을 사용하는 개략 배치 캔버스입니다. 곡선은 점을 여러 개 찍어 가까운 형태로 표시하며 실측 결과가 아닙니다.'
    return <div className="space-screen">
      {project.planAlignmentPending && <details className="plan-alignment-details"><summary>새 도면 확인 필요 · 바닥과 배치를 확인하세요</summary><section className="plan-alignment-alert" aria-labelledby="plan-alignment-title"><div><h3 id="plan-alignment-title">새 도면과 표시가 맞는지 확인하세요</h3><p>사용 바닥·구조·배치·시점을 확인한 뒤 완료하세요.</p>{!project.floorPlan?.areas.some((area) => area.kind === 'floor') && <p className="plan-alignment-alert__required">공간·방향 설정에서 실내 윤곽을 먼저 표시하세요.</p>}</div><div className="plan-alignment-alert__actions"><label className="checkbox-row"><input type="checkbox" checked={alignmentChecked} onChange={(event) => setAlignmentChecked(event.target.checked)} /><span>새 도면의 바닥·구조·배치·시점을 확인했습니다</span></label><Button tone="primary" disabled={!alignmentChecked || !project.floorPlan?.areas.some((area) => area.kind === 'floor')} onClick={() => { commit(updateCommon(project, { planAlignmentPending: false }), '평면도 대응 확인을 저장했습니다.'); setAlignmentChecked(false) }}>도면 대응 확인 완료</Button></div></section></details>}
      <div className={`space-two-col ${planDetailTab !== 'plan' ? 'is-editing-plan' : ''}`}>
        <section className="surface-panel" aria-labelledby="existing-title"><div className="panel-heading"><div><p className="eyebrow">01 · 실제 공간</p><h2 id="existing-title">기존 공간 사진</h2></div><FilePick label={busy ? "등록 중…" : "사진 추가"} disabled={busy} onFile={(file) => uploadImage(file, 'existing-space')} /></div>
          {project.id.startsWith(CAMPUS_PREFIX) && <details className="source-provenance"><summary>학교 사진·개략 도면의 기준</summary><p>사진: 한국공학대학교 디자인공학부 공식 프로젝트룸 안내. 촬영일과 현재 모습은 확인되지 않았습니다. 도면은 설명을 위해 직접 정한 개략 배치이며 실측·사진 자동 분석 결과가 아닙니다. 기존 책상·의자의 임시 이동과 공간 사용은 시나리오의 가정입니다.</p><a href={CAMPUS_SOURCE} target="_blank" rel="noopener noreferrer">원본 사진과 공간 설명 보기</a></details>}
          {existing.length ? <div className="photo-carousel-wrap"><SwipeCarousel label="기존 공간 사진" variant="photo" items={existing.map((image) => ({ id: image.id, content: <figure><AssetImage uri={image.uri} alt={`${image.name} · 기존 공간 사진`} className="space-photo" /><figcaption>{image.name}<span>현장 외관 참고 · 치수 근거 아님</span></figcaption></figure> }))} /></div> : <Empty>실제 공간 사진을 추가하세요. 분위기 레퍼런스를 대신 사용할 수 없습니다.</Empty>}
        </section>
        <section className={`surface-panel space-plan-panel ${planDetailTab !== 'plan' ? 'is-drawing' : ''}`} aria-labelledby="plan-title"><div className="panel-heading"><div><p className="eyebrow">02 · 배치 기준</p><h2 id="plan-title">평면도</h2></div><FilePick label={busy ? "등록 중…" : "도면 업로드"} disabled={busy} onFile={uploadPlan} /></div>
          {project.floorPlan ? <div className="plan-panel-content">
            <div className="plan-origin" role="note"><details><summary><Badge tone="info">{planOrigin}</Badge> 도면 안내·업로드 옵션</summary><label className="field plan-replacement-choice"><span>새 도면 업로드 시 표시 처리</span><select value={planReplacement} onChange={event => setPlanReplacement(event.target.value as 'fresh' | 'retain')}><option value="fresh">새 도면 위에 다시 표시 (기존 배치 해제·되돌리기 가능)</option><option value="retain">기존 표시 유지 후 새 도면에 맞추기</option></select></label>
              <p><strong>도면은 Keep·요소 배치·시점의 2D 기준입니다.</strong></p><p>{planExplanation}</p><p>사진은 공간의 모습 참고용이며 도면 좌표와 별도로 보관됩니다. 공간 사진을 올려도 도면이 자동으로 만들어지지는 않습니다.</p></details>
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
              {structureKind === 'wall' && <label className="field"><span>벽 방향</span><select value={lineConstraint} onChange={e => setLineConstraint(e.target.value as typeof lineConstraint)}><option value="snap">수평·수직 가까우면 맞추기</option><option value="horizontal">수평으로 그리기</option><option value="vertical">수직으로 그리기</option><option value="free">자유 방향</option></select></label>}
              {['pillar', 'existing-light'].includes(structureKind) && <div className="plan-shape-options"><label className="field"><span>표시 모양</span><select value={structureShape} onChange={e => setStructureShape(e.target.value as 'rect' | 'circle')}><option value="rect">사각형</option><option value="circle">원형</option></select></label><div className="field-row">{structureShape === 'rect' ? <><label className="field"><span>폭 (%)</span><input type="number" min="1" max="100" value={structureWidth} onChange={e => setStructureWidth(e.target.value)} /></label><label className="field"><span>깊이 (%)</span><input type="number" min="1" max="100" value={structureDepth} onChange={e => setStructureDepth(e.target.value)} /></label></> : <label className="field"><span>반지름 (% · 짧은 변 기준)</span><input type="number" min=".5" max="50" step=".5" value={structureRadius} onChange={e => setStructureRadius(e.target.value)} /></label>}</div></div>}
              <div className="plan-edit-tools__fields"><label className="field"><span>구조 이름</span><input value={structureName} onChange={(event) => setStructureName(event.target.value)} placeholder={`비우면 ${STRUCTURE_LABELS[structureKind]} (1)`} /></label>{structureKind === 'existing-light' && <label className="field"><span>조명 색감</span><input value={structureLightTone} onChange={(event) => setStructureLightTone(event.target.value)} placeholder="예: 온백색" /></label>}</div>
            {planDetailTab === 'structure' && <details className="plan-numeric-fallback"><summary>좌표로 구조 표시 (키보드 대체)</summary><p>도면 왼쪽 위가 0%, 오른쪽 아래가 100%입니다.{hostWall && ` ‘${hostWall.name}’의 한 구간을 미리 입력했습니다. 시작과 끝을 같은 벽 위에 유지하세요.`}</p><div className="structure-form">
              <label className="field compact-field"><span>시작 X (%)</span><input type="number" min="0" max="100" value={structureX} onChange={(event) => setStructureX(event.target.value)} /></label>
              <label className="field compact-field"><span>시작 Y (%)</span><input type="number" min="0" max="100" value={structureY} onChange={(event) => setStructureY(event.target.value)} /></label>
              {!['pillar','existing-light'].includes(structureKind) && <><label className="field compact-field"><span>끝 X (%)</span><input type="number" min="0" max="100" value={structureEndX} onChange={(event) => setStructureEndX(event.target.value)} /></label><label className="field compact-field"><span>끝 Y (%)</span><input type="number" min="0" max="100" value={structureEndY} onChange={(event) => setStructureEndY(event.target.value)} /></label></>}
              <Button icon="add" onClick={() => addStructure()}>입력한 구조 추가</Button>
            </div></details>}
            </div>}
            {planDetailTab === 'area' && <div className="plan-edit-tools" aria-label="영역과 동선 그리기 도구">
              <h3>1. 표시할 범위 선택</h3>
              <div className="plan-tool-grid plan-tool-grid--areas" role="group" aria-label="표시할 범위">{areaTools.map((tool) => <button key={tool.kind} type="button" aria-pressed={areaKind === tool.kind} onClick={() => { setAreaKind(tool.kind); setPlanEditError('') }}><span>{tool.label}</span><small>{tool.description}</small></button>)}</div>
              <label className="field"><span>그릴 모양</span><select value={areaShape} onChange={e => setAreaShape(e.target.value as 'rect' | 'polygon')}><option value="rect">사각형 드래그</option><option value="polygon">윤곽 따라 점 찍기</option></select></label><div className="plan-gesture-cue"><strong>2. {areaShape === 'polygon' ? '모서리를 순서대로 누른 뒤 윤곽 저장을 누르세요' : `${currentAreaTool.label}의 한쪽 모서리 → 대각선 모서리로 끌어 주세요`}</strong><p>{areaShape === 'polygon' ? '실제 윤곽을 따라 표시합니다. 곡선은 여러 점으로 근사합니다.' : '사각형 범위를 표시합니다.'} 영역은 물건이 아니므로 사용 바닥·천장·분위기 범위는 같은 위치에 겹칠 수 있습니다. 같은 종류의 범위를 같은 위치·크기로 중복 표시하거나 가구·기둥·가벽을 가로질러 동선을 그릴 수는 없습니다.</p></div>
              <label className="field"><span>영역 이름</span><input value={areaName} onChange={(event) => setAreaName(event.target.value)} placeholder="비우면 공간 영역 (1)처럼 표시" /></label>
            {planDetailTab === 'area' && project.floorPlan.areas.length > 0 && <div className="plan-area-list"><h3>그린 영역 · {project.floorPlan.areas.length}개</h3><div className="plan-area-list__items">{project.floorPlan.areas.map(area => <button type="button" className={selectedAreaId === area.id ? 'is-selected' : ''} aria-pressed={selectedAreaId === area.id} key={area.id} onClick={() => setSelectedAreaId(area.id)}>{area.name}<small>{area.outline ? '직접 그린 윤곽' : '사각형'}</small></button>)}</div>{project.floorPlan.areas.filter(area => area.id === selectedAreaId).map(area => <form key={area.id} className="plan-area-edit" onSubmit={event => { event.preventDefault(); updateArea(area, event.currentTarget) }}><strong>선택한 영역 수정</strong><label className="field"><span>이름</span><input name="name" defaultValue={area.name} /></label><div className="structure-form"><label className="field compact-field"><span>X (%)</span><input name="x" type="number" min="0" max="100" step="0.1" defaultValue={Math.round(area.bounds.x * 1000) / 10} /></label><label className="field compact-field"><span>Y (%)</span><input name="y" type="number" min="0" max="100" step="0.1" defaultValue={Math.round(area.bounds.y * 1000) / 10} /></label><label className="field compact-field"><span>폭 (%)</span><input name="width" type="number" min="0.1" max="100" step="0.1" defaultValue={Math.round(area.bounds.width * 1000) / 10} /></label><label className="field compact-field"><span>깊이 (%)</span><input name="height" type="number" min="0.1" max="100" step="0.1" defaultValue={Math.round(area.bounds.height * 1000) / 10} /></label></div><div className="plan-area-edit__actions"><Button type="submit">변경 저장</Button><Button type="button" tone="danger-quiet" icon="trash" onClick={() => removeArea(area)}>영역 삭제</Button></div></form>)}</div>}
            {planDetailTab === 'area' && <details className="plan-numeric-fallback"><summary>좌표로 영역 표시 (키보드 대체)</summary><p>왼쪽 위 모서리의 위치와 사각형의 폭·깊이를 도면 전체에 대한 비율로 입력합니다.</p><div className="structure-form">
              <label className="field compact-field"><span>X (%)</span><input type="number" min="0" max="100" value={areaX} onChange={(event) => setAreaX(event.target.value)} /></label><label className="field compact-field"><span>Y (%)</span><input type="number" min="0" max="100" value={areaY} onChange={(event) => setAreaY(event.target.value)} /></label>
              <label className="field compact-field"><span>폭 (%)</span><input type="number" min="1" max="100" value={areaWidth} onChange={(event) => setAreaWidth(event.target.value)} /></label><label className="field compact-field"><span>깊이 (%)</span><input type="number" min="1" max="100" value={areaHeight} onChange={(event) => setAreaHeight(event.target.value)} /></label>
              <Button icon="add" onClick={() => addArea()}>입력한 영역 추가</Button>
            </div></details>}
            </div>}
            <PlanCanvas quietLabels onUndo={() => restoreEdit('undo')} onRedo={() => restoreEdit('redo')} canUndo={!!editHistoryRef.current.get(project.id)?.past.length || !!undoAction && undoAction.projectId === project.id && undoAction.revision === project.commonRevision} canRedo={!!editHistoryRef.current.get(project.id)?.future.length} lineConstraint={structureKind === 'wall' ? lineConstraint : 'free'} onDrawPolygon={points => !!addArea(outlineBounds(points), points)} onStructureLockToggle={id => { const item = project.floorPlan?.structures.find(s => s.id === id); if (item) toggleKeep(item) }} key={`${project.id}-${planDetailTab}-${structureKind}-${structureRole}-${areaKind}-${areaShape}`} project={project} onDragEvent={recordCanvasDrag} mode="view" selectedAreaId={selectedAreaId} onAreaSelect={setSelectedAreaId} selectedStructureId={selectedStructureId} onStructureSelect={setSelectedStructureId} onStructureMove={moveOptionalStructure}
              drawStructureKind={planDetailTab === 'structure' ? structureKind : undefined} drawTool={planDetailTab === 'structure' ? (structureKind === 'pillar' || structureKind === 'existing-light' ? 'point' : 'segment') : planDetailTab === 'area' ? areaShape : undefined}
              drawWallId={hostWall?.id} onDrawWallSelect={requiresDrawingWall ? selectDrawingWall : undefined}
              validationMessage={planEditError} onValidationDismiss={() => { setPlanEditError(''); if (error === planEditError) setError('') }}
              onDraw={planDetailTab === 'structure' ? drawStructure : planDetailTab === 'area' ? drawArea : undefined} />
            {planDetailTab !== 'plan' && <div className="plan-drawing-exit"><span>그린 항목은 자동 저장됩니다. 마칠 때 직접 돌아가세요.</span><Button tone="quiet" onClick={() => { setPlanDetailTab('plan'); setPlanEditError('') }}>그리기 마치기</Button></div>}
            {planDetailTab === 'plan' && <div className="plan-task-hint">
              <div className="plan-task-hint__heading"><strong>{selectedStructure ? `선택: ${selectedStructure.name}` : '선택·이동 모드'}</strong><Button icon="add" onClick={() => chooseStructureTool('wall', 'partition')}>가벽 추가</Button></div>
              <p>{selectedStructure && structureMovementReason(project, selectedStructure) ? structureMovementReason(project, selectedStructure) : movablePartitions.length ? '‘이동 가능’ 이름표나 구조를 잡고 끌어 주세요.' : '이동 가능한 구조가 없습니다. 유지할 요소에서 필수 보존을 끄면 위치를 수정할 수 있습니다.'}</p>
            </div>}
            {planDetailTab === 'plan' && movablePartitions.length > 0 && <div className="plan-partitions" aria-label="이동 가능한 구조 목록"><h3>이동 가능한 구조</h3>{movablePartitions.map((partition) => <div key={partition.id} className="plan-partition-row"><button type="button" aria-pressed={selectedStructureId === partition.id} onClick={() => setSelectedStructureId(partition.id)}>{partition.name}<span>도면에서 선택</span></button><Button tone="danger" onClick={() => deleteStructure(partition)}>제거</Button></div>)}</div>}
            </div>
          </div> : <div className="plan-empty"><p>평면도가 아직 없습니다.</p><p className="muted">도면 이미지가 없다면 치수를 주장하지 않는 개략 도면으로 시작할 수 있습니다.</p><label className="field"><span>시작할 도면 모양</span><select value={schematicShape} onChange={e => setSchematicShape(e.target.value as typeof schematicShape)}><option value="landscape">가로 사각형</option><option value="portrait">세로 사각형</option><option value="outline">직접 윤곽 그리기 (빈 캔버스)</option></select></label><Button icon="layers" onClick={createSchematicPlan}>개략 도면 만들기</Button></div>}
        </section>
      </div>
      <details className="space-project-details"><summary>프로젝트 기본 정보</summary><section className="details-strip"><div><h3>프로젝트 기본 정보</h3><p className="muted">변경한 항목만 저장되며 기존 결과는 이전 조건으로 보관됩니다.</p></div><div className="details-fields"><label className="field"><span>이름</span><input defaultValue={project.name} key={`${project.id}-name`} onBlur={(event) => commit(updateCommon(project, { name: event.target.value.trim() || project.name }))} /></label><label className="field"><span>공간 유형</span><input defaultValue={project.spaceType} key={`${project.id}-type`} onBlur={(event) => commit(updateCommon(project, { spaceType: event.target.value }))} /></label><label className="field field-wide"><span>콘셉트</span><input defaultValue={project.concept} key={`${project.id}-concept`} onBlur={(event) => commit(updateCommon(project, { concept: event.target.value }))} /></label></div></section></details>

    </div>
  }

  function renderKeep() {
    const structures = project.floorPlan?.structures.filter((item) => ['wall','window','pillar','door','entrance','existing-light'].includes(item.kind)) ?? []
    const firstPhoto = project.sourceImages.find((image) => image.role === 'existing-space')
    return <div className="keep-layout">
      <section className="surface-panel"><div className="panel-heading"><div><p className="eyebrow">도면에서 선택</p><h2>유지할 구조</h2></div><Badge tone="keep">필수 보존 {project.keeps.length}개</Badge></div><PlanCanvas quietLabels onUndo={() => restoreEdit('undo')} onRedo={() => restoreEdit('redo')} canUndo={!!editHistoryRef.current.get(project.id)?.past.length || !!undoAction && undoAction.projectId === project.id && undoAction.revision === project.commonRevision} canRedo={!!editHistoryRef.current.get(project.id)?.future.length} onStructureLockToggle={id => { const item = project.floorPlan?.structures.find(s => s.id === id); if (item) toggleKeep(item) }} project={project} onDragEvent={recordCanvasDrag} mode="keep" validationMessage={planEditError} onValidationDismiss={() => { setPlanEditError(''); if (error === planEditError) setError('') }} selectedStructureId={selectedStructureId} onStructureSelect={setSelectedStructureId} onStructureMove={moveOptionalStructure} /></section>
      <aside className="side-panel"><div className="workflow-panel-content"><div className="panel-heading"><div><p className="eyebrow">선택한 요소</p><h2>{selectedStructure?.name ?? '구조를 선택하세요'}</h2></div></div>
        {firstPhoto ? <PhotoKeepOverlay compact imageUri={firstPhoto.uri} structures={project.floorPlan?.structures ?? []} keeps={project.keeps} selectedStructureId={selectedStructureId} onSelect={setSelectedStructureId} onSetAnchor={(id, point) => { commit(updatePhotoAnchor(project, id, point), '사진 라벨 위치를 저장했습니다. 도면 구조는 변경되지 않았습니다.') }} /> : <Empty>기존 공간 사진을 먼저 등록하세요.</Empty>}
        {renderStructureInspector()}
        <details className="keep-structure-picker"><summary>다른 구조 선택 · {structures.length}개</summary>{structures.length ? <div className="structure-list">{structures.map((structure) => { const isKept = isStructureLocked(project, structure); return <button key={structure.id} className={`list-row ${selectedStructureId === structure.id ? 'is-selected' : ''}`} aria-pressed={selectedStructureId === structure.id} onClick={() => setSelectedStructureId(structure.id)}><span><strong>{structure.name}</strong><small>{STRUCTURE_LABELS[structure.kind]}</small></span>{isKept && <NucleoIcon name="lock" />}</button> })}</div> : <Empty>평면도에 구조를 먼저 표시하세요.</Empty>}</details>
      </div>{renderWorkflowFooter()}</aside>
    </div>
  }

  function renderReferences() {
    const focused = project.references.find((item) => item.id === referenceFocus) ?? project.references[0]
    const focusedImage = project.sourceImages.find((image) => image.id === focused?.imageId)
    const focusedElements = project.elements.filter(item => item.sourceReferenceId === focused?.id).sort((a, b) => Number(b.id === selectedElementId) - Number(a.id === selectedElementId))
    const registrationTarget = focused && registrationLocation && registrationLocation.referenceId === focused.id && registrationLocation.kind === elementKind ? registrationLocation.target : null
    const regionEditingElement = project.elements.find((element) => element.id === regionEditingElementId)
    const sourceGroups = [
      { label: '분위기·공간 참고', role: 'ambience' as const, sourceRole: 'inspiration' as const },
      { label: '요소·그래픽 참고', role: 'element' as const, sourceRole: 'inspiration' as const },
      { label: '제품 사진', role: 'product' as const, sourceRole: 'product' as const },
    ]
    function chooseReference(id: string) {
      experiment.record('reference_select', 'reference', id, { role: project.references.find((item) => item.id === id)?.role ?? '' })
      setReferenceFocus(id)
      setSelectedElementId(project.elements.find(item => item.sourceReferenceId === id)?.id ?? '')
      setEditingElementId(null); setElementLabel('')
      setElementKind(project.references.find(item => item.id === id)?.role === 'product' ? 'display-product' : project.references.find(item => item.id === id)?.role === 'ambience' ? 'ambient-light' : 'freestanding-fixture'); setRegistrationLocation(null)
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
    function addElement(placeNow = false) {
      if (regionEditingElementId) { setError('기존 요소의 참조 범위 편집을 저장하거나 취소해 주세요.'); return }
      const referenceId = focused?.id
      if (!referenceId || !project.references.some((item) => item.id === referenceId)) { setError('현재 프로젝트의 참고 이미지를 먼저 선택해 주세요.'); return }
      if (referenceRegionMode === 'region' && (!referenceRegionDraft || !validReferenceRegion(referenceRegionDraft))) {
        setError('이미지에서 참조할 영역을 먼저 드래그하거나 전체 이미지를 선택해 주세요.'); return
      }
      const id = makeId('element')
      const element: DesignElement = { id, sourceReferenceId: referenceId, sourceRegion: referenceRegionMode === 'region' ? referenceRegionDraft! : undefined, label: displayName(project.elements.map(item => item.label), elementLabel, ELEMENT_LABELS[elementKind]), kind: elementKind, status: 'apply', target: registrationTarget, conditions: '' }
      const references = project.references.map((item) => item.id === referenceId ? { ...item, extractedElements: [...item.extractedElements, id] } : item)
      if (registrationTarget) {
        const checked = validatePlacement({ ...project, references, elements: [...project.elements, element] }, id, registrationTarget)
        if (!checked.valid) { setError(checked.issues.map(issue => issue.message).join(' ')); return }
      }
      if (!commit(updateCommon(project, { references, elements: [...project.elements, element] }), registrationTarget ? '요소와 적용 위치를 저장했습니다.' : '요소를 추가했습니다. 적용 위치를 연결해 주세요.')) return
      if (placeNow) go('placement'); setSelectedElementId(id); setElementLabel(''); setRegistrationLocation(null)
    }
    return <div className="reference-layout">
      <aside className="library-panel"><div className="panel-heading"><div><p className="eyebrow">참고 이미지</p><h2>참고 이미지</h2></div></div>
        {sourceGroups.map((group) => <div key={group.role} className="library-group"><div className="group-heading"><h3>{group.label}</h3><FilePick label={busy ? "등록 중…" : "추가"} disabled={busy} onFile={(file) => uploadImage(file, group.sourceRole, group.role)} /></div>
          {project.references.filter((item) => item.role === group.role).length === 0 && <p className="muted small">등록된 이미지가 없습니다.</p>}
          {project.references.filter((item) => item.role === group.role).map((reference) => { const image = project.sourceImages.find((entry) => entry.id === reference.imageId); return <button key={reference.id} className={`reference-thumb ${focused?.id === reference.id ? 'is-selected' : ''}`} aria-pressed={focused?.id === reference.id} onClick={() => chooseReference(reference.id)}><span className="thumb-image">{image && <AssetImage uri={image.uri} alt={`${image.name} 미리보기`} />}</span><span><strong>{image?.name ?? '이미지 없음'}</strong><small>{group.role === 'product' ? '제품' : group.role === 'ambience' ? '분위기' : '요소'}</small></span></button> })}
        </div>)}
      </aside>
      <section className="reference-preview"><div className="panel-heading"><div><p className="eyebrow">참고할 사진</p><h2>{focusedImage?.name ?? '이미지를 선택하세요'}</h2></div>{focused && <div className="reference-header-actions"><Badge tone="info">{focused.role === 'ambience' ? '분위기' : focused.role === 'product' ? '제품' : '요소'}</Badge><Button tone="danger-quiet" icon="trash" disabled={busy} onClick={() => setPendingReferenceDelete(focused.id)}>이미지 삭제</Button></div>}</div>
        {focused && pendingReferenceDelete === focused.id && <section ref={referenceDeleteConfirmRef} className="reference-delete-confirm" aria-label="레퍼런스 삭제 확인" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setPendingReferenceDelete(null) } }}><h3>이 레퍼런스를 삭제할까요?</h3><p>{focusedImage?.name}</p><p>이미지와 연결된 디자인 요소 {project.elements.filter((element) => element.sourceReferenceId === focused.id).length}개가 현재 작업에서 삭제됩니다. 기존 결과와 당시 조건은 보관됩니다.</p><div className="keep-actions"><Button tone="danger" icon="trash" disabled={busy} onClick={() => deleteReferenceImage(focused.id)}>이미지와 연결 요소 삭제</Button><button className="button button-secondary" data-action="cancel" type="button" onClick={() => { setPendingReferenceDelete(null); document.querySelector<HTMLButtonElement>('.reference-header-actions button')?.focus({ preventScroll: true }) }}>취소</button></div></section>}
        {focusedImage ? <>
          {project.id.startsWith(CAMPUS_PREFIX) && <p className="source-provenance">사진마다 가져올 요소를 고르세요. 사진 속 공간 전체를 복제하지 않습니다. 전시대는 사용한 뒤 배치 화면에서 놓을 위치를 정합니다.</p>}
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
      <aside className="element-panel"><div className="workflow-panel-content"><div className="panel-heading"><div><p className="eyebrow">적용할 내용</p><h2>이 이미지의 요소 · {focusedElements.length}개</h2></div></div>
        <div className="add-element" key={focused?.id}><h3>이 이미지에서 요소 만들기</h3><p className="muted small">선택한 이미지 · {focusedImage?.name ?? '없음'}<br />참조 범위 · {referenceRegionMode === 'whole' ? '이미지 전체' : referenceRegionDraft ? '선택 영역' : '선택 필요'}</p><label className="field"><span>요소 이름</span><input value={elementLabel} onChange={(event) => setElementLabel(event.target.value)} placeholder={`비우면 ${ELEMENT_LABELS[elementKind]} (1)`} /></label><label className="field"><span>요소 유형</span><select aria-label="요소 유형" value={elementKind} onChange={(event) => { setElementKind(event.target.value as ElementKind); setRegistrationLocation(null) }}>{Object.entries(ELEMENT_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label><AreaTargetPicker project={project} element={{ id: 'registration-draft', sourceReferenceId: focused?.id ?? '', label: elementLabel || ELEMENT_LABELS[elementKind], kind: elementKind, status: 'apply', target: registrationTarget }} draft onChange={target => setRegistrationLocation({ referenceId: focused?.id ?? '', kind: elementKind, target })} onCreateArea={openAreaDrawing} />{elementKind === 'display-product' && <p className="muted small">진열대 사진이 있다면 별도 진열대 요소를 만드세요. 제품 사진만 있어도 직접 기본 진열대를 추가해 연결할 수 있습니다.</p>}<Button icon="add" onClick={() => addElement()} disabled={!focused || !!regionEditingElementId || (referenceRegionMode === 'region' && !referenceRegionDraft)}>요소 추가</Button><Button tone="primary" icon="layers" onClick={() => addElement(true)} disabled={!focused || !!regionEditingElementId || (referenceRegionMode === 'region' && !referenceRegionDraft)}>추가하고 배치하기</Button></div>
        <div className="element-scroll">{focusedElements.length === 0 && <p className="empty-state">이 이미지에서 추가한 요소가 없습니다. 이름과 유형을 정해 요소를 추가하세요.</p>}{focusedElements.map((element) => {
          const source = sourceFor(project, element.sourceReferenceId)
          const selected = selectedElementId === element.id
          const editing = editingElementId === element.id
          return <div key={element.id} className={`element-card ${selected ? 'is-selected' : ''}`}>
            <div className="element-card-top"><button className="element-card-select" type="button" aria-label={`${element.label} 선택`} aria-pressed={selected} onClick={() => setSelectedElementId(element.id)}><strong>{element.label}</strong></button><Badge tone={element.status === 'exclude' ? 'error' : element.target ? 'selected' : 'neutral'}>{element.status === 'exclude' ? '제외' : element.target ? '적용 · 배치됨' : '적용 · 위치 미지정'}</Badge></div>
            <p>{ELEMENT_LABELS[element.kind]} · {element.origin === 'basic-support' ? '직접 추가한 기본 받침' : source?.name ?? '출처 없음'}</p>
            <p className="muted small">출처 범위 · {element.sourceRegion ? '이미지 일부' : '이미지 전체'}</p>
            <p className="muted small">{element.status === 'exclude' ? '배치와 미리보기 조건에서 제외' : targetDescription(project, element.target)}</p>
            <div className="element-card-actions">
              <button type="button" className="button button-secondary element-use-toggle" aria-pressed={element.status === 'apply'} onClick={() => commit(updateElement(project, element.id, { status: element.status === 'apply' ? 'exclude' : 'apply' }), element.status === 'apply' ? '선택에서 뺐습니다.' : '이 요소를 사용하도록 선택했습니다.')}>{element.status === 'apply' ? '사용하지 않기' : '이 요소 사용'}</button>
              {element.status === 'apply' && <Button icon="layers" onClick={() => editElement(element.id)}>위치 연결</Button>}
              {element.kind === 'display-product' && element.status === 'apply' && !element.target && <Button icon="add" onClick={() => createBasicSupport(element)}>기본 진열대 추가·연결</Button>}
              <details className="element-more"><summary>편집·제외·삭제</summary><div><Button tone="danger-quiet" icon="trash" onClick={() => deleteElement(element)}>요소 삭제</Button>
              <Button tone="quiet" onClick={() => editSourceRegion(element)}>출처 범위 편집</Button>
              <Button tone="quiet" icon="edit" onClick={() => editing ? cancelConditionEdit() : beginConditionEdit(element)}>{editing ? '편집 닫기' : '조건 편집'}</Button>
              </div></details>
            </div>
            {selected && element.status === 'apply' && !allowedTargetKinds(element.kind).includes('floor-point') && <div className="reference-location"><AreaTargetPicker project={project} element={element} onChange={target => { if (target) applyElementTarget(element.id, target) }} onCreateArea={openAreaDrawing} /></div>}
            {selected && <div className="element-inline-edit">
              {editing ? <>
                <label className="field"><span>적용·제외 조건</span><textarea aria-label="적용·제외 조건" rows={2} value={conditionDraft} onChange={(event) => setConditionDraft(event.target.value)} /></label>
                <label className="field"><span>모양·재료 조건</span><textarea aria-label="모양·재료 조건" rows={2} value={appearanceDraft} onChange={(event) => setAppearanceDraft(event.target.value)} /></label>
                <label className="field"><span>요소 유형</span><select value={kindDraft} onChange={(event) => setKindDraft(event.target.value as ElementKind)}>{Object.entries(ELEMENT_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
                <div className="element-edit-actions"><Button tone="primary" icon="check" onClick={() => saveConditionEdit(element)}>변경 저장</Button><Button onClick={cancelConditionEdit}>취소</Button></div>
              </> : <>
                <div className="element-readonly-field"><strong>적용·제외 조건</strong><p>{element.conditions?.trim() || '등록된 조건 없음'}</p></div>
                <div className="element-readonly-field"><strong>모양·재료 조건</strong><p>{element.appearance?.trim() || '등록된 조건 없음'}</p></div>

              </>}
            </div>}
          </div>
        })}</div>

      </div>{renderWorkflowFooter()}</aside>
    </div>
  }

  function renderPlacementInspector() {
    if (!selectedElement) return <Empty>왼쪽에서 요소를 선택하세요.</Empty>
    if (selectedElement.status === 'exclude') return <div className="inspector-block"><Badge tone="error">제외</Badge><h3>{selectedElement.label}</h3><p>제외한 요소는 배치할 수 없습니다. 레퍼런스 단계에서 적용으로 변경할 수 있습니다.</p><Button onClick={() => go('references')}>레퍼런스에서 변경</Button></div>
    if (!project.floorPlan) return <Empty>먼저 평면도를 등록하세요.</Empty>
    const allowed = allowedTargetKinds(selectedElement.kind)
    const floorAreas = project.floorPlan.areas.filter((area) => area.kind === 'floor')
    const walls = project.floorPlan.structures.filter((structure) => structure.kind === 'wall')
    const floorTarget = selectedElement.target?.kind === 'floor-point' ? selectedElement.target : null
    const wallTarget = selectedElement.target?.kind === 'wall-segment' ? selectedElement.target : null
    return <div className="inspector-content"><div className="inspector-block"><h3>{selectedElement.label}</h3><p className="muted">{ELEMENT_LABELS[selectedElement.kind]}</p><p className="rule-line">허용 위치 · {allowed.map(targetLabel).join(' / ')}</p>{selectedElement.kind === 'ambient-light' && <p className="muted small">이 항목은 레퍼런스에서 가져온 공간 분위기 조건입니다. 기존 천장 등기구는 도면 구조로 등록하고 유지할 요소에서 보존 여부와 색감을 조정합니다.</p>}<p className="muted small">현재 위치: {targetDescription(project, selectedElement.target)}</p></div>
      {allowed.includes('fixture-surface') && <div className="inspector-block"><h3>제품을 올릴 곳</h3><p className="muted small">진열대·가구를 선택하세요. 제품과 받침은 겹쳐 표시되고 함께 이동합니다. 제품을 바닥에 직접 놓지 않습니다.</p><label className="field"><span>진열대·가구</span><select value={selectedElement.target?.kind === 'fixture-surface' ? selectedElement.target.fixtureElementId : ''} onChange={event => { if (event.target.value) applyTarget({ kind: 'fixture-surface', fixtureElementId: event.target.value, offset: { x: .5, y: .5 } }) }}><option value="">제품을 올릴 요소 선택</option>{project.elements.filter(isDisplaySupport).map(item => <option key={item.id} value={item.id} disabled={!item.target}>{item.label}{!item.target ? ' · 바닥 위치 먼저 지정' : ''}</option>)}</select></label>{selectedElement.target?.kind === 'fixture-surface' && <form key={`${selectedElement.id}-${selectedElement.target.fixtureElementId}`} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); if (selectedElement.target?.kind === 'fixture-surface') applyTarget({ ...selectedElement.target, offset: { x: fraction(String(data.get('x'))), y: fraction(String(data.get('y'))) } }) }}><div className="field-row"><label className="field"><span>표면 X (%)</span><input name="x" type="number" min="0" max="100" defaultValue={pct(selectedElement.target.offset.x)} /></label><label className="field"><span>표면 Y (%)</span><input name="y" type="number" min="0" max="100" defaultValue={pct(selectedElement.target.offset.y)} /></label></div><Button type="submit">표면 위치 적용</Button></form>}<Button icon="add" disabled={countLayoutItems(project)>=MAX_LAYOUT_ITEMS} onClick={() => createBasicSupport(selectedElement)}>기본 진열대 추가·연결</Button><p className="muted small">기본 전시대는 직접 추가한 배치입니다. 원하는 디자인은 레퍼런스 적용에서 이 전시대에 연결하세요.</p></div>}
      {allowed.includes('floor-point') && <form className="inspector-block" key={`${selectedElement.id}-floor-${floorTarget?.x}-${floorTarget?.y}-${floorTarget?.rotationDegrees}-${floorTarget?.footprint?.width}-${floorTarget?.footprint?.height}`} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); applyTarget({ kind: 'floor-point', x: fraction(String(data.get('x'))), y: fraction(String(data.get('y'))), rotationDegrees: Number(data.get('rotation')), footprint: { width: fraction(String(data.get('width'))), height: fraction(String(data.get('height'))) } }) }}><h3>바닥 위치</h3><p className="muted small">평면도를 클릭하거나 비율을 입력하세요.</p><div className="field-grid"><label className="field"><span>X (%)</span><input name="x" type="number" min="0" max="100" defaultValue={pct(floorTarget?.x ?? .5)} /></label><label className="field"><span>Y (%)</span><input name="y" type="number" min="0" max="100" defaultValue={pct(floorTarget?.y ?? .5)} /></label><label className="field"><span>폭 (%)</span><input name="width" type="number" min="1" max="100" defaultValue={pct(floorTarget?.footprint?.width ?? .10)} /></label><label className="field"><span>깊이 (%)</span><input name="height" type="number" min="1" max="100" defaultValue={pct(floorTarget?.footprint?.height ?? .08)} /></label></div><label className="field"><span>회전 (도)</span><input name="rotation" type="number" min="0" max="359" defaultValue={floorTarget?.rotationDegrees ?? 0} /></label><Button type="submit">바닥 위치 적용</Button></form>}
      {allowed.includes('wall-segment') && <WallTargetEditor key={wallEditorKey} project={project} walls={walls} target={wallTarget} selection={wallEditorSelection} onSelectionChange={selection=>setWallFaceDraft({...selection,editorKey:wallEditorKey})} onApply={applyTarget} />}
      {allowed.some(kind => ['whole-space', 'named-area', 'ceiling-zone'].includes(kind)) && <div className="inspector-block"><h3>적용 위치 연결</h3><AreaTargetPicker project={project} element={selectedElement} onChange={target => { if (target) applyTarget(target) }} onCreateArea={openAreaDrawing} /><p className="muted small">도면의 영역 이름표나 영역·동선 목록에서도 연결할 수 있습니다. 선택한 요소의 적용 범위만 강조합니다.</p></div>}
      {allowed.includes('floor-area') && <div className="inspector-block"><h3>바닥 영역</h3><label className="field"><span>영역 선택</span><select value={selectedElement.target?.kind === 'floor-area' ? selectedElement.target.areaId : ''} onChange={(event) => { if (event.target.value) applyTarget({ kind: 'floor-area', areaId: event.target.value }) }}><option value="">바닥 영역 선택</option>{floorAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label></div>}
      <div className="inspector-block"><h3>저장된 조건</h3><div className="element-readonly-field"><strong>적용·제외 조건</strong><p>{selectedElement.conditions?.trim() || '등록된 조건 없음'}</p></div><div className="element-readonly-field"><strong>모양·재료 조건</strong><p>{selectedElement.appearance?.trim() || '등록된 조건 없음'}</p></div><Button icon="edit" onClick={() => { beginConditionEdit(selectedElement); go('references') }}>조건 편집</Button></div>
    </div>
  }

  function renderPlacement() {
    const active = project.elements.filter((item) => item.status === 'apply')
    return <div className={`workspace-layout ${showWorkspaceLeft ? '' : 'is-left-hidden'} ${showWorkspaceRight ? '' : 'is-right-hidden'}`}>
      <aside className="workspace-side workspace-side--left"><div className="panel-heading"><div><p className="eyebrow">적용 요소</p><h2>배치 목록</h2></div><Badge>{active.length}개</Badge></div><div className="workspace-catalog"><div className="workspace-list">{active.map((element) => <button key={element.id} className={`element-list-button ${placementSelection === 'element' && selectedElementId === element.id ? 'is-selected' : ''}`} aria-pressed={placementSelection === 'element' && selectedElementId === element.id} onClick={() => selectPlacementElement(element.id)}><strong>{element.label}</strong><small>{ELEMENT_LABELS[element.kind]}</small><span className={`status-line ${element.target ? 'is-placed' : ''}`}>{element.target ? targetDescription(project, element.target) : '위치 미지정'}</span></button>)}</div>{active.length === 0 && <Empty>적용할 요소가 없습니다. 레퍼런스에서 적용 요소를 선택하세요.</Empty>}<div className="workspace-structure-list"><h3>도면 구조</h3><p className="muted small">보존을 끈 구조는 위치를 수정할 수 있습니다.</p>{project.floorPlan?.structures.map((structure) => <button key={structure.id} type="button" className={`element-list-button ${placementSelection === 'structure' && selectedStructureId === structure.id ? 'is-selected' : ''}`} aria-pressed={placementSelection === 'structure' && selectedStructureId === structure.id} onClick={() => selectPlacementStructure(structure.id)}><strong>{structure.name}</strong><span>{structureMovementReason(project, structure) ? '위치 고정 · 조건 확인' : '이동 가능'}</span></button>)}</div>{project.elements.some((item) => item.status === 'exclude') && <div className="side-bottom"><p className="muted small">제외 요소 {project.elements.length - active.length}개는 배치하지 않습니다.</p><Button tone="quiet" onClick={() => go('references')}>제외 조건 보기</Button></div>}</div></aside>
      <section className="workspace-main"><div className="panel-heading"><div><p className="eyebrow">평면도 작업</p><h2>배치 도면</h2></div>{renderWorkspaceToolbar('요소 목록')}<Badge tone="info">{project.floorPlan?.geometryConfidence === 'schematic' ? '개략 도면 · 치수 미확인' : '평면도'}</Badge></div><p className="narrow-notice">도면의 요소를 끌어 이동하고 회전 손잡이로 각도를 조정하세요. 수치 입력도 사용할 수 있습니다.</p>{pendingPlacement && <div className="placement-warning" role="group" aria-label="보존 조건 확인"><button type="button" className="notice-dismiss" aria-label="보존 조건 확인 닫기" onClick={()=>setPendingPlacement(null)}><NucleoIcon name="close" /></button><NucleoIcon name="warning" /><div><strong>보존 조건 확인</strong>{pendingPlacement.warnings.map((message) => <p key={message}>{message}</p>)}<div className="placement-warning__actions"><Button tone="primary" onClick={() => applyElementTarget(pendingPlacement.elementId, pendingPlacement.target, true)}>확인하고 배치</Button><Button onClick={() => setPendingPlacement(null)}>취소</Button></div></div></div>}<PlanCanvas quietLabels onUndo={() => restoreEdit('undo')} onRedo={() => restoreEdit('redo')} canUndo={!!editHistoryRef.current.get(project.id)?.past.length || !!undoAction && undoAction.projectId === project.id && undoAction.revision === project.commonRevision} canRedo={!!editHistoryRef.current.get(project.id)?.future.length} attachmentWallId={wallEditorSelection?.wallId} selectedWallFace={wallEditorSelection?.face} onWallFaceSelect={selectWallFace} onSupportSelect={id => applyTarget({ kind: 'fixture-surface', fixtureElementId: id, offset: { x: .5, y: .5 } })} onStructureLockToggle={id => { const item = project.floorPlan?.structures.find(s => s.id === id); if (item) toggleKeep(item) }} project={project} onDragEvent={recordCanvasDrag} mode="place" selectedAreaId={placementSelection === 'element' && selectedElement ? targetAreaId(selectedElement.target) : undefined} onAreaSelect={placementSelection === 'element' && selectedElement && allowedTargetKinds(selectedElement.kind).some(kind => ['named-area', 'ceiling-zone', 'floor-area'].includes(kind)) ? areaId => { const area = project.floorPlan?.areas.find(item => item.id === areaId); const target = area && targetForArea(selectedElement.kind, area); if (target) applyTarget(target); else setError('이 요소 유형에 연결할 수 없는 영역입니다. 오른쪽 적용 위치에서 가능한 영역을 선택하세요.') } : undefined} selectedElementId={placementSelection === 'element' ? selectedElementId : undefined} selectedStructureId={placementSelection === 'structure' ? selectedStructureId : undefined} selectedCameraId={selectedCameraId} onElementSelect={selectPlacementElement} onElementMove={(id, x, y) => { const element = project.elements.find((item) => item.id === id); if (element?.target?.kind === 'floor-point') applyElementTarget(id, { ...element.target, x, y }) }} onElementRotate={(id, rotationDegrees) => { const element = project.elements.find((item) => item.id === id); if (element?.target?.kind === 'floor-point') applyElementTarget(id, { ...element.target, rotationDegrees }) }} onWallElementMove={(id, wallId, start, end) => { const element = project.elements.find((item) => item.id === id); if (element?.target?.kind === 'wall-segment') applyElementTarget(id, { ...element.target, wallId, start, end, face: wallId === element.target.wallId ? element.target.face : undefined }) }} onStructureSelect={selectPlacementStructure} onStructureMove={moveOptionalStructure} validationMessage={planEditError} onValidationDismiss={() => { setPlanEditError(''); if (error === planEditError) setError('') }} onPlacePoint={(x, y) => {
        if (placementSelection !== 'element' || !selectedElement) return
        if (!allowedTargetKinds(selectedElement.kind).includes('floor-point')) { setError(`${selectedElement.label}은(는) 바닥의 한 점에 놓을 수 없습니다. ${allowedTargetKinds(selectedElement.kind).map(targetLabel).join(' 또는 ')}을 선택하세요.`); return }
        const old = selectedElement.target?.kind === 'floor-point' ? selectedElement.target : null
        applyTarget({ kind: 'floor-point', x, y, footprint: old?.footprint ?? { width: .10, height: .08 }, rotationDegrees: old?.rotationDegrees ?? 0 })
      }} onWallSelect={placementSelection === 'element' ? (wallId) => {
        if (placementSelection !== 'element' || !selectedElement) return
        if (!allowedTargetKinds(selectedElement.kind).includes('wall-segment')) { setError(`${selectedElement.label}은(는) 벽에 배치할 수 없습니다. ${allowedTargetKinds(selectedElement.kind).map(targetLabel).join(' 또는 ')}을 선택하세요.`); return }
        const old = selectedElement.target?.kind === 'wall-segment' ? selectedElement.target : null
        applyTarget({ kind: 'wall-segment', wallId, start: old?.wallId === wallId ? old.start : .10, end: old?.wallId === wallId ? old.end : .30, face: old?.wallId === wallId ? old.face : undefined })
      } : undefined} /><div className="canvas-help"><span>바닥 요소: 선택 후 드래그</span><span>회전: 선택 요소의 손잡이 드래그</span><span>벽 요소: 벽 구간 드래그</span></div></section>
      <aside className="workspace-side inspector"><div className="panel-heading"><div><p className="eyebrow">유형별 설정</p><h2>속성 편집</h2></div></div>{placementSelection === 'structure' ? <div className="inspector-content">{renderStructureInspector()}</div> : renderPlacementInspector()}{renderWorkflowFooter()}</aside>
    </div>
  }

  function addView(): boolean {
    if (!project.floorPlan) { setError('먼저 평면도를 준비하세요.'); return false }
    if (project.cameras.length >= MAX_CAMERAS) { setError(`시점은 최대 ${MAX_CAMERAS}개까지 관리할 수 있습니다.`); return false }
    const preferred = suggestNextCamera(project)
    const camera: Camera = { id: makeId('camera'), name: project.cameras.length ? `추가 시점 ${project.cameras.length}` : '대표 시점', ...preferred, heightMeters:CAMERA_PRESETS.custom.heightMeters,pitchDegrees:CAMERA_PRESETS.custom.pitchDegrees,fovPreset:CAMERA_PRESETS.custom.fovPreset, viewPreset:'custom', eyeHeightPreset:'custom', primary: project.cameras.length === 0 }
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

  function suggestCameraView(camera: Camera) {
    const proposed = suggestNextCamera({ ...project, cameras: project.cameras.filter(item => item.id !== camera.id) })
    const candidates = [proposed, ...Array.from({ length: 19 * 19 }, (_, index) => ({ x: .05 + (index % 19) * .05, y: .05 + Math.floor(index / 19) * .05 }))
      .sort((a, b) => (a.x - proposed.x) ** 2 + (a.y - proposed.y) ** 2 - (b.x - proposed.x) ** 2 - (b.y - proposed.y) ** 2)]
    const position = candidates.find(({ x, y }) => validateCamera(updateCamera(project, camera.id, { x, y, directionDegrees: proposed.directionDegrees }), camera.id).valid)
    if (!position) { setError('입구 근처에 놓을 수 있는 바닥 위치가 없습니다. 도면에서 직접 시점을 조정해 주세요.'); return }
    if (camera.x === position.x && camera.y === position.y && camera.directionDegrees === proposed.directionDegrees) { showNotice('이미 제안된 위치에 있습니다.'); return }
    commit(updateCamera(project, camera.id, { ...position, directionDegrees: proposed.directionDegrees }), `${camera.name}의 위치를 입구 기준으로 제안했습니다. 도면에서 방향을 확인해 주세요.`)
  }

  function renderWorkflowFooter() {
    if (step === 'projects') return null
    return <div className="workflow-footer"><WorkflowNavigation
      onPrevious={() => go(previousWorkflowStep(step))}
      onNext={workflowIndex(step) < 3 ? () => go(WORKFLOW[workflowIndex(step) + 1].steps[0]) : step === 'camera' ? () => go('review') : undefined}
      nextLabel={project.layoutVersion === 2 ? step === 'camera' ? '조건 확인' : '다음으로' : NEXT_ACTIONS[step]}
    /></div>
  }

  function renderCamera() {
    const cameraIssues = selectedCamera ? validateCamera(project, selectedCamera.id).issues : []
    return <div className={`workspace-layout ${showWorkspaceLeft ? '' : 'is-left-hidden'} ${showWorkspaceRight ? '' : 'is-right-hidden'}`}>
      <WorkspaceRegistration />
      <aside className="workspace-side workspace-side--left"><div className="panel-heading"><div><p className="eyebrow">시점 관리</p><h2>카메라</h2></div></div><div className="workspace-list">{project.cameras.map((camera) => <button key={camera.id} className={`camera-list-button ${selectedCamera?.id === camera.id ? 'is-selected' : ''}`} aria-pressed={selectedCamera?.id === camera.id} onClick={() => setSelectedCameraId(camera.id)}><strong>{camera.name}</strong><small>{camera.primary ? '대표 시점' : '추가 시점'}</small><span className="status-line">위치 {pct(camera.x)}%, {pct(camera.y)}% · 방향 {camera.directionDegrees}°</span></button>)}</div>{project.cameras.length === 0 && <Empty>대표 시점을 추가해 주세요.</Empty>}<div className="side-bottom"><Button icon="camera" onClick={() => addView()} disabled={project.cameras.length >= MAX_CAMERAS}>{project.cameras.length ? '시점 추가' : '대표 시점 만들기'}</Button><p className="muted small">시점 수정은 선택 사항입니다. 최대 {MAX_CAMERAS}개까지 관리합니다.</p>{selectedCamera && <Button tone="danger-quiet" icon="trash" disabled={busy} onClick={() => { const next = removeCamera(project, selectedCamera.id); if (commit(next, '시점을 삭제했습니다. 기존 이미지는 보관되며 실행 취소로 복구할 수 있습니다.')) { setSelectedCameraId(next.cameras[0]?.id ?? ''); setGenerationCameraIds(ids => ids?.filter(id => id !== selectedCamera.id) ?? null) } }}>선택한 시점 삭제</Button>}</div></aside>
      <section className="workspace-main"><div className="panel-heading"><div><p className="eyebrow">시점 위치</p><h2><NucleoIcon name="file" />시점 도면</h2></div>{renderWorkspaceToolbar('카메라 목록')}<Badge tone="info">{project.floorPlan?.geometryConfidence === 'schematic' ? '개략 도면' : '평면도'}</Badge></div><PlanCanvas quietLabels onUndo={() => restoreEdit('undo')} onRedo={() => restoreEdit('redo')} canUndo={!!editHistoryRef.current.get(project.id)?.past.length || !!undoAction && undoAction.projectId === project.id && undoAction.revision === project.commonRevision} canRedo={!!editHistoryRef.current.get(project.id)?.future.length} project={project} onDragEvent={recordCanvasDrag} mode="camera" validationMessage={planEditError} onValidationDismiss={() => { setPlanEditError(''); if (error === planEditError) setError('') }} selectedCameraId={selectedCamera?.id} onCameraSelect={setSelectedCameraId} onCameraMove={(id, x, y) => applyCameraChange(id, { x, y })} onCameraRotate={(id, directionDegrees) => applyCameraChange(id, { directionDegrees })} /></section>
      <aside className="workspace-side inspector"><div className="panel-heading"><div><p className="eyebrow">시점 설정</p><h2><NucleoIcon name="camera" />카메라 속성</h2></div></div>{selectedCamera ? <div className="inspector-content">{cameraIssues.length > 0 && <div className="camera-validation"><strong>시점 위치를 확인해 주세요</strong>{cameraIssues.map((issue) => <p key={`${issue.code}-${issue.message}`}>{issue.message}</p>)}</div>}<div className="inspector-block"><label className="field"><span>시점 이름</span><input defaultValue={selectedCamera.name} key={`${selectedCamera.id}-name`} onBlur={(event) => commit(updateCamera(project, selectedCamera.id, { name: event.target.value.trim() || selectedCamera.name }))} /></label><label className="checkbox-row"><input type="checkbox" checked={selectedCamera.primary} onChange={() => commit(updateCamera(project, selectedCamera.id, { primary: true }), '대표 시점을 변경했습니다.')} /><span>대표 시점으로 사용</span></label></div><div className="inspector-block"><h3>위치</h3><p className="muted">도면의 카메라 본체를 끌어 이동하세요.</p>{project.floorPlan?.structures.some(item => item.kind === 'door' || item.kind === 'entrance') && <Button tone="quiet" onClick={() => suggestCameraView(selectedCamera)}>입구 기준 위치 제안</Button>}<details className="inspector-numeric"><summary>좌표로 위치 조정</summary><form className="inspector-numeric__form" key={`${selectedCamera.id}-position-${selectedCamera.x}-${selectedCamera.y}`} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const x = fraction(String(data.get('x'))), y = fraction(String(data.get('y'))); if (![x,y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) { setError('위치는 0–100% 범위로 입력해 주세요.'); return } applyCameraChange(selectedCamera.id, { x, y }) }}><div className="field-grid"><label className="field"><span>X (%)</span><input name="x" type="number" min="0" max="100" defaultValue={pct(selectedCamera.x)} /></label><label className="field"><span>Y (%)</span><input name="y" type="number" min="0" max="100" defaultValue={pct(selectedCamera.y)} /></label></div><Button type="submit">위치 적용</Button></form></details></div><div className="inspector-block"><label className="field"><span><NucleoIcon name="rotate" />바라보는 방향 · {selectedCamera.directionDegrees}°</span><input type="range" min="0" max="359" value={selectedCamera.directionDegrees} onPointerDown={() => experiment.beginCameraEdit(project)} onPointerUp={() => experiment.endCameraEdit(projectRef.current)} onKeyDown={() => experiment.beginCameraEdit(project)} onKeyUp={() => experiment.endCameraEdit(projectRef.current)} onBlur={() => experiment.endCameraEdit(projectRef.current)} onChange={(event) => applyCameraChange(selectedCamera.id, { directionDegrees: Number(event.target.value) })} /></label><p className="muted small">0° 오른쪽 · 90° 아래 · 180° 왼쪽 · 270° 위쪽</p><label className="field"><span>화각</span><select value={selectedCamera.fovPreset ?? 'standard'} onChange={(event) => commit(updateCamera(project, selectedCamera.id, { fovPreset: event.target.value as Camera['fovPreset'] }))}><option value="narrow">좁게</option><option value="standard">기본</option><option value="wide">넓게</option></select></label></div><details className="inspector-block camera-advanced"><summary><span className="icon-label"><NucleoIcon name="camera" />높이·기울기 (선택 사항)</span></summary><p className="muted small">실내 치수를 측정한 값이 아닌 이미지 표현 설정입니다.</p>{selectedCamera.viewPreset!=='overview'&&<><label className="field"><span>눈높이 기준</span><select value={selectedCamera.eyeHeightPreset??'custom'} onChange={event=>{const eyeHeightPreset=event.target.value as NonNullable<Camera['eyeHeightPreset']>;commit(updateCamera(project,selectedCamera.id,{eyeHeightPreset,heightMeters:CAMERA_EYE_HEIGHT_PRESETS[eyeHeightPreset].heightMeters}))}}>{Object.entries(CAMERA_EYE_HEIGHT_PRESETS).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></label><p className="muted small">{EYE_HEIGHT_NOTICE}</p></>}<label className="field"><span>촬영 높이 (m)</span><input type="number" min=".5" max="10" step=".01" key={`${selectedCamera.id}-height-${selectedCamera.heightMeters}`} defaultValue={selectedCamera.heightMeters??CAMERA_PRESETS.custom.heightMeters} onBlur={event=>{const value=event.target.valueAsNumber;if(Number.isFinite(value)&&value>=.5&&value<=10)commit(updateCamera(project,selectedCamera.id,{heightMeters:value,eyeHeightPreset:'custom'}));else event.target.value=String(selectedCamera.heightMeters??CAMERA_PRESETS.custom.heightMeters)}} /></label><label className="field"><span>아래로 바라보기 · {Math.abs(selectedCamera.pitchDegrees??0)}°</span><input type="range" min="-90" max="0" value={selectedCamera.pitchDegrees??0} onChange={event=>commit(updateCamera(project,selectedCamera.id,{pitchDegrees:Number(event.target.value)}))} /></label></details><div className="inspector-block"><p className="muted small">시점만 수정하면 이 카메라의 이전 결과에만 오래됨 표시가 붙습니다. 공간 공통 조건은 유지됩니다.</p></div></div> : <Empty>카메라를 추가하면 속성을 편집할 수 있습니다.</Empty>}{renderWorkflowFooter()}</aside>
    </div>
  }

  function issueStep(issue: ValidationIssue): Step {
    if (['missing-plan', 'missing-existing-photo', 'plan-alignment-pending'].includes(issue.code)) return 'space'
    if (issue.code === 'partition-conflict' || issue.code === 'missing-applied-element') return 'placement'
    if (issue.code === 'missing-reference') return 'references'
    if (['missing-primary-camera', 'invalid-camera'].includes(issue.code)) return 'camera'
    if (issue.code === 'keep-conflict') {
      const element = project.elements.find((item) => item.id === issue.elementId)
      if (element?.kind === 'wall-material') return 'references'
      return 'placement'
    }
    if (issue.code === 'missing-structure') return 'placement'
    return 'placement'
  }
  async function previewSample() {
    if (generationInFlightRef.current || busy) return
    if (!preflight.valid) { setError('먼저 아래 필수 조건을 해결해 주세요.'); return }
    const cameraId = project.cameras.find(item => item.id === selectedCameraId)?.id ?? project.cameras.find(item => item.primary)?.id
    if (!cameraId) { setError('먼저 시점을 추가해 주세요.'); return }
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
    if (!generationStatus?.available) { setError(project.id.startsWith(CAMPUS_PREFIX) ? 'AI 생성 서버가 준비되지 않았습니다. 잠시 후 다시 확인해 주세요.' : 'AI 생성 서버가 준비되지 않았습니다. 데모 샘플은 계속 사용할 수 있습니다.'); return }
    const cameraIds = generationCameraIds !== null ? generationCameraIds.filter(id => project.cameras.some(camera => camera.id === id)) : [project.cameras.find(item => item.id === selectedCameraId)?.id ?? project.cameras.find(item => item.primary)?.id].filter((id): id is string => !!id)
    if (!cameraIds.length || cameraIds.some(id => !validatePreflight(project, id).valid)) { setError('생성할 시점을 선택하고 각 시점의 조건을 확인해 주세요.'); return }
    if (generationStatus.quota && cameraIds.length > Math.min(generationStatus.quota.remaining, generationStatus.quota.dailyRemaining)) { setError('선택한 시점 수가 남은 생성 횟수보다 많습니다. 시점을 줄여 주세요.'); return }
    const sourceProject = project
    const existingPhotoId = sourceProject.sourceImages.find((image) => image.id === generationExistingPhotoId && image.role === 'existing-space')?.id ??
      sourceProject.sourceImages.find((image) => image.role === 'existing-space')?.id
    generationInFlightRef.current = true
    setBusy(true); setError(''); setNotice('')
    let requestId = '', cameraId = '', generationStarted = 0, completed = 0, persistenceFailed = false
    try {
      for (const id of cameraIds) {
      cameraId = id
      if (completed) {
        requestId = ''
        setGenerationProgress(`${completed} / ${cameraIds.length} 완료 · ${sourceProject.cameras.find(camera => camera.id === id)?.name ?? '다음 시점'} 생성 준비 중…`)
        await waitForGenerationSlot(setGenerationStatus)
      }
      requestId = crypto.randomUUID(); generationStarted = Date.now()
      setGenerationProgress(`${completed + 1} / ${cameraIds.length} · ${sourceProject.cameras.find(camera => camera.id === id)?.name ?? '시점'} 생성 중`)
      experiment.record('generation_request', 'camera', cameraId, { origin: 'ai', request_id: requestId, common_revision: sourceProject.commonRevision })
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
        persistenceFailed = true
        setSaveFailed(true)
        setError('AI 이미지는 생성됐고 비용이 발생했을 수 있으나 프로젝트 기록 저장에 실패했습니다. 결과는 현재 탭에만 남아 있습니다. 새로고침하거나 다른 프로젝트로 이동하기 전에 이미지를 내보내고 저장 공간을 확인한 뒤 저장을 다시 시도해 주세요.')
      }
      // A paid image without a persisted project record must remain visible even
      // if the user opened another project while the request was running.
      if (projectRef.current.id === sourceProject.id || !persisted) {
        projectRef.current = updated
        setProject(updated)
        setSelectedResultId(result.id)
      }
      completed++
      if (!persisted) break
      }
      if (completed) { go('results'); if (!persistenceFailed) showNotice(`AI 이미지 ${completed}장을 만들었습니다. 각 시점의 구조와 조건을 직접 대조해 주세요.`) }
    } catch (cause) {
      if (cause instanceof GenerationOutcomeUnknownError) {
        experiment.record('generation_fail', 'camera', cameraId, { request_id: requestId, outcome_unknown: true, duration_ms: Date.now() - generationStarted }, 'failure')
        const now = Date.now()
        setUncertainGenerationAt(now)
        setGenerationClock(now)
        try { sessionStorage.setItem(UNKNOWN_GENERATION_SESSION_KEY, String(now)) } catch { /* Page state still blocks retry. */ }
      } else if (requestId) experiment.record('generation_fail', 'camera', cameraId, { request_id: requestId, outcome_unknown: false, duration_ms: Date.now() - generationStarted }, 'failure')
      setError(`${completed ? `${completed}장은 저장했습니다. 나머지 생성은 중단했습니다. ` : ''}${cause instanceof Error ? cause.message : 'AI 이미지를 생성하지 못했습니다. 이전 결과는 보관됩니다.'}`)
      if (completed) go('results')
    }
    finally { setGenerationStatus(await getGenerationStatus()); generationInFlightRef.current = false; setBusy(false); setGenerationProgress('') }
  }
  function renderReview() {
    const applied = project.elements.filter((item) => item.status === 'apply')
    const excluded = project.elements.filter((item) => item.status === 'exclude')
    const existingPhotos = project.sourceImages.filter((image) => image.role === 'existing-space')
    const activeExistingPhotoId = existingPhotos.some((image) => image.id === generationExistingPhotoId) ? generationExistingPhotoId : existingPhotos[0]?.id ?? ''
    const primary = project.cameras.find((item) => item.primary)
    const reviewCamera = project.cameras.find((item) => item.id === selectedCameraId) ?? primary
    const atmosphere = applied.find((item) => item.kind === 'ambient-light' || item.kind === 'global-palette')
    const feel = project.designGoal?.trim() || atmosphere?.appearance?.trim() || atmosphere?.label || project.concept.trim()
    const chosenCameraIds = generationCameraIds !== null ? generationCameraIds.filter(id => project.cameras.some(camera => camera.id === id)) : reviewCamera ? [reviewCamera.id] : []
    const batchValid = chosenCameraIds.length > 0 && chosenCameraIds.every(id => validatePreflight(project, id).valid)
    const batchFits = !generationStatus?.quota || chosenCameraIds.length <= Math.min(generationStatus.quota.remaining, generationStatus.quota.dailyRemaining)
    const firstBlockingIssue = preflight.issues.find(issue => issue.severity === 'error') ?? chosenCameraIds.flatMap(id => validatePreflight(project, id).issues).find(issue => issue.severity === 'error')
    let referencePreparationError = ''
    try {
      for (const image of project.sourceImages.filter((item) => item.role !== 'existing-space')) referencePreparationFor(project, image.id)
    } catch (cause) { referencePreparationError = cause instanceof Error ? cause.message : '레퍼런스 선택 영역을 확인해 주세요.' }
    // The issue list already explains current-view errors; only show a separate
    // blocker for another selected view so the same warning is not repeated.
    const generationBlocker = firstBlockingIssue && preflight.valid ? <div className="generation-panel__warning" role="status"><strong>생성 전에 확인할 조건</strong><p>{firstBlockingIssue.message}</p><button type="button" onClick={() => {
      const destination = issueStep(firstBlockingIssue)
      if (destination === 'placement' && firstBlockingIssue.elementId) editElement(firstBlockingIssue.elementId)
      else go(destination)
    }}>해당 항목 수정하기</button></div> : chosenCameraIds.length === 0 ? <p role="status">생성할 시점을 하나 이상 선택해 주세요.</p> : null
    return <div className="review-layout"><WorkspaceRegistration /><div className="review-main"><CameraSummary cameras={project.cameras} selectedId={reviewCamera?.id} onSelect={setSelectedCameraId} onEdit={()=>go('camera')} />
      <section className="review-plan" aria-label="생성 시점 도면"><div className="section-heading"><div><h2><NucleoIcon name="file" />배치와 시점</h2></div></div><p className="muted small">배치한 요소와 선택한 카메라를 함께 확인하세요. 카메라가 바라보는 모습은 시안을 만든 뒤 볼 수 있습니다.</p><PlanCanvas quietLabels project={project} mode="view" showCameraPreview selectedCameraId={reviewCamera?.id} /></section>
      <details className="review-overview"><summary>유지 구조·시안 방향 확인</summary><dl className="review-brief"><div><dt>유지</dt><dd>{project.keeps.map((keep) => project.floorPlan?.structures.find((item) => item.id === keep.structureId)?.name ?? keep.description).join(' · ') || '보존할 구조 없음'}</dd></div>{excluded.length > 0 && <div><dt>적용 제외</dt><dd>{excluded.map((element) => element.label).join(' · ')}</dd></div>}<div><dt>시점</dt><dd>{reviewCamera ? `${reviewCamera.name} · ${reviewCamera.fovPreset === 'wide' ? '넓은' : reviewCamera.fovPreset === 'narrow' ? '좁은' : '기본'} 화각` : '시점을 지정해 주세요'}</dd></div></dl><div className="condition-synthesis"><strong>시안의 방향</strong><p>{feel ? `분위기는 ‘${feel}’을 의도합니다.` : '분위기 조건을 추가하면 이곳에 함께 정리됩니다.'} {reviewCamera ? `${reviewCamera.name} 시점에서 검토합니다.` : '시점을 지정해 주세요.'}</p><small>입력한 조건을 정리한 설명입니다. 이미지 분석이나 생성 결과 예측은 아닙니다.</small></div></details>
      <details className="review-condition-details"><summary>세부 조건 확인·수정</summary><div>
      <section className="review-section"><div className="section-heading"><div><p className="eyebrow">01 · 보존</p><h2>유지할 구조</h2></div><Button tone="quiet" icon="edit" onClick={() => go('keep')}>보존 조건 편집</Button></div>{project.keeps.length ? <details className="review-details"><summary>보존 구조 {project.keeps.length}개 · 펼쳐서 확인하기</summary>{project.keeps.map((keep) => <div className="summary-row" key={keep.id}><span><strong>{project.floorPlan?.structures.find((item) => item.id === keep.structureId)?.name ?? '구조 없음'}</strong><small>{keep.description}</small></span><Badge tone="keep">보존</Badge></div>)}</details> : <Empty>보존할 구조가 등록되지 않았습니다.</Empty>}</section>
      <section className="review-section"><div className="section-heading"><div><p className="eyebrow">02 · 적용</p><h2>디자인 요소와 위치</h2></div><Button tone="quiet" icon="edit" onClick={() => go('references')}>요소 편집</Button></div>{applied.length ? applied.map((element) => <div className="summary-row" key={element.id}><span><strong>{element.label}</strong><small>{sourceFor(project, element.sourceReferenceId)?.name ?? '출처 없음'} · {element.sourceRegion ? '이미지 일부' : '이미지 전체'} · {targetDescription(project, element.target)}</small>{element.conditions && <small>{element.conditions}</small>}</span><Button tone="quiet" icon="edit" onClick={() => editElement(element.id)}>위치 수정</Button></div>) : <Empty>적용할 요소가 없습니다.</Empty>}</section>
      {excluded.length > 0 && <details className="review-section review-exclusions"><summary>적용하지 않는 디자인 요소 · {excluded.length}개</summary><div className="section-heading"><div><p className="eyebrow">03 · 제외</p><h2>적용하지 않는 디자인 요소</h2></div><Button tone="quiet" icon="edit" onClick={() => go('references')}>제외 조건 편집</Button></div>{excluded.length ? excluded.map((element) => <div className="summary-row" key={element.id}><span><strong>{element.label}</strong><small>{element.conditions || '결과 조건에서 제외'}</small></span><Badge tone="error">제외</Badge></div>) : <p className="muted">제외한 요소가 없습니다.</p>}</details>}
      <section className="review-section"><div className="section-heading"><div><p className="eyebrow">04 · 시점</p><h2>카메라 시점</h2></div><Button tone="quiet" icon="edit" onClick={() => go('camera')}>시점 편집</Button></div>{primary ? project.cameras.map((camera) => <div className="summary-row" key={camera.id}><span><strong>{camera.name}</strong><small>위치 {pct(camera.x)}%, {pct(camera.y)}% · 방향 {camera.directionDegrees}° · {camera.fovPreset === 'wide' ? '넓은' : camera.fovPreset === 'narrow' ? '좁은' : '기본'} 화각</small></span><Badge tone={camera.primary ? 'selected' : 'neutral'}>{camera.primary ? '대표' : '추가'}</Badge></div>) : <Empty>대표 카메라가 필요합니다.</Empty>}</section>
    </div></details>{!project.id.startsWith(CAMPUS_PREFIX) && <div className="review-sample"><div className="offline-note"><Badge tone="info">무료 샘플</Badge><p>{OFFLINE_DEMO_NOTICE}</p></div><Button tone={generationStatus?.available ? 'secondary' : 'primary'} loading={busy} onClick={previewSample} disabled={!preflight.valid || busy}>{busy ? '여는 중…' : '사전 제공 샘플 열기'}</Button></div>}</div><aside className="review-side"><div className="workflow-panel-content">
      <div className="panel-heading"><div><p className="eyebrow">미리보기 전</p><h2><NucleoIcon name="check" />조건 확인</h2></div></div>
      <div className={`review-state ${preflight.valid ? 'ready' : 'blocked'}`}><strong>{preflight.valid ? '필수 조건이 준비되었습니다' : `${preflight.issues.filter((item) => item.severity === 'error').length}개 조건을 확인하세요`}</strong><p>{preflight.valid ? '선택한 시점으로 진행할 수 있습니다.' : '각 항목을 선택하면 관련 설정으로 이동합니다.'}</p></div>

      {preflight.issues.map((issue, index) => <button key={`${issue.code}-${index}`} type="button" className="issue-row" onClick={() => { const element = project.elements.find(item => item.id === issue.elementId); const areaId = element?.target && 'areaId' in element.target ? element.target.areaId : ''; const editArea = !!areaId && ['structure-overlap', 'partition-conflict', 'area-overlap', 'pillar-collision'].includes(issue.code); const destination = editArea ? 'placement' : issueStep(issue); experiment.record('review_edit_target', 'condition', issue.elementId ?? issue.structureId ?? null, { to_step: destination, invalid_reason: issue.code }); if (destination === 'placement') { setPlanDetailTab('plan'); setLayoutTool(null); setLayoutWallDraft(null); setSelectedAreaId(editArea ? areaId : ''); } if (destination === 'space') setSpaceSourceTab('plan'); if (issue.elementId) { setSelectedElementId(issue.elementId); setPlacementSelection('element') } if (issue.structureId) { setSelectedStructureId(issue.structureId); setPlacementSelection('structure'); } if (issue.cameraId) setSelectedCameraId(issue.cameraId); go(destination) }}><span><small>확인할 항목</small>{issue.message}</span><strong>{{placement:"배치 설정",references:"요소 설정",space:"공간 설정",keep:"보존 설정",camera:"시점 설정",projects:"프로젝트",review:"조건 확인",results:"결과 확인"}[issueStep(issue)]}<NucleoIcon name="next" /></strong></button>)}

      <div className="generation-panel"><div className="generation-panel__heading"><h3>생성 설정</h3></div>{generationBlocker}{existingPhotos.length > 1 ? <label className="field"><span>생성 기준 기존 공간 사진</span><select value={activeExistingPhotoId} disabled={busy} onChange={(event) => setGenerationExistingPhotoId(event.target.value)}>{existingPhotos.map((image) => <option key={image.id} value={image.id}>{image.name}</option>)}</select></label> : existingPhotos[0] ? <p className="muted small">생성 기준 기존 공간 사진 · {existingPhotos[0].name}</p> : null}<p>선택한 시점마다 이미지 1장을 만듭니다. 시점 수만큼 생성 횟수가 차감됩니다.</p><fieldset className="generation-viewpoints"><legend>생성할 시점 · {chosenCameraIds.length}개</legend>{project.cameras.map(camera => <label className="checkbox-row" key={camera.id}><input type="checkbox" disabled={busy} checked={chosenCameraIds.includes(camera.id)} onChange={event => setGenerationCameraIds(event.target.checked ? [...chosenCameraIds, camera.id] : chosenCameraIds.filter(id => id !== camera.id))} /><span>{camera.name}{!validateCamera(project, camera.id).valid ? ' · 위치 확인 필요' : ''}</span></label>)}{!batchFits && <p role="status">선택한 시점 수가 남은 횟수보다 많습니다.</p>}</fieldset>{generationProgress && <p role="status">{generationProgress}</p>}<details className="generation-details"><summary>사용 자료·결과 안내</summary><p>기존 공간 사진 1장, 저장한 구조·배치·선택 시점을 표시한 도면 가이드, 적용한 모든 레퍼런스와 조건을 전달합니다. 일부 영역을 선택하면 해당 부분을 사용하고, 이미지가 많으면 묶어서 전달합니다. 업로드 도면은 배경으로 함께 사용하며, 도면이 없으면 직접 그린 개략 도면을 사용합니다. 원본 사진의 벽·창·문·기둥·천장과 보존한 구조를 유지하며, 보존하지 않은 이동식 책상·의자 등은 비운 공간을 가정해 저장한 배치를 적용합니다. 원본 사진 자체는 바뀌지 않습니다. 조명 요소는 빛의 특성만 적용하고 색·마감은 별도 요소로 구분합니다. 결과의 구조·치수는 직접 확인해 주세요.</p></details>{referencePreparationError && <p className="generation-panel__warning">{referencePreparationError} <button type="button" onClick={() => go('references')}>레퍼런스 수정</button></p>}{saveFailed && <p className="generation-panel__warning">프로젝트 기록 저장 문제를 해결해야 새 유료 요청을 할 수 있습니다. <button type="button" onClick={() => commit(project, '프로젝트 기록을 저장했습니다.')}>저장 다시 시도</button></p>}{uncertainGenerationAt !== null && <div className="generation-panel__warning"><strong>이전 요청의 결과가 불확실합니다</strong><p>비용이 발생했을 수 있습니다. 결과 이력과 OpenAI 사용량을 확인해 주세요. {unknownRetrySeconds > 0 ? `재시도 허용까지 ${unknownRetrySeconds}초` : '대기 시간이 지났습니다. 위험을 확인한 뒤 재시도를 허용할 수 있습니다.'}</p><button type="button" onClick={allowGenerationRetry} disabled={busy || unknownRetrySeconds > 0}>위험 확인 후 재시도 허용</button></div>}{generationStatusLoading ? <p className="muted">생성 서버 상태 확인 중…</p> : generationStatus?.available ? <>{generationStatus.quota && <p className="muted small">오늘 서비스 전체 남은 생성 {generationStatus.quota.remaining} / {generationStatus.quota.totalLimit}회 · 오늘 내 남은 생성 {generationStatus.quota.dailyRemaining} / {generationStatus.quota.dailyLimit}회{generationStatus.quota.busy ? ' · 서버에서 생성 요청 처리 중' : ''}</p>}{generationStatus.quota && <p className="muted small">서비스 전체 한도와 내 브라우저 한도는 한국 시간 자정에 초기화됩니다. 접수된 요청은 실패해도 차감됩니다.</p>}{generationStatus.quota?.remaining === 0 ? <p role="status">오늘 서비스 전체 생성 한도를 모두 사용했습니다. 한국 시간 자정 이후 다시 사용할 수 있습니다. 무료 샘플과 편집은 계속 사용할 수 있습니다.</p> : generationStatus.quota?.dailyRemaining === 0 ? <p role="status">오늘 생성 한도를 모두 사용했습니다. 한국 시간 자정 이후 다시 사용할 수 있습니다.</p> : generationStatus.quota?.busy ? <p role="status">다른 요청이 접수되어 있습니다. 잠시 후 생성 가능 여부를 다시 확인해 주세요.</p> : null}</> : <p className="muted">{project.id.startsWith(CAMPUS_PREFIX) ? '이미지 생성 서버에 연결할 수 없습니다. 잠시 후 생성 가능 여부를 다시 확인해 주세요.' : (generationStatus?.reason ?? '생성 서버를 확인할 수 없습니다. 무료 샘플은 계속 사용할 수 있습니다.')}</p>}<Button tone="quiet" icon="refresh" loading={generationStatusLoading} disabled={busy} onClick={async () => { setGenerationStatusLoading(true); setGenerationStatus(await getGenerationStatus()); setGenerationStatusLoading(false) }}>{generationStatusLoading ? '확인 중…' : '생성 가능 여부 확인'}</Button></div>

    </div><div className="workflow-footer workflow-footer--generate"><Button tone="primary" icon="image" loading={busy} onClick={generateImage} disabled={!generationStatus?.available || generationStatusLoading || !preflight.valid || busy || !batchValid || !batchFits || !!referencePreparationError || uncertainGenerationAt !== null || saveFailed || (!!generationStatus.quota && (generationStatus.quota.remaining === 0 || generationStatus.quota.dailyRemaining === 0 || generationStatus.quota.busy))}>{busy ? '처리 중…' : 'AI 이미지 생성'}</Button></div></aside></div>
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
    const snapshotProject: Project = snapshot?.common ? { ...project, ...snapshot.common, commonRevision: current!.commonRevision, cameras: [{ ...snapshot.camera, name: snapshot.camera.name ?? '저장된 시점', primary: true }], sourceImages: snapshot.common.sourceImages ?? project.sourceImages } : project
    return <div className="results-layout"><WorkspaceRegistration /><section className="result-main"><div className="panel-heading"><div><p className="eyebrow">시안 확인</p><h2>{project.cameras.find((item) => item.id === current?.cameraId)?.name ?? '결과'}</h2></div><div className="badge-line">{current?.stale && <Badge tone="error">이전 조건</Badge>}{current && <Badge tone="info">{current.origin === 'ai' ? 'AI 생성' : '사전 제공 샘플'}</Badge>}</div></div>
      {current ? <><div className="result-image-frame"><AssetImage uri={current.imageUri} alt={current.origin === 'ai' ? '현재 시점에서 AI가 생성한 공간 콘셉트 이미지' : (project.name + ' 사전 제공 샘플 이미지')} className="result-image" /><span className="result-watermark">{current.origin === 'ai' ? 'AI 생성 · 실제 시공·치수 확인 필요' : '사전 제공 샘플 · 생성 결과 아님'}</span></div><div className="result-caption"><span>버전 {project.results.indexOf(current) + 1} · {new Date(current.createdAt).toLocaleDateString('ko-KR')} · {current.approved ? '승인됨' : '검토 중'}</span><span>{current.stale ? '현재 조건과 다릅니다. 이 이미지는 그대로 보관됩니다.' : current.origin === 'ai' ? '현재 입력 조건으로 생성한 콘셉트 이미지' : '조건 기록 · 샘플 이미지와 별개'}</span></div><div className="result-actions"><Button tone={current.approved ? 'secondary' : 'primary'} icon={current.approved ? undefined : 'check'} onClick={() => commit(setResultApproved(project, current.id, !current.approved), current.approved ? '승인을 취소했습니다.' : '결과를 승인했습니다.')}>{current.approved ? '승인 취소' : '이 결과 승인'}</Button><Button onClick={() => downloadResult(current)} disabled={busy}>이미지 내보내기</Button><Button onClick={exportRecord}>작업 기록 JSON</Button>{saveFailed && <Button onClick={() => commit(project, '프로젝트 기록을 저장했습니다.')}>프로젝트 저장 다시 시도</Button>}</div><p className="muted small">{current.origin === 'ai' ? '이미지 모델은 보존 구조·위치·치수의 완전한 일치를 보장하지 않습니다. 승인 전에 직접 대조해 주세요.' : OFFLINE_DEMO_NOTICE} 작업 기록 JSON에는 업로드 원본과 결과 이미지 파일이 포함되지 않습니다.</p></> : <div className="result-empty"><Empty>{project.id.startsWith(CAMPUS_PREFIX) ? '아직 결과가 없습니다. 시안 만들기에서 조건을 확인하고 AI 이미지를 생성하세요.' : '아직 결과가 없습니다. 시안 만들기에서 사전 제공 샘플을 열거나 AI 이미지를 생성하세요.'}</Empty><Button onClick={() => go('review')}>시안 만들기로 이동</Button></div>}
      {snapshot?.common?.floorPlan && <section className="result-camera-preview"><h3><NucleoIcon name="camera" />이 결과를 바라본 위치</h3><PlanCanvas quietLabels project={snapshotProject} mode="view" showCameraPreview selectedCameraId={snapshot.camera.id} /></section>}
      {snapshot?.common?.floorPlan && <ResultPlanComparison key={current!.id} project={snapshotProject} cameraId={snapshot.camera.id} />}
      <details open className="history-section"><summary>결과 이력 · {project.results.length}개</summary><SwipeCarousel label="결과 이력" variant="history" activeId={current?.id} onActiveIdChange={setSelectedResultId} items={project.results.map((result, index) => ({ id: result.id, content: <button type="button" className={`history-item ${current?.id === result.id ? 'is-selected' : ''}`} aria-pressed={current?.id === result.id} onClick={() => setSelectedResultId(result.id)}><AssetImage uri={result.imageUri} alt={`결과 ${index + 1} 미리보기`} /><span><strong>버전 {index + 1} · {project.cameras.find((camera) => camera.id === result.cameraId)?.name ?? result.conditionsSnapshot.camera.name ?? '삭제된 시점'}</strong><small>{result.origin === 'ai' ? 'AI 생성' : '사전 제공 샘플'} · {result.approved ? '승인됨' : '검토 중'} · {result.stale ? '이전 조건' : '현재 조건'}</small></span></button> }))} /></details>
      {approved.length > 0 && <details className="moodboard-section"><summary>승인 이미지 모아보기 · {approved.length}개</summary><SwipeCarousel label="승인 이미지" variant="gallery" activeId={current?.approved ? current.id : undefined} onActiveIdChange={setSelectedResultId} items={approved.map((result) => ({ id: result.id, content: <button type="button" className={`approved-result-card ${current?.id === result.id ? 'is-selected' : ''}`} aria-pressed={current?.id === result.id} onClick={() => setSelectedResultId(result.id)}><AssetImage uri={result.imageUri} alt={`승인된 ${result.origin === 'ai' ? 'AI 생성' : '사전 제공 샘플'} 결과 버전 ${project.results.indexOf(result) + 1}`} /><span>버전 {project.results.indexOf(result) + 1} · {project.cameras.find((camera) => camera.id === result.cameraId)?.name ?? result.conditionsSnapshot.camera.name ?? '삭제된 시점'}</span></button> }))} /></details>}
    </section><aside className="result-inspector"><div className="panel-heading"><div><p className="eyebrow">이 결과의 조건</p><h2>조건 기록</h2></div></div>{snapshot ? <div className="result-conditions"><div className="condition-group result-camera-summary"><div className="group-heading"><h3>적용된 카메라 위치</h3><Button tone="quiet" icon="camera" onClick={()=>go('camera')}>시점 수정</Button></div><p>{snapshot.camera.name ?? project.cameras.find(camera=>camera.id===snapshot.camera.id)?.name ?? '저장한 시점'}</p>{snapshot.camera.viewPreset==='overview'&&<p className="muted small">높은 사선 시점 · 전체 배치</p>}</div><div className="condition-group"><div className="group-heading"><h3>적용된 레퍼런스</h3><Button tone="quiet" icon="images" onClick={()=>go('references')}>레퍼런스 수정</Button></div><div className="mapping-thumbnails">{snapshotProject.references.filter(ref=>snapshotProject.elements.some(item=>item.status==='apply'&&item.sourceReferenceId===ref.id)).map(ref=>{const image=snapshotProject.sourceImages.find(image=>image.id===ref.imageId);return image&&<div key={ref.id}><AssetImage uri={image.uri} alt={image.name} /></div>})}</div></div>{current?.origin === 'ai' && <div className="condition-group"><h3>생성 기준 사진</h3><p>{snapshot.existingPhotoId ? snapshotProject.sourceImages.find((image) => image.id === snapshot.existingPhotoId)?.name ?? '선택한 사진이 현재 목록에 없습니다.' : '이전 결과에는 기준 사진 기록이 없습니다.'}</p></div>}<div className="condition-group"><div className="group-heading"><h3>유지할 구조</h3><Button tone="quiet" onClick={() => go('keep')}>수정</Button></div><details className="result-details"><summary>보존 구조 {snapshot.common?.keeps.length ?? 0}개 펼쳐보기</summary>{(snapshot.common?.keeps ?? []).map((keep) => <p key={keep.id}>{snapshotProject.floorPlan?.structures.find((structure) => structure.id === keep.structureId)?.name ?? keep.description}</p>)}</details></div><div className="condition-group"><div className="group-heading"><h3>레이아웃 요약</h3><Button tone="quiet" icon="layers" onClick={() => go('placement')}>레이아웃 수정</Button></div>{(snapshot.common?.elements ?? []).filter((element) => element.status === 'apply').map((element) => <button key={element.id} className="condition-link" disabled={!project.elements.some((item) => item.id === element.id)} onClick={() => editElement(element.id)}><strong>{element.label}{!project.elements.some((item) => item.id === element.id) && ' · 현재 작업에서 삭제됨'}</strong><span>{sourceFor(snapshotProject, element.sourceReferenceId)?.name ?? '기본 레이아웃'} → {targetDescription(snapshotProject, element.target)}</span></button>)}</div>{snapshot.common?.designGoal?.trim() && <div className="condition-group"><h3>디자인 목표</h3><p>{snapshot.common.designGoal}</p></div>}<div className="condition-group"><div className="group-heading"><h3>제외</h3><Button tone="quiet" onClick={() => go('references')}>수정</Button></div>{(snapshot.common?.elements ?? []).filter((element) => element.status === 'exclude').map((element) => <p key={element.id}>{element.label}</p>)}</div></div> : <Empty>조건 기록이 없습니다.</Empty>}<div className="result-inspector-bottom"><Button onClick={() => { if (addView()) go('camera') }} disabled={project.cameras.length >= MAX_CAMERAS}>추가 시점 설정</Button></div>{renderWorkflowFooter()}</aside></div>
  }

  function addLayout(kind: LayoutKind, target: PlacementTarget | null, elementKind?: ElementKind) {
    const current = projectRef.current;
    if(countLayoutItems(current)>=MAX_LAYOUT_ITEMS) {
      experiment.record('layout_limit_reached','project',current.id,{count:countLayoutItems(current),limit:MAX_LAYOUT_ITEMS},'invalid');rejectPlanEdit(LAYOUT_LIMIT_MESSAGE);return;
    }
    const item = { ...createLayoutItem(current, makeId('layout'), kind), target, ...(elementKind?{kind:elementKind}:{}) };
    const next = { ...current, elements: [...current.elements, item] };
    if (target) {
      const result = validatePlacement(next, item.id, target);
      if (!result.valid) { rejectPlanEdit(result.issues.map(issue=>issue.message).join(' ')); return; }
    }
    if (commit(updateCommon(current, { elements: next.elements }), `${item.label}을 추가했습니다.`)) {
      selectPlacementElement(item.id);
      experiment.record('layout_item_add', 'element', item.id, {element_type:item.kind,layout_kind:kind,...targetPayload(target)});
      return true;
    }
  }

  function addWallLayout(wallId: string) {
    const kind = layoutTool === 'light' ? 'light' : 'wall-art';
    const elementKind = kind === 'light' ? 'wall-light' : 'wall-graphic';
    const target: Extract<PlacementTarget,{kind:'wall-segment'}> = {kind:'wall-segment',wallId,start:.1,end:kind==='light'?.2:.25};
    if(project.floorPlan?.structures.some(wall=>wall.id===wallId&&wall.role==='partition')) {
      selectPlacementStructure(wallId);
      setWallFaceDraft(null);setLayoutWallDraft({kind,elementKind,target});
      return;
    }
    addLayout(kind,target,elementKind);
  }

  function renderLayoutInspector() {
    if (layoutWallDraft) return <><h3>가벽에 붙일 면 선택</h3><WallTargetEditor key={wallEditorKey} project={project} walls={project.floorPlan?.structures.filter(wall=>wall.kind==='wall')??[]} target={layoutWallDraft.target} selection={wallEditorSelection} onSelectionChange={selection=>setWallFaceDraft({...selection,editorKey:wallEditorKey})} onApply={target=>{if(addLayout(layoutWallDraft.kind,target,layoutWallDraft.elementKind))setLayoutWallDraft(null)}} /><Button tone="quiet" onClick={()=>setLayoutWallDraft(null)}>취소</Button></>;
    if (placementSelection === 'structure') return renderStructureInspector();
    if (selectedAreaId) {
      const area = project.floorPlan?.areas.find(item=>item.id===selectedAreaId);
      if (area) return <form key={`${area.id}-${JSON.stringify(area.bounds)}`} onSubmit={event=>{event.preventDefault();updateArea(area,event.currentTarget)}}><p className="muted small area-purpose">{AREA_DESCRIPTIONS[area.kind]}</p><label className="field"><span>이름</span><input name="name" defaultValue={area.name} /></label><div className="field-grid">{(['x','y','width','height'] as const).map(key=><label className="field" key={key}><span>{{x:'왼쪽 위치',y:'위쪽 위치',width:'폭',height:'깊이'}[key]} (%)</span><input name={key} type="number" min={(key==='width'||key==='height') ? .1 : 0} max="100" step=".1" defaultValue={pct(area.bounds[key])} /></label>)}</div><Button type="submit" icon="check">변경 저장</Button><Button tone="danger-quiet" icon="trash" onClick={()=>removeArea(area)}>영역 삭제</Button></form>;
    }
    if (!selectedElement) return <Empty>도면에서 요소를 선택하면 크기와 회전을 바꿀 수 있습니다.</Empty>;
    const item=selectedElement, target=item.target;
    return <><label className="field"><span>이름 (선택 사항)</span><input defaultValue={item.label} key={`${item.id}-rename`} onBlur={event=>commit(updateElement(project,item.id,{label:event.target.value.trim()||item.label}))} /></label>
      <label className="checkbox-row"><input type="checkbox" checked={!!item.locked} onChange={event=>commit(updateElement(project,item.id,{locked:event.target.checked}))} /><span><NucleoIcon name="lock" />위치 고정</span></label>
      {target?.kind==='floor-point' ? <form key={`${item.id}-${JSON.stringify(target)}`} onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);applyElementTarget(item.id,{...target,x:fraction(String(data.get('x'))),y:fraction(String(data.get('y'))),footprint:{width:fraction(String(data.get('width'))),height:fraction(String(data.get('height')))}},true)}}><h3>크기</h3><p className="muted small">실측 치수가 없는 개략도 · 도면 비율</p><div className="field-grid">{(['width','height'] as const).map(key=><label key={key} className="field"><span>{key==='width'?'폭':'깊이'} (%)</span><input disabled={item.locked} name={key} type="number" min=".1" max="100" step=".1" defaultValue={pct(key==='width'?target.footprint?.width??.1:target.footprint?.height??.08)} /></label>)}</div><details className="inspector-position"><summary>위치 수치로 조정</summary><div className="field-grid">{(['x','y'] as const).map(key=><label key={key} className="field"><span>{key==='x'?'왼쪽 위치':'위쪽 위치'} (%)</span><input disabled={item.locked} name={key} type="number" min="0" max="100" step=".1" defaultValue={pct(target[key])} /></label>)}</div></details><Button type="submit" icon="check" disabled={item.locked}>변경 적용</Button><label className="field"><span><NucleoIcon name="rotate" />회전 · {target.rotationDegrees??0}°</span><input type="range" min="0" max="359" disabled={item.locked} value={target.rotationDegrees??0} onChange={event=>applyElementTarget(item.id,{...target,rotationDegrees:Number(event.target.value)},true)} /></label></form> : renderPlacementInspector()}
      <Button tone="danger-quiet" icon="trash" disabled={item.locked} onClick={()=>{if(commitDeletion(removeDesignElement(project,item.id),'요소를 삭제'))setSelectedElementId('')}}>요소 삭제</Button>
    </>;
  }

  function renderLayout() {
    if (!project.floorPlan) return <div className="mapping-editor"><section className="layout-canvas-panel mapping-canvas"><Empty>도면이 아직 없습니다. 공간·방향 설정에서 도면을 등록하거나 개략 도면을 시작하세요.</Empty></section><aside className="layout-panel mapping-panel"><div className="panel-heading"><h2>도면 준비</h2></div><div className="layout-tool-scroll"><p>배치할 바닥과 구조를 먼저 확인해 주세요.</p><Button onClick={()=>go('space')}>공간·방향 설정으로 이동</Button></div>{renderWorkflowFooter()}</aside></div>;
    const drawing=planDetailTab!=='plan';
    const host=planDetailTab==='structure'&&['window','door','entrance'].includes(structureKind)?drawingWall():undefined;
    const activeTool=planDetailTab==='structure'?`${structureKind}-${structureRole}`:planDetailTab==='area'?areaKind:layoutTool??undefined;
    const toolControls=drawing?<div className="layout-drawing-controls"><h3>{planDetailTab==='area'?(areaKind==='spatial'?'분위기 영역 그리기':'통행 동선 그리기'):'구조 그리기'}</h3>{planDetailTab==='area'&&<p className="muted small area-purpose">{AREA_DESCRIPTIONS[areaKind]}</p>}<p>{planDetailTab==='area'?'도면에서 대각선으로 끌어 영역을 그리세요.':host?`‘${host.name}’ 가까이에서 시작해 벽을 따라 끌어 주세요.`:['pillar','existing-light'].includes(structureKind)?'도면에서 위치를 누르세요.':'시작점에서 끝점까지 끌어 그리세요.'}</p>{host&&<label className="field"><span>붙일 벽</span><select value={host.id} onChange={event=>selectDrawingWall(event.target.value)}>{project.floorPlan.structures.filter(s=>s.kind==='wall').map(wall=><option key={wall.id} value={wall.id}>{wall.name}</option>)}</select></label>}
      {planDetailTab==='structure'&&structureKind==='wall'&&<label className="field"><span>선 방향</span><select value={lineConstraint} onChange={event=>setLineConstraint(event.target.value as typeof lineConstraint)}><option value="snap">수평·수직 맞춤</option><option value="horizontal">수평</option><option value="vertical">수직</option><option value="free">자유</option></select></label>}
      <label className="field"><span>이름 (선택 사항)</span><input value={planDetailTab==='area'?areaName:structureName} onChange={event=>planDetailTab==='area'?setAreaName(event.target.value):setStructureName(event.target.value)} placeholder="비우면 자동으로 구분합니다" /></label>
      {planDetailTab==='area'&&<label className="field"><span>윤곽</span><select value={areaShape} onChange={event=>setAreaShape(event.target.value as typeof areaShape)}><option value="rect">사각형</option><option value="polygon">점을 찍어 그리기</option></select></label>}
      <Button onClick={()=>{setPlanDetailTab('plan');setLayoutTool(null)}}>그리기 마치기</Button><p className="muted small">그린 항목은 자동 저장됩니다.</p></div>:layoutTool?<p className="layout-tool-hint">{LAYOUT_LABELS[layoutTool]}: {layoutTool==='wall-art'?'붙일 벽을 누르세요.':layoutTool==='product'?'도면의 전시대나 테이블을 누르세요. 오른쪽 목록에서도 선택할 수 있습니다.':layoutTool==='light'?(layoutLightMount==='floor'?'스탠드 조명처럼 바닥을 사용하는 조명입니다. 빈 바닥을 눌러 놓으세요.':layoutLightMount==='wall'?'붙일 벽을 누르세요. 바닥 가구와 별도로 배치됩니다.':'천장 위치를 누르세요. 바닥 가구 위에도 놓을 수 있으며 기존 천장 조명과의 겹침은 확인합니다.'):'빈 바닥을 눌러 놓으세요. 같은 도구로 계속 추가할 수 있습니다.'}</p>:null;
    const canvas=<PlanCanvas quietLabels areaSelectionMode={!layoutTool&&planDetailTab==='plan'&&(!selectedElement||!!selectedElement.target)} attachmentWallId={wallEditorSelection?.wallId} selectedWallFace={wallEditorSelection?.face} onWallFaceSelect={selectWallFace} wallAttachmentMode={layoutTool==='wall-art'||layoutTool==='light'&&layoutLightMount==='wall'} key={`${project.id}-${planDetailTab}`} project={project} mode="place" onUndo={()=>restoreEdit('undo')} onRedo={()=>restoreEdit('redo')} canUndo={!!editHistoryRef.current.get(project.id)?.past.length || !!undoAction && undoAction.projectId === project.id && undoAction.revision === project.commonRevision} canRedo={!!editHistoryRef.current.get(project.id)?.future.length} onDragEvent={recordCanvasDrag}
      drawTool={planDetailTab==='structure'?(['pillar','existing-light'].includes(structureKind)?'point':'segment'):planDetailTab==='area'?areaShape:undefined} drawStructureKind={planDetailTab==='structure'?structureKind:undefined} drawWallId={host?.id} onDrawWallSelect={host?selectDrawingWall:undefined} lineConstraint={lineConstraint} onDrawPolygon={points=>!!addArea(outlineBounds(points),points)} onDraw={planDetailTab==='structure'?drawStructure:planDetailTab==='area'?drawArea:undefined}
      selectedElementId={placementSelection==='element'?selectedElementId:undefined} selectedStructureId={placementSelection==='structure'?selectedStructureId:undefined} selectedAreaId={selectedAreaId} onAreaSelect={id=>{setSelectedAreaId(id);setPlacementSelection('element');setSelectedElementId('')}} onStructureSelect={selectPlacementStructure} onStructureMove={moveOptionalStructure} onStructureLockToggle={id=>{const item=project.floorPlan?.structures.find(item=>item.id===id);if(item)toggleKeep(item)}}
      supportPlacementMode={layoutTool==='product'} pointPlacementMode={layoutTool==='light'&&layoutLightMount!=='wall'} onSupportSelect={id=>{if(layoutTool==='product')addLayout('product',{kind:'fixture-surface',fixtureElementId:id,offset:{x:.5,y:.5}});else if(selectedElement?.kind==='display-product')applyElementTarget(selectedElement.id,{kind:'fixture-surface',fixtureElementId:id,offset:{x:.5,y:.5}},true)}} onElementSelect={id=>{if(layoutTool==='product'){rejectPlanEdit('진열 상품을 올릴 전시대나 테이블을 선택하세요.');return;}setLayoutTool(null);selectPlacementElement(id)}} onElementMove={(id,x,y)=>{const item=project.elements.find(item=>item.id===id);if(item?.target?.kind==='floor-point')applyElementTarget(id,{...item.target,x,y},true)}} onElementRotate={(id,rotationDegrees)=>{const item=project.elements.find(item=>item.id===id);if(item?.target?.kind==='floor-point')applyElementTarget(id,{...item.target,rotationDegrees},true)}} onWallElementMove={(id,wallId,start,end)=>{const item=project.elements.find(item=>item.id===id);if(item?.target?.kind==='wall-segment')applyElementTarget(id,{...item.target,wallId,start,end,face:item.target.wallId===wallId?item.target.face:undefined},true)}}
      onPlacePoint={(x,y)=>{if(layoutTool==='product'){rejectPlanEdit('진열 상품은 전시대나 테이블 위에 놓습니다. 도면의 받침을 누르거나 오른쪽에서 선택하세요.');return;}if(layoutTool==='light'&&layoutLightMount==='ceiling'){const zone=project.floorPlan?.areas.find(area=>area.kind==='ceiling'&&x>=area.bounds.x&&x<=area.bounds.x+area.bounds.width&&y>=area.bounds.y&&y<=area.bounds.y+area.bounds.height);if(zone)addLayout('light',{kind:'ceiling-zone',zoneId:zone.id,offset:{x:(x-zone.bounds.x)/zone.bounds.width,y:(y-zone.bounds.y)/zone.bounds.height}},'ceiling-light');else rejectPlanEdit('공간·방향 설정에서 실내 윤곽을 먼저 확인하세요.');return;}if(layoutTool==='light'&&layoutLightMount==='wall'){rejectPlanEdit('벽 조명은 붙일 벽을 누르세요.');return;}if(layoutTool&&!['wall-art','area','product'].includes(layoutTool))addLayout(layoutTool,{kind:'floor-point',x,y,footprint:layoutTool==='chair'?{width:.045,height:.055}:layoutTool==='light'?LIGHT_PLAN_FOOTPRINT:{width:.10,height:.07},rotationDegrees:0});else if(!layoutTool&&selectedElement&&!selectedElement.target&&allowedTargetKinds(selectedElement.kind).includes('floor-point'))applyElementTarget(selectedElement.id,{kind:'floor-point',x,y,footprint:{width:.10,height:.07}},true)}}
      onWallSelect={id=>{if(layoutTool==='wall-art'||layoutTool==='light'&&layoutLightMount==='wall')addWallLayout(id);else if(!layoutTool)selectPlacementStructure(id)}} validationMessage={planEditError} onValidationDismiss={()=>setPlanEditError('')} />;
    return <LayoutWorkspace footer={renderWorkflowFooter()} project={project} canvas={canvas} inspectorTitle={drawing?'그리기 설정':layoutWallDraft?'부착 위치 설정':'선택 요소 설정'} inspector={layoutWallDraft?renderLayoutInspector():drawing?toolControls:<>{layoutTool==='light'&&<label className="field"><span>조명 설치 위치</span><select value={layoutLightMount} onChange={event=>setLayoutLightMount(event.target.value as typeof layoutLightMount)}><option value="floor">바닥에 세우기</option><option value="wall">벽에 부착</option><option value="ceiling">천장에 설치</option></select></label>}{toolControls}{layoutTool==='product'&&<div>{!project.elements.some(isDisplaySupport)&&<p className="muted small">먼저 전시대나 테이블을 배치한 뒤 진열 상품을 올려 주세요.</p>}{project.elements.filter(isDisplaySupport).map(item=><Button key={item.id} disabled={countLayoutItems(project)>=MAX_LAYOUT_ITEMS||!item.target} icon="add" onClick={()=>addLayout('product',{kind:'fixture-surface',fixtureElementId:item.id,offset:{x:.5,y:.5}})}>{item.label}{item.target?' 위에 놓기':' · 위치 먼저 지정'}</Button>)}</div>}{renderLayoutInspector()}</>} tools={<>{project.floorPlan.areas.length>0&&<details><summary>영역 목록</summary>{project.floorPlan.areas.map(area=><button className="button" key={area.id} onClick={()=>{setPlanDetailTab('plan');setLayoutTool(null);setSelectedAreaId(area.id);setPlacementSelection('element');setSelectedElementId('')}}>{area.name}</button>)}</details>}</>} activeTool={activeTool} selectedId={selectedElementId}
      onItemTool={kind=>{setLayoutWallDraft(null);setSelectedAreaId('');if(kind){setPlacementSelection('element');setSelectedElementId('')}setLayoutTool(kind);setPlanDetailTab('plan');setPlanEditError('')}} onStructureTool={(kind,role)=>{setLayoutWallDraft(null);setLayoutTool(null);chooseStructureTool(kind,role)}} onAreaTool={kind=>{setLayoutWallDraft(null);setPlacementSelection('element');setSelectedElementId('');setSelectedAreaId('');setLayoutTool(null);setAreaKind(kind);setPlanDetailTab('area');setPlanEditError('')}} onSelect={item=>{setLayoutTool(null);setPlanDetailTab('plan');selectPlacementElement(item.id)}} />;
  }

  function selectMappingTarget(id: string, multi=false) {
    setMappingIds(ids=>multi||mappingMulti ? ids.includes(id)?ids.filter(item=>item!==id):[...ids,id] : [id]);
  }
  function applyMapping(ids=mappingIds, refId=referenceFocus, region=referenceRegionDraft??undefined) {
    const current=projectRef.current;
    let draft=current;
    const itemIds:string[]=[];
    for(const id of ids) {
      if(current.elements.some(item=>item.id===id)){itemIds.push(id);continue;}
      let target:PlacementTarget;
      if(id==='whole-space')target={kind:'whole-space'};
      else if(id.startsWith('wall:')) {
        const wallId=id.slice(5),wall=current.floorPlan?.structures.find(item=>item.id===wallId);
        if(wall?.role==='partition'&&!mappingFace){setError('가벽의 어느 면에 적용할지 A면 또는 B면을 선택하세요.');return;}
        const existing=current.elements.find(item=>item.target?.kind==='wall-segment'&&item.target.wallId===wallId&&item.target.face===mappingFace&&item.kind===(mappingScope==='lighting'?'wall-light':mappingScope==='material'?'wall-material':'wall-graphic'));
        if(existing){itemIds.push(existing.id);continue;}
        target={kind:'wall-segment',wallId,start:.05,end:.20,...(wall?.role==='partition'?{face:mappingFace}: {})};
      } else {
        const area=current.floorPlan?.areas.find(item=>item.id===id.slice(5));
        if(!area||area.kind==='passage'){setError('사용 가능한 공간 영역을 선택하세요.');return;}
        target=mappingScope==='material'&&area.kind==='floor'?{kind:'floor-area',areaId:area.id}:{kind:'named-area',areaId:area.id};
      }
      const existing=draft.elements.find(item=>JSON.stringify(item.target)===JSON.stringify(target)&&item.layoutKind==='area'&&item.kind===targetCondition(draft,'',target,mappingScope).kind);
      if(existing){itemIds.push(existing.id);continue;}
      let item=targetCondition(draft,makeId('layout'),target,mappingScope);
      if(target.kind==='wall-segment') {
        for(let start=.05;start<.8;start+=.1){const candidate={...item,target:{...target,start,end:start+.15}};if(validatePlacement({...draft,elements:[...draft.elements,candidate]},candidate.id,candidate.target).valid){item=candidate;break;}}
      }
      draft={...draft,elements:[...draft.elements,item]};itemIds.push(item.id);
    }
    const result=bindReference(draft,refId,itemIds,region,mappingScope);
    if(result.error){setError(result.error);return;}
    // Geometry and bindings commit together so Undo restores one complete operation.
    const next=updateCommon(current,{elements:result.project.elements,referenceBindings:result.project.referenceBindings});
    if(commit(next,`${itemIds.length}개 대상에 참고 이미지를 연결했습니다.`)){setMappingIds(itemIds);experiment.record('reference_binding_apply','reference',refId,{target_count:itemIds.length});}
  }
  function renderMapping() {
    const ref=project.references.find(item=>item.id===referenceFocus)??project.references[0];
    return <MappingWorkspace footer={renderWorkflowFooter()} project={project} referenceId={ref?.id??''} onReference={setReferenceFocus} region={referenceRegionDraft} onRegion={setReferenceRegionDraft} multi={mappingMulti} onMulti={setMappingMulti} selectedIds={mappingIds} scope={mappingScope} onScope={setMappingScope}
      upload={<><details className="mapping-upload-kind"><summary>상품 사진을 등록하나요?</summary><label className="checkbox-row"><input type="checkbox" checked={mappingImageRole==='product'} onChange={event=>setMappingImageRole(event.target.checked?'product':'inspiration')} /><span>상품 자체의 사진</span></label><p className="muted small">진열할 상품의 모습이 중심인 사진이면 선택하세요. 공간·가구·조명 참고 사진은 선택하지 않아도 됩니다. 가져올 내용은 아래에서 정합니다.</p></details><FilePick label={busy?'등록 중…':'레퍼런스 추가'} disabled={busy||countReferenceImages(project)>=MAX_REFERENCE_IMAGES} onFile={file=>uploadImage(file,mappingImageRole,mappingImageRole==='product'?'product':'element')} /></>}
      onApply={()=>applyMapping(mappingIds,ref?.id??'')} onWholeSpace={()=>setMappingIds(['whole-space'])} onUnbind={id=>{commit(unbindReference(project,id),'연결을 해제했습니다. 레이아웃은 유지됩니다.');experiment.record('reference_binding_remove','binding',id)}} onBindingScope={(id,scope)=>{const result=changeBindingScope(projectRef.current,id,scope);if(result.error){setError(result.error);return false;}const saved=commit(result.project,'가져올 내용을 변경했습니다.');if(saved)experiment.record('reference_binding_apply','binding',id,{scope});return saved;}} onDelete={id=>{setPendingReferenceDelete(id)}}
      targetOptions={<>{mappingIds.some(id=>id.startsWith('wall:')&&project.floorPlan?.structures.some(wall=>wall.id===id.slice(5)&&wall.role==='partition'))&&<label className="field"><span>가벽의 붙일 면</span><select value={mappingFace??''} onChange={event=>setMappingFace(event.target.value as 'a'|'b')}><option value="">면을 선택하세요</option><option value="a">A면 · 벽의 A 표시 쪽</option><option value="b">B면 · 반대쪽</option></select></label>}{pendingReferenceDelete&&<div className="mapping-delete-confirm" role="group" aria-label="레퍼런스 삭제 확인"><button type="button" className="notice-dismiss" aria-label="삭제 확인 닫기" onClick={()=>setPendingReferenceDelete(null)}><NucleoIcon name="close" /></button><p>이미지를 삭제할까요? 배치와 이전 결과는 유지되고 현재 연결만 해제됩니다.</p><Button tone="danger" onClick={()=>{const id=pendingReferenceDelete;commitDeletion(removeReference(project,id),'참고 이미지를 삭제',{referenceId:id});setPendingReferenceDelete(null);setReferenceFocus('')}}>이미지 삭제</Button><Button onClick={()=>setPendingReferenceDelete(null)}>취소</Button></div>}</>}
      canvas={<PlanCanvas quietLabels project={project} mode="mapping" selectedWallFace={mappingFace} onWallFaceSelect={(_wallId,face)=>setMappingFace(face)} mappingSelectedIds={mappingIds} onMappingSelect={selectMappingTarget} onReferenceDrop={(id,refId,region)=>applyMapping(mappingIds.includes(id)&&mappingIds.length>1?mappingIds:[id],refId,region)} onDragEvent={recordCanvasDrag} onElementMove={(id,x,y)=>{if(projectRef.current.elements.find(item=>item.id===id)?.locked)return;const target=translatedElementTarget(projectRef.current,id,{x,y});if(target)applyElementTarget(id,target,true)}} onWallElementMove={(id,wallId,start,end)=>{const item=projectRef.current.elements.find(item=>item.id===id);if(item&&!item.locked&&item.target?.kind==='wall-segment')applyElementTarget(id,{...item.target,wallId,start,end,face:item.target.wallId===wallId?item.target.face:undefined},true)}} onUndo={()=>restoreEdit('undo')} onRedo={()=>restoreEdit('redo')} canUndo={!!editHistoryRef.current.get(project.id)?.past.length || !!undoAction && undoAction.projectId === project.id && undoAction.revision === project.commonRevision} canRedo={!!editHistoryRef.current.get(project.id)?.future.length} />} />;
  }

  async function uploadConcept(file:File) {
    if (projectRef.current.references.filter(reference => reference.role === 'ambience').length >= STUDY_START.maxConceptImages) { setError(`전체 분위기 이미지는 최대 ${STUDY_START.maxConceptImages}장까지 추가할 수 있습니다.`); return; }
    const uploadProjectId=projectRef.current.id;
    const before=new Set(projectRef.current.references.map(item=>item.id));
    await uploadImage(file,'inspiration','ambience');
    const current=projectRef.current, ref=current.references.find(item=>!before.has(item.id));
    if(!ref||current.id!==uploadProjectId)return;
    const item=targetCondition(current,makeId('layout'),{kind:'whole-space'},'material');
    const bound=bindReference({...current,elements:[...current.elements,item]},ref.id,[item.id],undefined,'material');
    if(!bound.error)commit(updateCommon(current,{elements:bound.project.elements,referenceBindings:bound.project.referenceBindings}));
  }
  function saveSpaceOutline(bounds: Rect, outline?: Point[]) {
    const current=projectRef.current, plan=current.floorPlan;if(!plan)return false;
    const oldFloor=plan.areas.find(area=>area.kind==='floor');
    const area:Area={id:oldFloor?.id??makeId('floor'),name:oldFloor?.name??'실내 윤곽',kind:'floor',bounds,...(outline?{outline}:{})};
    const checked=validateAreaDrawing({...current,floorPlan:{...plan,areas:plan.areas.filter(item=>item.id!==area.id)}},area);
    if(!checked.valid){rejectPlanEdit(checked.issues.map(issue=>issue.message).join(' '));return false;}
    const ceiling=plan.areas.find(item=>item.kind==='ceiling');
    const mirror=!ceiling||oldFloor&&JSON.stringify(ceiling.bounds)===JSON.stringify(oldFloor.bounds)&&JSON.stringify(ceiling.outline)===JSON.stringify(oldFloor.outline);
    const areas=plan.areas.filter(item=>item.id!==area.id&&(!mirror||item.id!==ceiling?.id));
    areas.push(area);
    if(mirror)areas.push({id:ceiling?.id??makeId('ceiling'),name:ceiling?.name??'실내 천장 범위',kind:'ceiling',bounds,...(outline?{outline}:{})});
    if(commit(updateCommon(current,{floorPlan:{...plan,areas}}),'실내 윤곽을 저장했습니다. 실제 치수는 확인되지 않았습니다.')) {setPlanEditError('');return true;}
    return false;
  }
  function renderSpaceSetup() {
    const existing = project.sourceImages.filter(image => image.role === 'existing-space');
    const conceptCount = project.references.filter(reference => reference.role === 'ambience').length;
    const fixedScenario = project.floorPlan?.structures.some(item => item.preservationRequired);
    return <SpaceDirection project={project} tab={spaceSourceTab} onTab={setSpaceSourceTab}
      photos={existing.length ? <SwipeCarousel label="실제 공간 사진" variant="photo" compactControls items={existing.map(image => ({ id: image.id, content: <figure><AssetImage uri={image.uri} alt={image.name} className="space-photo" /><figcaption>{image.name}</figcaption></figure> }))} /> : <Empty>꾸밀 실제 공간의 사진을 추가하세요.</Empty>}
      plan={project.floorPlan ? <PlanCanvas key={`${project.id}-${spaceOutlineEditing}`} quietLabels project={project} mode="keep" onUndo={() => restoreEdit('undo')} onRedo={() => restoreEdit('redo')} canUndo={!!editHistoryRef.current.get(project.id)?.past.length || !!undoAction && undoAction.projectId === project.id && undoAction.revision === project.commonRevision} canRedo={!!editHistoryRef.current.get(project.id)?.future.length} drawTool={spaceOutlineEditing ? 'polygon' : undefined} onDrawPolygon={points => saveSpaceOutline(outlineBounds(points), points)} validationMessage={planEditError} onValidationDismiss={() => setPlanEditError('')} selectedStructureId={selectedStructureId} onStructureSelect={setSelectedStructureId} onStructureLockToggle={id => { const item = project.floorPlan?.structures.find(item => item.id === id); if (item) toggleKeep(item); }} /> : <div className="empty-state"><p>도면을 업로드하거나 실측하지 않은 개략 도면으로 시작하세요.</p>{(['landscape', 'portrait', 'outline'] as const).map(shape => <Button key={shape} onClick={() => commit(updateCommon(project, { floorPlan: newPlan('schematic', undefined, shape) }))}>{shape === 'landscape' ? '가로 개략도' : shape === 'portrait' ? '세로 개략도' : '빈 도면에서 직접 그리기'}</Button>)}</div>}
      sourceActions={fixedScenario ? null : spaceSourceTab === 'photo' ? <FilePick label="사진 추가" disabled={busy} onFile={file => uploadImage(file, 'existing-space')} /> : <FilePick icon="file" label="도면 업로드" disabled={busy} onFile={uploadPlan} />}
      conceptUpload={<FilePick label="클릭 또는 파일 드래그하여 이미지 추가" sourceIcon={<img src="/figma/source/image-upload.svg" alt="" aria-hidden="true" />} disabled={busy || countReferenceImages(project) >= MAX_REFERENCE_IMAGES || conceptCount >= STUDY_START.maxConceptImages} onFile={uploadConcept} />}
      onDeleteConcept={id => commitDeletion(removeReference(project, id), '방향 이미지를 삭제', { referenceId: id })}
      onToggleKeep={toggleKeep} onSelectStructure={setSelectedStructureId}
      onGoal={designGoal => commit(updateCommon(project, { designGoal }))} onNext={() => go('placement')}
      planReplacementControls={!fixedScenario && spaceSourceTab === 'plan' && project.floorPlan && <details className="space-project-details"><summary>도면 교체 옵션</summary><label className="field"><span>새 도면 업로드 시 표시 처리</span><select value={planReplacement} onChange={event=>setPlanReplacement(event.target.value as 'fresh'|'retain')}><option value="fresh">새 도면 위에 다시 표시 (기존 배치 해제·되돌리기 가능)</option><option value="retain">기존 표시 유지 후 새 도면에 맞추기</option></select></label><p className="muted small">기존 표시를 유지해도 새 도면의 윤곽·구조·배치를 직접 확인해야 합니다.</p></details>}
      outlineControls={<>{!fixedScenario && <details className="space-project-details"><summary>프로젝트 정보</summary><label className="field"><span>프로젝트 이름</span><input key={`${project.id}-name`} defaultValue={project.name} onBlur={event => commit(updateCommon(project, { name: event.target.value.trim() || project.name }))} /></label><label className="field"><span>공간 설명</span><textarea key={`${project.id}-concept`} defaultValue={project.concept} onBlur={event => commit(updateCommon(project, { concept: event.target.value }))} /></label></details>}{project.floorPlan && (project.floorPlan.kind === 'uploaded' || !project.floorPlan.areas.some(area => area.kind === 'floor')) && <div className="space-outline-setup"><h3><NucleoIcon name="file" />실내 윤곽 확인</h3><p className="muted small">도면에서 실내 바깥 경계를 따라 점을 찍으세요. 사진에서 자동으로 측정하거나 구조를 추출하지 않습니다.</p><Button icon="edit" onClick={() => { setSpaceSourceTab('plan'); setSpaceOutlineEditing(value => !value); }}>{spaceOutlineEditing ? '윤곽 표시 마치기' : '실내 윤곽 표시'}</Button>{spaceOutlineEditing && <p className="muted small">마지막 점에서 Enter로 윤곽을 저장합니다.</p>}</div>}{project.planAlignmentPending && <div className="mapping-delete-confirm"><p>새 도면 위의 바닥·구조·배치를 확인해 주세요.</p><Button disabled={!project.floorPlan?.areas.some(area => area.kind === 'floor')} onClick={() => commit(updateCommon(project, { planAlignmentPending: false }))}>도면 대응 확인 완료</Button></div>}</>}
    />;
  }

  return <div className={`app-shell ${step === 'projects' ? 'app-shell--projects app-shell--welcome' : `app-shell--project app-shell--${step}`}`}><header className="app-header"><div className="header-inner"><button className="brand" onClick={() => { if (step === 'projects') projectLibraryDialog.current?.showModal(); else go('projects'); }} aria-label="프로젝트 목록으로 이동"><img className="brand-mark" src={step === 'projects' ? '/brand/figma-mark-dark.svg' : '/brand/figma-mark.svg'} alt="" aria-hidden="true" width="30" height="30" /><span><img className="brand-wordmark" src={step === 'projects' ? '/brand/figma-wordmark-dark.svg' : '/brand/figma-wordmark.svg'} alt="ReSpace" /><small>전시·팝업 공간 디자인</small></span></button>
      {step !== 'projects' &&
        <nav ref={stepNavRef} className="step-nav" aria-label="작업 단계">
          <div className="step-nav-inner">{WORKFLOW.map((group, index) => <button
            key={group.label}
            title={`${String(index + 1).padStart(2, '0')}. ${group.label}`}
            aria-label={`${String(index + 1).padStart(2, '0')} ${group.label}`}
            type="button"
            className={`step-link ${workflowIndex(step) === index ? 'is-current' : workflowIndex(step) > index ? 'is-before' : ''}`}
            aria-current={workflowIndex(step) === index ? 'step' : undefined}
            onClick={() => go(group.steps[0])}
          >
            <span className="step-marker"><WorkflowStepIcon index={index} state={workflowIndex(step) === index ? 'current' : workflowIndex(step) > index ? 'before' : 'upcoming'} /></span>
            <span className="step-label">{String(index + 1).padStart(2, '0')}. {group.label}</span>
          </button>)}</div>
        </nav>}
      <div className="header-right">{saveFailed && <span className={`save-status ${saveFailed ? 'save-status--error' : ''}`} role="status"><NucleoIcon name={saveFailed ? 'warning' : 'check'} />{saveFailed ? '저장 확인 필요' : '이 브라우저에 자동 저장'}</span>}<a className="button button-quiet help-link" href="/guide/index.html" target="_blank" rel="noopener noreferrer" aria-label="사용 가이드 (새 탭)"><img src="/figma/source/guide-info.svg" alt="" aria-hidden="true" />사용 가이드</a></div></div></header>
    <main className={`main-content ${step === 'projects' ? 'project-main' : ''}`}><div className="notification-stack" aria-label="작업 알림">      {error && <TimedNotice lifetimeKey={error} className="alert alert-error" role="alert" closeLabel="오류 닫기" onDismiss={()=>setError('')}><NucleoIcon name="warning" /><strong>확인 필요</strong><span>{error}</span></TimedNotice>}{notice && <TimedNotice lifetimeKey={noticeSerial} className="alert alert-info" closeLabel="알림 닫기" onDismiss={()=>setNotice('')}><NucleoIcon name="info" /><span>{notice}</span></TimedNotice>}
      {undoAction && undoAction.projectId === project.id && <TimedNotice lifetimeKey={undoAction.revision} className="undo-banner" closeLabel="되돌리기 안내 닫기"><span>{undoAction.label}했습니다. 실행 취소로 복구할 수 있습니다.</span><Button onClick={undoDeletion}>삭제 되돌리기</Button></TimedNotice>}
</div><div className="content-wrap">{step !== 'projects' && <div className="page-intro">
        <div><p className="eyebrow">{project.name} · {WORKFLOW[workflowIndex(step)]?.label} · {workflowIndex(step) + 1} / 4</p><h1 ref={pageTitleRef} tabIndex={-1}><NucleoIcon name={WORKFLOW[workflowIndex(step)].icon} />{WORKFLOW[workflowIndex(step)].label}</h1><p className="lede">{step==='space'?'실제 공간과 유지할 구조, 전체 연출 방향을 확인하세요.':step==='placement'?'가구와 구조, 영역을 먼저 도면에 배치하세요.':step==='references'?'이미지에서 가져올 부분을 골라 배치한 요소에 연결하세요.':STEP_DESCRIPTIONS[step]}</p></div>
      </div>}
      {workflowIndex(step)===3 && <div className="generation-stage-tabs" aria-label="시안 생성 작업">{(['review','results'] as const).map(item=><button key={item} disabled={item==='results'&&!project.results.length} title={item==='results'&&!project.results.length?'시안을 만들면 결과를 확인할 수 있습니다.':undefined} aria-current={step===item?'page':undefined} onClick={()=>go(item)}><NucleoIcon name={item==='review'?'check':'images'} />{item==='review'?'생성 전 확인':'결과 확인·수정'}</button>)}</div>}
      <div className={`page-workspace page-workspace--${step}`} role="region" aria-label={`${STEP_LABELS[step]} 작업 영역`} onKeyDown={step === 'placement' ? deleteLayoutSelection : undefined}>{step === 'projects' && <WelcomeScreen onPrepare={prepareStudy} onEnter={() => { if (preparedStudyRef.current) open(preparedStudyRef.current); }} library={renderProjects()} libraryDialog={projectLibraryDialog} />}{step === 'space' && (project.layoutVersion===2?renderSpaceSetup():renderSpace())}{step === 'keep' && renderKeep()}{step === 'references' && (project.layoutVersion===2?renderMapping():renderReferences())}{step === 'placement' && (project.layoutVersion===2?renderLayout():renderPlacement())}{step === 'camera' && renderCamera()}{step === 'review' && renderReview()}{step === 'results' && renderResults()}</div>
      {((step === 'camera' || (step === 'placement' && project.layoutVersion !== 2)) && !showWorkspaceRight) && renderWorkflowFooter()}
      {step !== 'projects' && <ExperimentPanel recorder={experiment} project={project} step={step} />}
    </div></main>

  </div>
}
