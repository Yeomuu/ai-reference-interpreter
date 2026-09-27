import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Area, Camera, DesignElement, ElementKind, FloorPlan, PlacementTarget, Project, Reference, Result, SourceImage, Structure, ValidationIssue } from '../domain'
import { addCamera, allowedTargetKinds, appendResult, createEmptyProject, placeElement, removeKeep, setResultApproved, targetLabel, updateCamera, updateCommon, updateElement, updateKeep, updatePhotoAnchor, upsertKeep, validateCamera, validatePartitionPlacement, validatePreflight, validateStructureOperation } from '../domain'
import { createSampleProject } from '../data/sample'
import { loadProjects, saveProject } from '../services/persistence'
import { deleteImageAsset, putImageAsset, resolveImageUri, revokeImageUrl, validateImageFile } from '../services/assets'
import { OFFLINE_DEMO_NOTICE, createApiImageProvider, getGenerationStatus, offlineDemoProvider } from '../services/imageProvider'
import type { GenerationStatus } from '../services/imageProvider'
import AssetImage from '../components/AssetImage'
import PlanCanvas from '../components/PlanCanvas'
import PhotoKeepOverlay from '../components/PhotoKeepOverlay'
import SwipeCarousel from '../components/SwipeCarousel'
import NucleoIcon from '../components/NucleoIcon'
import type { NucleoIconName } from '../components/NucleoIcon'

const STEPS = ['space', 'keep', 'references', 'placement', 'camera', 'review', 'results'] as const
type Step = typeof STEPS[number] | 'projects'
const STEP_LABELS: Record<Step, string> = {
  projects: '프로젝트', space: '공간 자료', keep: 'Keep', references: '레퍼런스',
  placement: '공간 배치', camera: '시점', review: '조건 검토', results: '결과',
}
const STEP_ICONS: Record<Exclude<Step, 'projects'>, NucleoIconName> = {
  space: 'images', keep: 'lock', references: 'image', placement: 'layers',
  camera: 'camera', review: 'check', results: 'images',
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
      { id: makeId('wall'), kind: 'wall', name: '윗벽', geometry: { kind: 'segment', start: { x: .08, y: .10 }, end: { x: .92, y: .10 } }, immutable: true, protected: true },
      { id: makeId('wall'), kind: 'wall', name: '오른쪽 벽', geometry: { kind: 'segment', start: { x: .92, y: .10 }, end: { x: .92, y: .90 } }, immutable: true, protected: true },
      { id: makeId('wall'), kind: 'wall', name: '아랫벽', geometry: { kind: 'segment', start: { x: .92, y: .90 }, end: { x: .08, y: .90 } }, immutable: true, protected: true },
      { id: makeId('wall'), kind: 'wall', name: '왼쪽 벽', geometry: { kind: 'segment', start: { x: .08, y: .90 }, end: { x: .08, y: .10 } }, immutable: true, protected: true },
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
    const next = { ...item, photoAnchor: item.photoAnchor ?? standard.photoAnchor, immutable: true, protected: true }
    if (JSON.stringify(next) !== JSON.stringify(item)) changed = true
    return next
  })
  const keeps = [...project.keeps]
  for (const keep of template.keeps) {
    if (!keeps.some((item) => item.structureId === keep.structureId)) { keeps.push(keep); changed = true }
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
    return { ...structure, immutable: true, protected: true }
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
function Button({ children, onClick, tone = 'secondary', disabled, type = 'button', className = '', icon, iconAfter = false }: {
  children: ReactNode, onClick?: () => void, tone?: 'primary' | 'secondary' | 'quiet' | 'danger',
  disabled?: boolean, type?: 'button' | 'submit', className?: string, icon?: NucleoIconName, iconAfter?: boolean,
}) {
  return <button type={type} className={`button button-${tone} ${className}`} onClick={onClick} disabled={disabled}>{icon && !iconAfter && <NucleoIcon name={icon} />}{children}{icon && iconAfter && <NucleoIcon name={icon} />}</button>
}
function FilePick({ label, onFile, accept = 'image/png,image/jpeg,image/webp', tone = 'secondary' }: {
  label: string, onFile: (file: File) => void, accept?: string, tone?: 'primary' | 'secondary',
}) {
  return <label className={`button button-${tone} file-pick`}><span>{label}</span><input type="file" accept={accept} onChange={(event) => {
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
  const [projects, setProjects] = useState<Project[]>(() => { try { return loadProjects() } catch { return [] } })
  const [project, setProject] = useState<Project>(() => { try { return restoreProjectAnnotations(loadProjects().find((item) => item.id === 'aura-popup') ?? createSampleProject()) } catch { return createSampleProject() } })
  const projectRef = useRef(project)
  const [step, setStep] = useState<Step>('projects')
  const [notice, setNotice] = useState('')
  const [noticeSerial, setNoticeSerial] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null)
  const [generationStatusLoading, setGenerationStatusLoading] = useState(false)
  const [generationAccessCode, setGenerationAccessCode] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const [alignmentChecked, setAlignmentChecked] = useState(false)
  const [selectedStructureId, setSelectedStructureId] = useState('wall-north')
  const [selectedElementId, setSelectedElementId] = useState('element-display')
  const [selectedCameraId, setSelectedCameraId] = useState('camera-entrance')
  const [selectedResultId, setSelectedResultId] = useState('result-sample-entrance')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('')
  const [newConcept, setNewConcept] = useState('')
  const [elementLabel, setElementLabel] = useState('')
  const [elementKind, setElementKind] = useState<ElementKind>('freestanding-fixture')
  const [elementReferenceId, setElementReferenceId] = useState('')
  const [structureKind, setStructureKind] = useState<Structure['kind']>('pillar')
  const [structureName, setStructureName] = useState('')
  const [structureX, setStructureX] = useState('50')
  const [structureY, setStructureY] = useState('50')
  const [structureEndX, setStructureEndX] = useState('65')
  const [structureEndY, setStructureEndY] = useState('50')
  const [structureParent, setStructureParent] = useState('')
  const [structureRole, setStructureRole] = useState<'base' | 'partition'>('base')
  const [structureLightTone, setStructureLightTone] = useState('온백색')
  const [planDetailTab, setPlanDetailTab] = useState<'plan' | 'structure' | 'area'>('plan')
  const [showWorkspaceLeft, setShowWorkspaceLeft] = useState(true)
  const [showWorkspaceRight, setShowWorkspaceRight] = useState(true)
  const [areaKind, setAreaKind] = useState<Area['kind']>('spatial')
  const [areaName, setAreaName] = useState('')
  const [areaX, setAreaX] = useState('30')
  const [areaY, setAreaY] = useState('30')
  const [areaWidth, setAreaWidth] = useState('20')
  const [areaHeight, setAreaHeight] = useState('20')
  const [referenceFocus, setReferenceFocus] = useState('')
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const [conditionDraft, setConditionDraft] = useState('')
  const [appearanceDraft, setAppearanceDraft] = useState('')
  const [kindDraft, setKindDraft] = useState<ElementKind>('freestanding-fixture')
  const [pendingPlacement, setPendingPlacement] = useState<{ elementId: string, target: PlacementTarget, warnings: string[] } | null>(null)
  const pageTitleRef = useRef<HTMLHeadingElement>(null)
  const stepNavRef = useRef<HTMLElement>(null)
  const generationInFlightRef = useRef(false)

  const selectedElement = project.elements.find((item) => item.id === selectedElementId)
  const selectedStructure = project.floorPlan?.structures.find((item) => item.id === selectedStructureId)
  const selectedCamera = project.cameras.find((item) => item.id === selectedCameraId) ?? project.cameras[0]
  const selectedResult = project.results.find((item) => item.id === selectedResultId) ?? project.results.at(-1)
  const preflight = useMemo(() => validatePreflight(project, selectedCameraId || undefined), [project, selectedCameraId])

  function showNotice(message: string) { setNotice(message); setNoticeSerial((value) => value + 1) }
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [notice, noticeSerial])
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
    try {
      saveProject(next)
      setSaveFailed(false)
      projectRef.current = next
      setProject(next)
      setProjects(loadProjects())
      setError('')
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
    setReferenceFocus('')
    setElementReferenceId('')
    setEditingElementId(null)
    setStep('space')
    try { saveProject(restored); setProjects(loadProjects()); setSaveFailed(false) } catch (cause) { setSaveFailed(true); setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.') }
  }
  function createProject() {
    if (!newName.trim()) { setError('프로젝트 이름을 입력해 주세요.'); return }
    const next = updateCommon(createEmptyProject(makeId('project'), newName.trim()), { spaceType: newType.trim(), concept: newConcept.trim() })
    if (!commit(next, '새 프로젝트를 만들었습니다.')) return
    setSelectedStructureId(''); setSelectedElementId(''); setSelectedCameraId(''); setSelectedResultId('')
    setAlignmentChecked(false); setStructureParent(''); setReferenceFocus(''); setElementReferenceId('')
    setEditingElementId(null)
    setNewName(''); setNewType(''); setNewConcept('')
    setStep('space')
  }
  function go(next: Step) {
    if (next === 'placement' && !project.elements.some((item) => item.id === selectedElementId && item.status === 'apply')) {
      setSelectedElementId(project.elements.find((item) => item.status === 'apply')?.id ?? '')
    }
    setPendingPlacement(null)
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.requestAnimationFrame(() => pageTitleRef.current?.focus({ preventScroll: true }))
  }
  function editElement(id: string) { go('placement'); setSelectedElementId(project.elements.some((item) => item.id === id && item.status === 'apply') ? id : project.elements.find((item) => item.status === 'apply')?.id ?? '') }
  function beginConditionEdit(element: DesignElement) {
    setSelectedElementId(element.id)
    setReferenceFocus(element.sourceReferenceId)
    setConditionDraft(element.conditions ?? '')
    setAppearanceDraft(element.appearance ?? '')
    setKindDraft(element.kind)
    setEditingElementId(element.id)
  }
  function saveConditionEdit(element: DesignElement) {
    const next = updateElement(project, element.id, { conditions: conditionDraft.trim(), appearance: appearanceDraft.trim(), kind: kindDraft })
    const targetCleared = Boolean(element.target && !next.elements.find((item) => item.id === element.id)?.target)
    if (commit(next, targetCleared ? '조건과 유형을 저장했습니다. 바뀐 유형에 맞춰 위치를 다시 지정해 주세요.' : '조건을 저장했습니다.')) {
      setEditingElementId(null)
    }
  }
  function applyTarget(target: PlacementTarget) {
    if (!selectedElement) return
    applyElementTarget(selectedElement.id, target)
  }
  function applyElementTarget(elementId: string, target: PlacementTarget, acknowledgedWarnings = false) {
    const placed = placeElement(project, elementId, target)
    if (!placed.validation.valid) { setPendingPlacement(null); setError(placed.validation.issues.map((item) => item.message).join(' ')); return }
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
    return <div className="workspace-toolbar" aria-label="작업 패널 표시"><Button tone="quiet" onClick={() => setShowWorkspaceLeft((value) => !value)}>{leftLabel} {showWorkspaceLeft ? '숨기기' : '보이기'}</Button><span>도면에서 선택·드래그하고 손잡이를 돌려 조정하세요.</span><Button tone="quiet" onClick={() => setShowWorkspaceRight((value) => !value)}>속성 패널 {showWorkspaceRight ? '숨기기' : '보이기'}</Button></div>
  }
  async function uploadImage(file: File, role: SourceImage['role'], referenceRole?: Reference['role']) {
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
      if (referenceId) { setReferenceFocus(referenceId); setElementReferenceId(referenceId) }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '이미지를 등록하지 못했습니다.') }
    finally { setBusy(false) }
  }
  async function uploadPlan(file: File) {
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
  function addStructure() {
    if (!project.floorPlan) { setError('먼저 평면도를 등록하거나 개략 도면을 만드세요.'); return }
    const x = fraction(structureX), y = fraction(structureY), endX = fraction(structureEndX), endY = fraction(structureEndY)
    if ([x,y,endX,endY].some((value) => !Number.isFinite(value) || value < 0 || value > 1)) { setError('좌표는 0–100% 범위로 입력해 주세요.'); return }
    if (structureKind === 'pillar' && (x > .92 || y > .90)) { setError('기둥의 전체 크기가 도면 안에 들어와야 합니다.'); return }
    if (structureKind === 'existing-light' && (x < .03 || x > .97 || y < .03 || y > .97)) { setError('기존 조명의 표시가 도면 안에 들어와야 합니다.'); return }
    if (structureKind !== 'pillar' && structureKind !== 'existing-light' && x === endX && y === endY) { setError('구조의 시작과 끝 위치를 다르게 지정해 주세요.'); return }
    const name = structureName.trim() || `${STRUCTURE_LABELS[structureKind]} ${project.floorPlan.structures.filter((item) => item.kind === structureKind).length + 1}`
    const id = makeId('structure')
    const segment = { kind: 'segment' as const, start: { x, y }, end: { x: endX, y: endY } }
    const geometry = structureKind === 'pillar' ? { kind: 'rect' as const, bounds: { x, y, width: .08, height: .10 } } : structureKind === 'existing-light' ? { kind: 'circle' as const, center: { x, y }, radius: .025 } : segment
    const requiresWall = ['window','door','entrance'].includes(structureKind)
    const parentWallId = requiresWall ? structureParent : undefined
    const wall = project.floorPlan.structures.find((item) => item.id === parentWallId)
    if (requiresWall && (!wall || wall.kind !== 'wall')) { setError('창·문·출입구를 표시하려면 연결 벽을 선택하세요.'); return }
    const wallSpan = requiresWall ? spanOnWall(wall, { x, y }, { x: endX, y: endY }) : undefined
    if (requiresWall && (!wallSpan || wallSpan.start === wallSpan.end)) { setError('시작과 끝 좌표를 선택한 벽 선 위에 지정해 주세요.'); return }
    const immutable = structureKind !== 'wall' || structureRole === 'base'
    if (!immutable) {
      const checked = validatePartitionPlacement(project, { x, y }, { x: endX, y: endY })
      if (!checked.valid) { setError(checked.issues.map((issue) => issue.message).join(' ')); return }
    }
    const structure: Structure = { id, kind: structureKind, name, geometry, immutable, protected: immutable, parentWallId,
      wallSpan, lightTone: structureKind === 'existing-light' ? structureLightTone.trim() || '온백색' : undefined,
      clearance: (structureKind === 'door' || structureKind === 'entrance') && wall ? entranceClearance(project.floorPlan, wall, { x, y }, { x: endX, y: endY }) : undefined }
    const keep = immutable ? { id: makeId('keep'), structureId: id, intent: 'preserve' as const, description: `${name}의 위치와 형태 보존` } : undefined
    if (!commit(updateCommon(project, { floorPlan: { ...project.floorPlan, structures: [...project.floorPlan.structures, structure] }, keeps: keep ? [...project.keeps, keep] : project.keeps }), immutable ? '필수 보존 기본 구조를 추가했습니다.' : '수정 가능한 가벽을 추가했습니다.')) return
    setSelectedStructureId(id); setStructureName('')
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
    commit(updateCommon(project, { floorPlan: { ...project.floorPlan, structures: project.floorPlan.structures.filter((item) => item.id !== structure.id) } }), `${structure.name}을(를) 삭제했습니다.`)
    setSelectedStructureId('')
  }
  function confirmStructureBase(structure: Structure) {
    if (!project.floorPlan || structure.immutable) return
    const keep = project.keeps.find((entry) => entry.structureId === structure.id)
    const nextKeep = keep ?? { id: makeId('keep'), structureId: structure.id, intent: 'preserve' as const, description: `${structure.name}의 위치와 형태 보존` }
    commit(updateCommon(project, {
      floorPlan: { ...project.floorPlan, structures: project.floorPlan.structures.map((item) => item.id === structure.id ? { ...item, immutable: true, protected: true } : item) },
      keeps: keep ? project.keeps : [...project.keeps, nextKeep],
    }), `${structure.name}을(를) 필수 보존 기본 구조로 확정했습니다.`)
  }
  function moveOptionalStructure(id: string, start: { x: number, y: number }, end: { x: number, y: number }) {
    const structure = project.floorPlan?.structures.find((item) => item.id === id)
    if (!project.floorPlan || !structure || structure.kind !== 'wall' || structure.geometry.kind !== 'segment') return
    const checked = validateStructureOperation(project, id, 'move')
    if (!checked.valid) { setError(checked.issues.map((issue) => issue.message).join(' ')); return }
    if (project.floorPlan.structures.some((item) => item.parentWallId === id)) { setError('연결된 창·문·출입구가 있습니다. 먼저 연결을 수정해 주세요.'); return }
    const points = [start.x, start.y, end.x, end.y]
    if (points.some((value) => !Number.isFinite(value) || value < 0 || value > 1) || Math.hypot(end.x - start.x, end.y - start.y) < .02) { setError('가벽은 도면 안에 길이를 유지하며 배치해 주세요.'); return }
    const placement = validatePartitionPlacement(project, start, end)
    if (!placement.valid) { setError(placement.issues.map((issue) => issue.message).join(' ')); return }
    commit(updateCommon(project, { floorPlan: { ...project.floorPlan, structures: project.floorPlan.structures.map((item) => item.id === id ? { ...item, geometry: { kind: 'segment' as const, start, end } } : item) } }), `${structure.name}의 도면 위치를 저장했습니다.`)
  }
  function addArea() {
    if (!project.floorPlan) { setError('먼저 평면도를 준비해 주세요.'); return }
    const x = fraction(areaX), y = fraction(areaY), width = fraction(areaWidth), height = fraction(areaHeight)
    if ([x,y,width,height].some((value) => !Number.isFinite(value)) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
      setError('영역의 위치와 크기가 도면의 0–100% 범위 안에 들어야 합니다.'); return
    }
    const area: Area = { id: makeId('area'), name: areaName.trim() || `새 ${areaKind === 'spatial' ? '공간' : areaKind === 'passage' ? '동선' : areaKind === 'floor' ? '바닥' : '천장'} 영역`, kind: areaKind, bounds: { x, y, width, height } }
    if (!commit(updateCommon(project, { floorPlan: { ...project.floorPlan, areas: [...project.floorPlan.areas, area] } }), '평면도 영역을 추가했습니다.')) return
    setAreaName('')
  }
  function toggleKeep(structure: Structure) {
    if (structure.immutable) { setError('기본 구조는 필수 보존 대상이라 Keep을 해제할 수 없습니다.'); return }
    const existing = project.keeps.find((item) => item.structureId === structure.id)
    if (existing) commit(removeKeep(project, existing.id), `${structure.name}의 Keep을 해제했습니다.`)
    else commit(upsertKeep(project, { id: makeId('keep'), structureId: structure.id, intent: 'preserve', description: `${structure.name}의 위치와 형태 보존`, allowedSurfaceTreatment: structure.kind === 'wall' ? false : undefined }), `${structure.name}에 Keep을 설정했습니다.`)
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
    const planOrigin = project.floorPlan?.kind === 'uploaded' ? '사용자 업로드 도면' : project.id === 'aura-popup' ? '사전 준비된 샘플 개략 도면' : '직접 작성하는 개략 도면'
    const planExplanation = project.floorPlan?.kind === 'uploaded'
      ? '업로드한 이미지를 2D 배치 바탕으로 사용합니다. 벽·사용 바닥·동선은 직접 표시해야 하며 사진이나 도면에서 자동으로 추출하지 않습니다.'
      : project.id === 'aura-popup'
        ? 'AURA POP-UP 예시를 위해 미리 등록한 개략 배치입니다. 왼쪽 사진을 분석해 만든 도면이나 실측 결과가 아닙니다.'
        : '기본 사각형 윤곽에서 시작해 구조와 사용 바닥을 직접 표시하는 배치 캔버스입니다. 사진 분석이나 실측 결과가 아닙니다.'
    return <>
      {project.planAlignmentPending && <section className="plan-alignment-alert" aria-labelledby="plan-alignment-title"><div><p className="eyebrow">도면 대응 확인 필요</p><h3 id="plan-alignment-title">새 평면도의 사용 바닥과 배치를 확인하세요</h3><p>업로드한 이미지에서 사용 가능한 바닥 영역을 표시하고 구조·Keep·요소·카메라 좌표가 실제 도면과 맞는지 확인해야 미리보기를 열 수 있습니다. 이전 도면의 표시가 있다면 좌표는 임시로 유지됩니다.</p>{!project.floorPlan?.areas.some((area) => area.kind === 'floor') && <p className="plan-alignment-alert__required">아래 ‘영역과 동선 표시’에서 바닥 영역을 먼저 추가하세요.</p>}</div><div className="plan-alignment-alert__actions"><label className="checkbox-row"><input type="checkbox" checked={alignmentChecked} onChange={(event) => setAlignmentChecked(event.target.checked)} /><span>새 도면의 바닥·구조·배치·시점을 확인했습니다</span></label><Button tone="primary" disabled={!alignmentChecked || !project.floorPlan?.areas.some((area) => area.kind === 'floor')} onClick={() => { commit(updateCommon(project, { planAlignmentPending: false }), '평면도 대응 확인을 저장했습니다.'); setAlignmentChecked(false) }}>도면 대응 확인 완료</Button></div></section>}
      <div className="space-two-col">
        <section className="surface-panel" aria-labelledby="existing-title"><div className="panel-heading"><div><p className="eyebrow">01 · 실제 공간</p><h2 id="existing-title">기존 공간 사진</h2></div><FilePick label="사진 추가" onFile={(file) => uploadImage(file, 'existing-space')} /></div>
          {existing.length ? <div className="photo-carousel-wrap"><SwipeCarousel label="기존 공간 사진" variant="photo" items={existing.map((image) => ({ id: image.id, content: <figure><AssetImage uri={image.uri} alt={`${image.name} · 기존 공간 사진`} className="space-photo" /><figcaption>{image.name}<span>현장 외관 참고 · 치수 근거 아님</span></figcaption></figure> }))} /></div> : <Empty>실제 공간 사진을 추가하세요. 분위기 레퍼런스를 대신 사용할 수 없습니다.</Empty>}
        </section>
        <section className="surface-panel" aria-labelledby="plan-title"><div className="panel-heading"><div><p className="eyebrow">02 · 배치 기준</p><h2 id="plan-title">평면도</h2></div><FilePick label="도면 업로드" onFile={uploadPlan} /></div>
          {project.floorPlan ? <><div className="plan-detail-tabs" role="group" aria-label="평면도 작업 보기"><button type="button" aria-pressed={planDetailTab === 'plan'} onClick={() => setPlanDetailTab('plan')}>도면 보기</button><button type="button" aria-pressed={planDetailTab === 'structure'} onClick={() => setPlanDetailTab('structure')}>구조 표시</button><button type="button" aria-pressed={planDetailTab === 'area'} onClick={() => setPlanDetailTab('area')}>영역·동선</button></div>{planDetailTab === 'plan' && <>
              <div className="plan-origin" role="note">
                <div className="plan-origin__heading"><Badge tone="info">{planOrigin}</Badge><strong>도면은 Keep·요소 배치·시점의 2D 기준입니다.</strong></div>
                <p>{planExplanation}</p>
              </div>
              <PlanCanvas project={project} mode="view" selectedStructureId={selectedStructureId} onStructureSelect={setSelectedStructureId} onStructureMove={moveOptionalStructure} />
              <div className="plan-caption"><Badge tone="info">{project.floorPlan.geometryConfidence === 'schematic' ? '치수 미확인' : '치수 확인'}</Badge><span>사진은 공간의 모습 참고용이며 도면 좌표와 별도로 보관됩니다.</span></div>
            </>}{planDetailTab === 'structure' && <section className="structure-editor"><div className="section-heading"><div><h3>평면도 구조 표시</h3><p className="muted">구조를 직접 표시하세요. 자동 치수 추정은 하지 않습니다.</p></div></div><div className="structure-form"><label className="field"><span>유형</span><select value={structureKind} onChange={(event) => setStructureKind(event.target.value as Structure['kind'])}>{(['wall','window','pillar','door','entrance','existing-light'] as const).map((kind) => <option key={kind} value={kind}>{STRUCTURE_LABELS[kind]}</option>)}</select></label><label className="field"><span>이름</span><input value={structureName} onChange={(event) => setStructureName(event.target.value)} placeholder="구조 이름" /></label>{structureKind === 'wall' && <label className="field"><span>구조 분류</span><select value={structureRole} onChange={(event) => setStructureRole(event.target.value as 'base' | 'partition')}><option value="base">기존 기본 벽 · 필수 보존</option><option value="partition">추가 가벽 · 수정/제거 가능</option></select></label>}{structureKind === 'existing-light' && <label className="field"><span>조명 색감</span><input value={structureLightTone} onChange={(event) => setStructureLightTone(event.target.value)} placeholder="예: 온백색" /></label>}<label className="field compact-field"><span>시작 X (%)</span><input type="number" min="0" max="100" value={structureX} onChange={(event) => setStructureX(event.target.value)} /></label><label className="field compact-field"><span>시작 Y (%)</span><input type="number" min="0" max="100" value={structureY} onChange={(event) => setStructureY(event.target.value)} /></label>{!['pillar','existing-light'].includes(structureKind) && <><label className="field compact-field"><span>끝 X (%)</span><input type="number" min="0" max="100" value={structureEndX} onChange={(event) => setStructureEndX(event.target.value)} /></label><label className="field compact-field"><span>끝 Y (%)</span><input type="number" min="0" max="100" value={structureEndY} onChange={(event) => setStructureEndY(event.target.value)} /></label></>}{['window','door','entrance'].includes(structureKind) && <label className="field"><span>연결 벽</span><select value={structureParent} onChange={(event) => setStructureParent(event.target.value)}><option value="">연결 벽 선택</option>{project.floorPlan.structures.filter((item) => item.kind === 'wall').map((wall) => <option key={wall.id} value={wall.id}>{wall.name}</option>)}</select><small className="muted">시작과 끝 좌표는 선택한 벽 선 위에 놓아 주세요.</small></label>}<Button icon="add" onClick={addStructure}>구조 추가</Button></div><p className="structure-form-note">기존 벽·창·기둥·문·조명은 필수 보존 대상입니다. 추가 가벽은 Keep을 선택할 수 있으며 제거도 가능합니다. 좌표는 도면 표시용입니다.</p></section>}{planDetailTab === 'area' && <section className="structure-editor"><div className="section-heading"><div><h3>영역과 동선 표시</h3><p className="muted">분위기 범위, 바닥·천장 영역, 통행 동선을 평면도 비율로 표시합니다.</p></div></div><div className="structure-form"><label className="field"><span>영역 유형</span><select value={areaKind} onChange={(event) => setAreaKind(event.target.value as Area['kind'])}><option value="spatial">공간 영역</option><option value="floor">바닥 영역</option><option value="ceiling">천장 영역</option><option value="passage">통행 동선</option></select></label><label className="field"><span>이름</span><input value={areaName} onChange={(event) => setAreaName(event.target.value)} placeholder="예: 중앙 전시 구역" /></label><label className="field compact-field"><span>X (%)</span><input type="number" min="0" max="100" value={areaX} onChange={(event) => setAreaX(event.target.value)} /></label><label className="field compact-field"><span>Y (%)</span><input type="number" min="0" max="100" value={areaY} onChange={(event) => setAreaY(event.target.value)} /></label><label className="field compact-field"><span>폭 (%)</span><input type="number" min="1" max="100" value={areaWidth} onChange={(event) => setAreaWidth(event.target.value)} /></label><label className="field compact-field"><span>깊이 (%)</span><input type="number" min="1" max="100" value={areaHeight} onChange={(event) => setAreaHeight(event.target.value)} /></label><Button icon="add" onClick={addArea}>영역 추가</Button></div><div className="area-list">{project.floorPlan.areas.map((area) => <span key={area.id} className="area-chip">{area.name} · {area.kind === 'spatial' ? '공간' : area.kind === 'floor' ? '바닥' : area.kind === 'ceiling' ? '천장' : '동선'}</span>)}</div></section>}</> : <div className="plan-empty"><p>평면도가 아직 없습니다.</p><p className="muted">도면 이미지가 없다면 치수를 주장하지 않는 개략 도면으로 시작할 수 있습니다.</p><Button icon="layers" onClick={createSchematicPlan}>개략 도면 만들기</Button></div>}
        </section>
      </div>
      <section className="details-strip"><div><h3>프로젝트 기본 정보</h3><p className="muted">변경한 항목만 저장되며 기존 결과는 이전 조건으로 보관됩니다.</p></div><div className="details-fields"><label className="field"><span>이름</span><input defaultValue={project.name} key={`${project.id}-name`} onBlur={(event) => commit(updateCommon(project, { name: event.target.value.trim() || project.name }))} /></label><label className="field"><span>공간 유형</span><input defaultValue={project.spaceType} key={`${project.id}-type`} onBlur={(event) => commit(updateCommon(project, { spaceType: event.target.value }))} /></label><label className="field field-wide"><span>콘셉트</span><input defaultValue={project.concept} key={`${project.id}-concept`} onBlur={(event) => commit(updateCommon(project, { concept: event.target.value }))} /></label></div></section>

    </>
  }

  function renderKeep() {
    const structures = project.floorPlan?.structures.filter((item) => ['wall','window','pillar','door','entrance','existing-light'].includes(item.kind)) ?? []
    const keep = project.keeps.find((item) => item.structureId === selectedStructure?.id)
    const firstPhoto = project.sourceImages.find((image) => image.role === 'existing-space')
    return <div className="keep-layout">
      {firstPhoto ? <PhotoKeepOverlay imageUri={firstPhoto.uri} structures={project.floorPlan?.structures ?? []} keeps={project.keeps} selectedStructureId={selectedStructureId} onSelect={setSelectedStructureId} onSetAnchor={(id, point) => { commit(updatePhotoAnchor(project, id, point), '사진 라벨 위치를 저장했습니다. 도면 구조는 변경되지 않았습니다.') }} /> : <section className="surface-panel"><div className="panel-heading"><div><p className="eyebrow">현장 사진</p><h2>기존 모습</h2></div></div><Empty>기존 공간 사진을 먼저 등록하세요.</Empty></section>}
      <section className="surface-panel"><div className="panel-heading"><div><p className="eyebrow">평면도 연결</p><h2>보존 구조 선택</h2></div><Badge tone="keep">{project.keeps.length}개 Keep</Badge></div><PlanCanvas project={project} mode="keep" selectedStructureId={selectedStructureId} onStructureSelect={setSelectedStructureId} onStructureMove={moveOptionalStructure} /></section>
      <aside className="side-panel"><div className="panel-heading"><div><p className="eyebrow">보존 조건</p><h2>Keep 목록</h2></div></div>{selectedStructure && <div className="keep-selection-summary"><span className="eyebrow">현재 선택</span><strong>{selectedStructure.name}</strong><span>{selectedStructure.immutable ? '필수 보존 · 위치 고정' : keep ? 'Keep 보존 · 설정 수정 가능' : '수정 가능한 구조'}</span></div>}{structures.length ? <div className="structure-list">{structures.map((structure) => { const isKept = project.keeps.some((item) => item.structureId === structure.id); return <button key={structure.id} className={`list-row ${selectedStructureId === structure.id ? 'is-selected' : ''}`} onClick={() => setSelectedStructureId(structure.id)}><span><strong>{structure.name}</strong><small>{STRUCTURE_LABELS[structure.kind]}</small></span>{(isKept || structure.immutable) && <Badge tone="keep">{structure.immutable ? '필수 보존' : 'Keep'}</Badge>}</button> })}</div> : <Empty>평면도에 구조를 먼저 표시하세요.</Empty>}
        {selectedStructure && <div className="inspector-block"><h3>{selectedStructure.name}</h3><p className="muted">{STRUCTURE_LABELS[selectedStructure.kind]} · {selectedStructure.immutable ? '기존 기본 구조 · 이동과 제거 불가' : '수정 가능한 도면 구조 · 보존 확정 전'}</p><label className="field"><span>구조 이름</span><input defaultValue={selectedStructure.name} key={`${selectedStructure.id}-label`} onBlur={(event) => { if (!project.floorPlan) return; const name = event.target.value.trim(); if (!name) return; commit(updateCommon(project, { floorPlan: { ...project.floorPlan, structures: project.floorPlan.structures.map((item) => item.id === selectedStructure.id ? { ...item, name } : item) } })) }} /></label>{selectedStructure.immutable ? <Badge tone="keep">필수 보존 · 위치 고정</Badge> : <div className="keep-actions"><Button tone={keep ? 'secondary' : 'primary'} onClick={() => toggleKeep(selectedStructure)}>{keep ? 'Keep 해제' : 'Keep 지정'}</Button><Button tone="danger" icon="trash" onClick={() => deleteStructure(selectedStructure)}>구조 제거</Button><Button tone="quiet" icon="check" onClick={() => confirmStructureBase(selectedStructure)}>기본 구조로 확정</Button></div>}{selectedStructure.kind === 'existing-light' && <label className="field"><span>기존 조명 색감만 변경</span><input defaultValue={selectedStructure.lightTone ?? '온백색'} key={`${selectedStructure.id}-tone`} onBlur={(event) => { if (!project.floorPlan) return; const allowed = validateStructureOperation(project, selectedStructure.id, 'light-tone'); if (!allowed.valid) { setError(allowed.issues.map((issue) => issue.message).join(' ')); return } const lightTone = event.target.value.trim() || '온백색'; commit(updateCommon(project, { floorPlan: { ...project.floorPlan, structures: project.floorPlan.structures.map((item) => item.id === selectedStructure.id ? { ...item, lightTone } : item) } }), '기존 조명 색감을 저장했습니다.') }} /><small className="muted">등기구의 위치와 형태는 고정됩니다.</small></label>}{keep && <><label className="field"><span>보존 설명</span><textarea rows={3} defaultValue={keep.description} key={keep.id} onBlur={(event) => commit(updateKeep(project, keep.id, { description: event.target.value }))} /></label>{selectedStructure.kind === 'wall' && <label className="checkbox-row"><input type="checkbox" checked={!!keep.allowedSurfaceTreatment} onChange={(event) => commit(updateKeep(project, keep.id, { allowedSurfaceTreatment: event.target.checked }))} /><span>탈착식 표면 연출 허용</span></label>}</>}</div>}
      </aside>
    </div>
  }

  function renderReferences() {
    const focused = project.references.find((item) => item.id === referenceFocus) ?? project.references[0]
    const focusedImage = project.sourceImages.find((image) => image.id === focused?.imageId)
    const sourceGroups = [
      { label: '분위기·공간 참고', role: 'ambience' as const, sourceRole: 'inspiration' as const },
      { label: '요소·그래픽 참고', role: 'element' as const, sourceRole: 'inspiration' as const },
      { label: '제품 사진', role: 'product' as const, sourceRole: 'product' as const },
    ]
    function addElement() {
      if (!elementLabel.trim()) { setError('요소 이름을 입력해 주세요.'); return }
      const referenceId = elementReferenceId || focused?.id
      if (!referenceId || !project.references.some((item) => item.id === referenceId)) { setError('현재 프로젝트의 레퍼런스를 먼저 선택해 주세요.'); return }
      const id = makeId('element')
      const element: DesignElement = { id, sourceReferenceId: referenceId, label: elementLabel.trim(), kind: elementKind, status: 'apply', target: null, conditions: '' }
      const references = project.references.map((item) => item.id === referenceId ? { ...item, extractedElements: [...item.extractedElements, id] } : item)
      if (!commit(updateCommon(project, { references, elements: [...project.elements, element] }), '요소를 추가했습니다. 공간 배치에서 위치를 지정하세요.')) return
      setSelectedElementId(id); setElementLabel('')
    }
    return <div className="reference-layout">
      <aside className="library-panel"><div className="panel-heading"><div><p className="eyebrow">참고 이미지</p><h2>레퍼런스 라이브러리</h2></div></div>
        {sourceGroups.map((group) => <div key={group.role} className="library-group"><div className="group-heading"><h3>{group.label}</h3><FilePick label="추가" onFile={(file) => uploadImage(file, group.sourceRole, group.role)} /></div>
          {project.references.filter((item) => item.role === group.role).length === 0 && <p className="muted small">등록된 이미지가 없습니다.</p>}
          {project.references.filter((item) => item.role === group.role).map((reference) => { const image = project.sourceImages.find((entry) => entry.id === reference.imageId); return <button key={reference.id} className={`reference-thumb ${focused?.id === reference.id ? 'is-selected' : ''}`} onClick={() => { setReferenceFocus(reference.id); setElementReferenceId(reference.id) }}><span className="thumb-image">{image && <AssetImage uri={image.uri} alt={`${image.name} 미리보기`} />}</span><span><strong>{image?.name ?? '이미지 없음'}</strong><small>{group.role === 'product' ? '제품' : group.role === 'ambience' ? '분위기' : '요소'}</small></span></button> })}
        </div>)}
      </aside>
      <section className="reference-preview"><div className="panel-heading"><div><p className="eyebrow">선택한 레퍼런스</p><h2>{focusedImage?.name ?? '이미지를 선택하세요'}</h2></div>{focused && <Badge tone="info">{focused.role === 'ambience' ? '분위기' : focused.role === 'product' ? '제품' : '요소'}</Badge>}</div>
        {focusedImage ? <><AssetImage uri={focusedImage.uri} alt={`${focusedImage.name} 원본 참고 이미지`} className="reference-large-image" /><div className="reference-note"><label className="field"><span>해석 메모</span><textarea rows={2} defaultValue={focused?.note} key={focused?.id} onBlur={(event) => commit(updateCommon(project, { references: project.references.map((item) => item.id === focused?.id ? { ...item, note: event.target.value } : item) }))} /></label><p className="muted small">{focused?.role === 'product' ? '제품 사진은 형태·재료 참고입니다. 실제 공간의 구조나 치수를 증명하지 않습니다.' : focused?.role === 'element' ? '요소·그래픽 사진은 디자인 참고입니다. 실제 공간의 구조나 치수를 증명하지 않습니다.' : '분위기 사진은 실제 공간의 크기나 구조를 증명하지 않습니다.'}</p></div></> : <Empty>분위기, 요소, 제품 사진을 각각 등록하세요.</Empty>}
      </section>
      <aside className="element-panel"><div className="panel-heading"><div><p className="eyebrow">추출과 조건</p><h2>디자인 요소</h2></div></div>
        <div className="element-scroll">{project.elements.map((element) => {
          const source = sourceFor(project, element.sourceReferenceId)
          const selected = selectedElementId === element.id
          const editing = editingElementId === element.id
          return <div key={element.id} className={`element-card ${selected ? 'is-selected' : ''}`}>
            <div className="element-card-top"><strong>{element.label}</strong><Badge tone={element.status === 'exclude' ? 'error' : element.target ? 'selected' : 'neutral'}>{element.status === 'exclude' ? '제외' : element.target ? '적용 · 배치됨' : '적용 · 위치 미지정'}</Badge></div>
            <p>{ELEMENT_LABELS[element.kind]} · {source?.name ?? '출처 없음'}</p>
            <p className="muted small">{element.status === 'exclude' ? '배치와 미리보기 조건에서 제외' : targetDescription(project, element.target)}</p>
            <div className="element-card-actions">
              <Button tone="quiet" icon="edit" onClick={() => editing ? setEditingElementId(null) : beginConditionEdit(element)}>{editing ? '편집 닫기' : '조건 편집'}</Button>
              <Button tone="quiet" onClick={() => commit(updateElement(project, element.id, { status: element.status === 'apply' ? 'exclude' : 'apply' }), element.status === 'apply' ? '요소를 제외했습니다.' : '요소를 적용 대상으로 바꿨습니다.')}>{element.status === 'apply' ? '제외' : '적용'}</Button>
            </div>
            {selected && <div className="element-inline-edit">
              {editing ? <>
                <label className="field"><span>적용·제외 조건</span><textarea rows={2} value={conditionDraft} onChange={(event) => setConditionDraft(event.target.value)} /></label>
                <label className="field"><span>모양·재료 조건</span><textarea rows={2} value={appearanceDraft} onChange={(event) => setAppearanceDraft(event.target.value)} /></label>
                <label className="field"><span>요소 유형</span><select value={kindDraft} onChange={(event) => setKindDraft(event.target.value as ElementKind)}>{Object.entries(ELEMENT_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
                <div className="element-edit-actions"><Button tone="primary" icon="check" onClick={() => saveConditionEdit(element)}>변경 저장</Button><Button onClick={() => setEditingElementId(null)}>취소</Button></div>
              </> : <>
                <div className="element-readonly-field"><strong>적용·제외 조건</strong><p>{element.conditions?.trim() || '등록된 조건 없음'}</p></div>
                <div className="element-readonly-field"><strong>모양·재료 조건</strong><p>{element.appearance?.trim() || '등록된 조건 없음'}</p></div>
                <div className="element-readonly-field"><strong>요소 유형</strong><p>{ELEMENT_LABELS[element.kind]}</p></div>
                {element.status === 'apply' && <Button icon="edit" onClick={() => editElement(element.id)}>위치 편집</Button>}
              </>}
            </div>}
          </div>
        })}</div>
        <div className="add-element"><h3>요소 추가</h3><label className="field"><span>출처</span><select value={elementReferenceId || focused?.id || ''} onChange={(event) => setElementReferenceId(event.target.value)}><option value="">레퍼런스 선택</option>{project.references.map((reference) => <option key={reference.id} value={reference.id}>{project.sourceImages.find((image) => image.id === reference.imageId)?.name ?? reference.id}</option>)}</select></label><label className="field"><span>요소 이름</span><input value={elementLabel} onChange={(event) => setElementLabel(event.target.value)} placeholder="예: 곡선형 진열대" /></label><label className="field"><span>요소 유형</span><select value={elementKind} onChange={(event) => setElementKind(event.target.value as ElementKind)}>{Object.entries(ELEMENT_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label><Button icon="add" onClick={addElement} disabled={project.references.length === 0}>요소 추가</Button></div>
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
    return <div className="inspector-content"><div className="inspector-block"><h3>{selectedElement.label}</h3><p className="muted">{ELEMENT_LABELS[selectedElement.kind]}</p><p className="rule-line">허용 위치 · {allowed.map(targetLabel).join(' / ')}</p>{selectedElement.kind === 'ambient-light' && <p className="muted small">이 항목은 레퍼런스에서 가져온 공간 분위기 조건입니다. 기존 천장 등기구는 공간 자료에서 고정 구조로 등록하고 색감만 조정합니다.</p>}<p className="muted small">현재 위치: {targetDescription(project, selectedElement.target)}</p></div>
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
    return <div className={`workspace-layout ${showWorkspaceLeft ? '' : 'is-left-hidden'} ${showWorkspaceRight ? '' : 'is-right-hidden'}`}> {renderWorkspaceToolbar('요소 목록')}
      <aside className="workspace-side workspace-side--left"><div className="panel-heading"><div><p className="eyebrow">적용 요소</p><h2>배치 목록</h2></div><Badge>{active.length}개</Badge></div><div className="workspace-list">{active.map((element) => <button key={element.id} className={`element-list-button ${selectedElementId === element.id ? 'is-selected' : ''}`} aria-pressed={selectedElementId === element.id} onClick={() => setSelectedElementId(element.id)}><strong>{element.label}</strong><small>{ELEMENT_LABELS[element.kind]}</small><span className={`status-line ${element.target ? 'is-placed' : ''}`}>{element.target ? targetDescription(project, element.target) : '위치 미지정'}</span></button>)}</div>{active.length === 0 && <Empty>적용할 요소가 없습니다. 레퍼런스에서 적용 요소를 선택하세요.</Empty>}{project.elements.some((item) => item.status === 'exclude') && <div className="side-bottom"><p className="muted small">제외 요소 {project.elements.length - active.length}개는 배치하지 않습니다.</p><Button tone="quiet" onClick={() => go('references')}>제외 조건 보기</Button></div>}</aside>
      <section className="workspace-main"><div className="panel-heading"><div><p className="eyebrow">평면도 작업</p><h2>공간 배치</h2></div><Badge tone="info">{project.floorPlan?.geometryConfidence === 'schematic' ? '개략 도면 · 치수 미확인' : '평면도'}</Badge></div><p className="narrow-notice">도면의 요소를 끌어 이동하고 회전 손잡이로 각도를 조정하세요. 수치 입력도 사용할 수 있습니다.</p>{pendingPlacement && <div className="placement-warning" role="alert"><NucleoIcon name="warning" /><div><strong>보존 조건 확인</strong>{pendingPlacement.warnings.map((message) => <p key={message}>{message}</p>)}<div className="placement-warning__actions"><Button tone="primary" onClick={() => applyElementTarget(pendingPlacement.elementId, pendingPlacement.target, true)}>확인하고 배치</Button><Button onClick={() => setPendingPlacement(null)}>취소</Button></div></div></div>}<PlanCanvas project={project} mode="place" selectedElementId={selectedElementId} selectedStructureId={selectedStructureId} selectedCameraId={selectedCameraId} onElementSelect={setSelectedElementId} onElementMove={(id, x, y) => { const element = project.elements.find((item) => item.id === id); if (element?.target?.kind === 'floor-point') applyElementTarget(id, { ...element.target, x, y }) }} onElementRotate={(id, rotationDegrees) => { const element = project.elements.find((item) => item.id === id); if (element?.target?.kind === 'floor-point') applyElementTarget(id, { ...element.target, rotationDegrees }) }} onWallElementMove={(id, wallId, start, end) => { const element = project.elements.find((item) => item.id === id); if (element?.target?.kind === 'wall-segment') applyElementTarget(id, { ...element.target, wallId, start, end }) }} onStructureSelect={setSelectedStructureId} onPlacePoint={(x, y) => {
        if (!selectedElement) return
        if (!allowedTargetKinds(selectedElement.kind).includes('floor-point')) { setError(`${selectedElement.label}은(는) 바닥의 한 점에 놓을 수 없습니다. ${allowedTargetKinds(selectedElement.kind).map(targetLabel).join(' 또는 ')}을 선택하세요.`); return }
        const old = selectedElement.target?.kind === 'floor-point' ? selectedElement.target : null
        applyTarget({ kind: 'floor-point', x, y, footprint: old?.footprint ?? { width: .10, height: .08 }, rotationDegrees: old?.rotationDegrees ?? 0 })
      }} onWallSelect={(wallId) => {
        if (!selectedElement) return
        if (!allowedTargetKinds(selectedElement.kind).includes('wall-segment')) { setError(`${selectedElement.label}은(는) 벽에 배치할 수 없습니다. ${allowedTargetKinds(selectedElement.kind).map(targetLabel).join(' 또는 ')}을 선택하세요.`); return }
        const old = selectedElement.target?.kind === 'wall-segment' ? selectedElement.target : null
        applyTarget({ kind: 'wall-segment', wallId, start: old?.wallId === wallId ? old.start : .10, end: old?.wallId === wallId ? old.end : .30 })
      }} /><div className="canvas-help"><span>바닥 요소: 선택 후 드래그</span><span>회전: 선택 요소의 손잡이 드래그</span><span>벽 요소: 벽 구간 드래그</span></div></section>
      <aside className="workspace-side inspector"><div className="panel-heading"><div><p className="eyebrow">유형별 설정</p><h2>속성 편집</h2></div></div>{renderPlacementInspector()}</aside>
    </div>
  }

  function renderCamera() {
    const cameraIssues = selectedCamera ? validateCamera(project, selectedCamera.id).issues : []
    function addView() {
      if (!project.floorPlan) { setError('먼저 평면도를 준비하세요.'); return }
      if (project.cameras.length >= 3) { setError('시점은 최대 3개까지 관리할 수 있습니다.'); return }
      const preferred = [{ x: .50, y: .78 }, { x: .32, y: .70 }, { x: .68, y: .70 }][project.cameras.length]
      const camera: Camera = { id: makeId('camera'), name: project.cameras.length ? `추가 시점 ${project.cameras.length}` : '대표 시점', ...preferred, directionDegrees: 270, fovPreset: 'standard', primary: project.cameras.length === 0 }
      const candidates = [preferred, ...Array.from({ length: 19 * 19 }, (_, index) => ({
        x: .05 + (index % 19) * .05,
        y: .05 + Math.floor(index / 19) * .05,
      })).sort((a, b) => (a.x - preferred.x) ** 2 + (a.y - preferred.y) ** 2 - (b.x - preferred.x) ** 2 - (b.y - preferred.y) ** 2)]
      const position = candidates.find(({ x, y }) => validateCamera(addCamera(project, { ...camera, x, y }), camera.id).valid)
      if (!position) { setError('카메라를 놓을 수 있는 바닥 위치가 없습니다. 평면도와 배치 요소를 먼저 확인해 주세요.'); return }
      if (commit(addCamera(project, { ...camera, ...position }), '시점을 추가했습니다. 평면도에서 위치와 방향을 확인하세요.')) setSelectedCameraId(camera.id)
    }
    return <div className={`workspace-layout ${showWorkspaceLeft ? '' : 'is-left-hidden'} ${showWorkspaceRight ? '' : 'is-right-hidden'}`}> {renderWorkspaceToolbar('카메라 목록')}
      <aside className="workspace-side workspace-side--left"><div className="panel-heading"><div><p className="eyebrow">시점 관리</p><h2>카메라</h2></div></div><div className="workspace-list">{project.cameras.map((camera) => <button key={camera.id} className={`camera-list-button ${selectedCamera?.id === camera.id ? 'is-selected' : ''}`} aria-pressed={selectedCamera?.id === camera.id} onClick={() => setSelectedCameraId(camera.id)}><strong>{camera.name}</strong><small>{camera.primary ? '대표 시점' : '추가 시점'}</small><span className="status-line">위치 {pct(camera.x)}%, {pct(camera.y)}% · 방향 {camera.directionDegrees}°</span></button>)}</div>{project.cameras.length === 0 && <Empty>대표 시점을 추가해 주세요.</Empty>}<div className="side-bottom"><Button icon="camera" onClick={addView} disabled={project.cameras.length >= 3}>{project.cameras.length ? '시점 추가' : '대표 시점 만들기'}</Button><p className="muted small">추가 시점은 선택 사항입니다. 최대 3개까지 관리합니다.</p></div></aside>
      <section className="workspace-main"><div className="panel-heading"><div><p className="eyebrow">시점 위치</p><h2>평면도에서 보기</h2></div><Badge tone="info">{project.floorPlan?.geometryConfidence === 'schematic' ? '개략 도면' : '평면도'}</Badge></div><p className="narrow-notice">카메라 번호를 끌어 이동하고 방향 손잡이를 돌리세요. 수치 입력도 사용할 수 있습니다.</p><PlanCanvas project={project} mode="camera" selectedCameraId={selectedCamera?.id} onCameraSelect={setSelectedCameraId} onCameraMove={(id, x, y) => applyCameraChange(id, { x, y })} onCameraRotate={(id, directionDegrees) => applyCameraChange(id, { directionDegrees })} /><div className="canvas-help"><span>카메라 번호: 드래그 이동</span><span>회전 손잡이: 시선 방향 조정</span><span>시점 추가는 선택 사항</span></div></section>
      <aside className="workspace-side inspector"><div className="panel-heading"><div><p className="eyebrow">시점 설정</p><h2>카메라 속성</h2></div></div>{selectedCamera ? <div className="inspector-content">{cameraIssues.length > 0 && <div className="camera-validation" role="alert"><strong>시점 위치를 확인해 주세요</strong>{cameraIssues.map((issue) => <p key={`${issue.code}-${issue.message}`}>{issue.message}</p>)}</div>}<div className="inspector-block"><label className="field"><span>시점 이름</span><input defaultValue={selectedCamera.name} key={`${selectedCamera.id}-name`} onBlur={(event) => commit(updateCamera(project, selectedCamera.id, { name: event.target.value.trim() || selectedCamera.name }))} /></label><label className="checkbox-row"><input type="checkbox" checked={selectedCamera.primary} onChange={() => commit(updateCamera(project, selectedCamera.id, { primary: true }), '대표 시점을 변경했습니다.')} /><span>대표 시점으로 사용</span></label></div><form className="inspector-block" key={`${selectedCamera.id}-position-${selectedCamera.x}-${selectedCamera.y}`} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const x = fraction(String(data.get('x'))), y = fraction(String(data.get('y'))); if (![x,y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) { setError('위치는 0–100% 범위로 입력해 주세요.'); return } applyCameraChange(selectedCamera.id, { x, y }) }}><h3>위치</h3><div className="field-grid"><label className="field"><span>X (%)</span><input name="x" type="number" min="0" max="100" defaultValue={pct(selectedCamera.x)} /></label><label className="field"><span>Y (%)</span><input name="y" type="number" min="0" max="100" defaultValue={pct(selectedCamera.y)} /></label></div><Button type="submit">위치 적용</Button></form><div className="inspector-block"><label className="field"><span>바라보는 방향 · {selectedCamera.directionDegrees}°</span><input type="range" min="0" max="359" value={selectedCamera.directionDegrees} onChange={(event) => applyCameraChange(selectedCamera.id, { directionDegrees: Number(event.target.value) })} /></label><p className="muted small">0° 오른쪽 · 90° 아래 · 180° 왼쪽 · 270° 위쪽</p><label className="field"><span>화각</span><select value={selectedCamera.fovPreset ?? 'standard'} onChange={(event) => commit(updateCamera(project, selectedCamera.id, { fovPreset: event.target.value as Camera['fovPreset'] }))}><option value="narrow">좁게</option><option value="standard">기본</option><option value="wide">넓게</option></select></label></div><div className="inspector-block"><p className="muted small">시점만 수정하면 이 카메라의 이전 결과에만 오래됨 표시가 붙습니다. 공간 공통 조건은 유지됩니다.</p></div></div> : <Empty>카메라를 추가하면 속성을 편집할 수 있습니다.</Empty>}</aside>
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
    if (!preflight.valid) { setError('먼저 아래 필수 조건을 해결해 주세요.'); return }
    const cameraId = project.cameras.find((item) => item.id === selectedCameraId)?.id ?? project.cameras.find((item) => item.primary)?.id
    if (!cameraId) { setError('대표 시점을 선택해 주세요.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await offlineDemoProvider.createResult(project, cameraId)
      if (!commit(appendResult(project, result), '사전 준비된 데모 샘플을 열었습니다. 현재 설정을 반영한 생성 결과가 아닙니다.')) return
      setSelectedResultId(result.id); go('results')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '샘플을 열지 못했습니다.') }
    finally { setBusy(false) }
  }
  async function generateImage() {
    if (generationInFlightRef.current) return
    if (!preflight.valid) { setError('먼저 아래 필수 조건을 해결해 주세요.'); return }
    if (!generationStatus?.available) { setError('AI 생성 서버가 준비되지 않았습니다. 데모 샘플은 계속 사용할 수 있습니다.'); return }
    if (generationStatus.requiresAccessCode && !generationAccessCode.trim()) { setError('AI 생성 접근 코드를 입력해 주세요.'); return }
    const cameraId = project.cameras.find((item) => item.id === selectedCameraId)?.id ?? project.cameras.find((item) => item.primary)?.id
    if (!cameraId) { setError('대표 시점을 선택해 주세요.'); return }
    const sourceProject = project
    generationInFlightRef.current = true
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await createApiImageProvider(generationAccessCode.trim()).createResult(sourceProject, cameraId)
      const latest = loadProjects().find((item) => item.id === sourceProject.id) ?? sourceProject
      const latestCamera = latest.cameras.find((item) => item.id === cameraId)
      const originalCamera = result.conditionsSnapshot.camera
      const cameraChanged = !latestCamera || latestCamera.x !== originalCamera.x || latestCamera.y !== originalCamera.y || latestCamera.directionDegrees !== originalCamera.directionDegrees
      const savedResult = { ...result, stale: latest.commonRevision !== result.commonRevision || cameraChanged }
      const updated = appendResult(latest, savedResult)
      saveProject(updated)
      setProjects(loadProjects())
      setSaveFailed(false)
      if (projectRef.current.id === sourceProject.id) {
        projectRef.current = updated
        setProject(updated)
        setSelectedResultId(result.id)
        go('results')
      }
      showNotice(savedResult.stale ? 'AI 이미지 1장을 저장했습니다. 생성 중 조건이 바뀌어 이전 조건으로 표시합니다.' : 'AI 이미지 1장을 저장했습니다. 구조와 조건을 직접 대조해 주세요.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'AI 이미지를 생성하지 못했습니다. 이전 결과는 그대로 보관됩니다.') }
    finally { generationInFlightRef.current = false; setBusy(false) }
  }
  function renderReview() {
    const applied = project.elements.filter((item) => item.status === 'apply')
    const excluded = project.elements.filter((item) => item.status === 'exclude')
    const primary = project.cameras.find((item) => item.primary)
    const reviewCamera = project.cameras.find((item) => item.id === selectedCameraId) ?? primary
    const fixedStructures = project.floorPlan?.structures.filter((item) => item.immutable) ?? []
    const placed = applied.filter((item) => item.target)
    const atmosphere = applied.find((item) => item.kind === 'ambient-light' || item.kind === 'global-palette')
    const feel = atmosphere?.appearance?.trim() || atmosphere?.label || project.concept.trim()
    const generationReferenceCount = new Set(applied.map((item) => project.references.find((reference) => reference.id === item.sourceReferenceId)?.imageId).filter(Boolean)).size
    const tooManyGenerationReferences = generationReferenceCount > 3
    return <div className="review-layout"><div className="review-main">
      <section className="review-section"><div className="section-heading"><div><p className="eyebrow">01 · 보존</p><h2>Keep 구조</h2></div><Button tone="quiet" icon="edit" onClick={() => go('keep')}>Keep 편집</Button></div>{project.keeps.length ? <details className="review-details" open={project.keeps.length <= 3}><summary>보존 구조 {project.keeps.length}개 · 목록 {project.keeps.length <= 3 ? '접기' : '펼쳐서 확인하기'}</summary>{project.keeps.map((keep) => <div className="summary-row" key={keep.id}><span><strong>{project.floorPlan?.structures.find((item) => item.id === keep.structureId)?.name ?? '구조 없음'}</strong><small>{keep.description}</small></span><Badge tone="keep">보존</Badge></div>)}</details> : <Empty>보존할 구조가 등록되지 않았습니다.</Empty>}</section>
      <section className="review-section"><div className="section-heading"><div><p className="eyebrow">02 · 적용</p><h2>디자인 요소와 위치</h2></div><Button tone="quiet" icon="edit" onClick={() => go('references')}>요소 편집</Button></div>{applied.length ? applied.map((element) => <div className="summary-row" key={element.id}><span><strong>{element.label}</strong><small>{sourceFor(project, element.sourceReferenceId)?.name ?? '출처 없음'} · {targetDescription(project, element.target)}</small>{element.conditions && <small>{element.conditions}</small>}</span><Button tone="quiet" icon="edit" onClick={() => editElement(element.id)}>위치 수정</Button></div>) : <Empty>적용할 요소가 없습니다.</Empty>}</section>
      <section className="review-section"><div className="section-heading"><div><p className="eyebrow">03 · 제외</p><h2>반영하지 않을 요소</h2></div><Button tone="quiet" icon="edit" onClick={() => go('references')}>제외 조건 편집</Button></div>{excluded.length ? excluded.map((element) => <div className="summary-row" key={element.id}><span><strong>{element.label}</strong><small>{element.conditions || '결과 조건에서 제외'}</small></span><Badge tone="error">제외</Badge></div>) : <p className="muted">제외한 요소가 없습니다.</p>}</section>
      <section className="review-section"><div className="section-heading"><div><p className="eyebrow">04 · 시점</p><h2>카메라 시점</h2></div><Button tone="quiet" icon="edit" onClick={() => go('camera')}>시점 편집</Button></div>{primary ? project.cameras.map((camera) => <div className="summary-row" key={camera.id}><span><strong>{camera.name}</strong><small>위치 {pct(camera.x)}%, {pct(camera.y)}% · 방향 {camera.directionDegrees}° · {camera.fovPreset === 'wide' ? '넓은' : camera.fovPreset === 'narrow' ? '좁은' : '기본'} 화각</small></span><Badge tone={camera.primary ? 'selected' : 'neutral'}>{camera.primary ? '대표' : '추가'}</Badge></div>) : <Empty>대표 카메라가 필요합니다.</Empty>}</section>
    </div><aside className="review-side">
      <div className="panel-heading"><div><p className="eyebrow">미리보기 전</p><h2>조건 확인</h2></div></div>
      <div className={`review-state ${preflight.valid ? 'ready' : 'blocked'}`}><strong>{preflight.valid ? '필수 조건이 준비되었습니다' : `${preflight.issues.filter((item) => item.severity === 'error').length}개 조건을 확인하세요`}</strong><p>{preflight.valid ? '선택한 시점으로 진행할 수 있습니다.' : '각 항목을 선택하면 관련 설정으로 이동합니다.'}</p></div>
      <div className="condition-synthesis"><strong>입력한 조건 요약</strong><p>기본 구조 {fixedStructures.length}개를 고정하고 디자인 요소 {placed.length}개를 지정했습니다. {excluded.length ? `${excluded.length}개 요소는 제외합니다.` : '제외한 요소는 없습니다.'}</p><p>주요 적용 · {placed.slice(0, 2).map((element) => `${element.label} (${targetDescription(project, element.target)})`).join(' · ') || '아직 배치된 디자인 요소가 없습니다.'}</p><p>{feel ? `분위기는 ‘${feel}’을 의도합니다.` : '분위기 조건을 추가하면 이곳에 함께 정리됩니다.'} {reviewCamera ? `${reviewCamera.name} 시점에서 검토합니다.` : '시점을 지정해 주세요.'}</p><small>입력 조건을 바탕으로 만든 생성 전 설명입니다. 이미지 분석이나 생성 결과 예측은 아닙니다.</small></div>
      {preflight.issues.map((issue, index) => <button key={`${issue.code}-${index}`} className="issue-row" onClick={() => { const destination = issueStep(issue); go(destination); if (issue.elementId) setSelectedElementId(issue.elementId); if (issue.structureId) setSelectedStructureId(issue.structureId) }}><span>{issue.message}</span><strong>수정하기</strong></button>)}
      <div className="review-camera-choice"><label className="field"><span>결과를 볼 시점</span><select value={project.cameras.some((item) => item.id === selectedCameraId) ? selectedCameraId : primary?.id ?? ''} onChange={(event) => setSelectedCameraId(event.target.value)}>{project.cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}{camera.primary ? ' · 대표' : ''}</option>)}</select></label></div>
      <div className="generation-panel"><div className="generation-panel__heading"><Badge tone="selected">실제 생성</Badge><strong>AI 이미지 1장 만들기</strong></div><p>저화질 1536×1024 한 장을 선택한 시점에서 생성합니다. 출력 요금 예시는 US$0.006이며, 입력 사진·도면·레퍼런스·문장 비용이 추가됩니다. 실제 청구액은 사용량에 따라 달라집니다.</p><p>실행할 때 기존 공간 사진 1장, 업로드 도면(있는 경우), 적용 레퍼런스 최대 3장이 OpenAI로 전송됩니다. 결과의 구조·치수 일치는 직접 확인해 주세요.</p>{tooManyGenerationReferences && <p className="generation-panel__warning">적용 레퍼런스가 {generationReferenceCount}장입니다. 비용과 요청 크기를 제한하기 위해 최대 3장까지 선택해 주세요. <button type="button" onClick={() => go('references')}>레퍼런스 수정</button></p>}{generationStatusLoading ? <p className="muted">생성 서버 상태 확인 중…</p> : generationStatus?.available ? <>{generationStatus.requiresAccessCode && <label className="field"><span>생성 접근 코드</span><input type="password" autoComplete="off" value={generationAccessCode} onChange={(event) => setGenerationAccessCode(event.target.value)} placeholder="접근 코드를 입력하세요" /></label>}<Button tone="primary" onClick={generateImage} disabled={!preflight.valid || busy || tooManyGenerationReferences || (generationStatus.requiresAccessCode && !generationAccessCode.trim())}>{busy ? '처리 중…' : 'AI 이미지 생성 · 비용 발생'}</Button></> : <p className="muted">이 배포에는 생성 서버 또는 API 키가 준비되지 않았습니다. 아래 데모 샘플을 사용할 수 있습니다.</p>}<a href="https://developers.openai.com/api/docs/models/gpt-image-1-mini" target="_blank" rel="noopener noreferrer">OpenAI 공식 요금 확인</a></div>
      <div className="offline-note"><Badge tone="info">무료 샘플</Badge><p>{OFFLINE_DEMO_NOTICE}</p></div><Button tone={generationStatus?.available ? 'secondary' : 'primary'} onClick={previewSample} disabled={!preflight.valid || busy}>{busy ? '여는 중…' : '사전 제공 샘플 열기'}</Button>{project.results.length > 0 && <Button tone="quiet" onClick={() => go('results')}>저장된 결과 보기 · {project.results.length}개</Button>}
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
    const snapshotProject = snapshot?.common?.floorPlan ? { ...project, floorPlan: snapshot.common.floorPlan } : project
    return <div className="results-layout"><section className="result-main"><div className="panel-heading"><div><p className="eyebrow">시안 확인</p><h2>{project.cameras.find((item) => item.id === current?.cameraId)?.name ?? '결과'}</h2></div><div className="badge-line">{current?.stale && <Badge tone="error">이전 조건</Badge>}{current && <Badge tone="info">{current.origin === 'ai' ? 'AI 생성' : '사전 제공 샘플'}</Badge>}</div></div>
      {current ? <><div className="result-image-frame"><AssetImage uri={current.imageUri} alt={current.origin === 'ai' ? '현재 시점에서 AI가 생성한 공간 콘셉트 이미지' : '사전 준비된 AURA POP-UP 데모 공간 이미지'} className="result-image" /><span className="result-watermark">{current.origin === 'ai' ? 'AI 생성 · 실제 시공·치수 확인 필요' : '사전 제공 샘플 · 생성 결과 아님'}</span></div><div className="result-caption"><span>버전 {project.results.indexOf(current) + 1} · {new Date(current.createdAt).toLocaleDateString('ko-KR')} · {current.approved ? '승인됨' : '검토 중'}</span><span>{current.stale ? '현재 조건과 다릅니다. 이 이미지는 그대로 보관됩니다.' : current.origin === 'ai' ? '현재 입력 조건으로 생성한 콘셉트 이미지' : '조건 기록 · 샘플 이미지와 별개'}</span></div><div className="result-actions"><Button tone={current.approved ? 'secondary' : 'primary'} icon={current.approved ? undefined : 'check'} onClick={() => commit(setResultApproved(project, current.id, !current.approved), current.approved ? '승인을 취소했습니다.' : '결과를 승인했습니다.')}>{current.approved ? '승인 취소' : '이 결과 승인'}</Button><Button onClick={() => downloadResult(current)} disabled={busy}>이미지 내보내기</Button><Button onClick={exportRecord}>작업 기록 JSON</Button></div><p className="muted small">{current.origin === 'ai' ? '이미지 모델은 Keep·위치·치수의 완전한 일치를 보장하지 않습니다. 승인 전에 직접 대조해 주세요.' : OFFLINE_DEMO_NOTICE} 작업 기록 JSON에는 업로드 원본과 결과 이미지 파일이 포함되지 않습니다.</p></> : <div className="result-empty"><Empty>아직 결과가 없습니다. 조건 검토에서 샘플 미리보기를 열거나 AI 이미지를 생성하세요.</Empty><Button onClick={() => go('review')}>조건 검토로 이동</Button></div>}
      <div className="history-section"><div className="section-heading"><h3>결과 이력</h3><span className="meta">{project.results.length}개</span></div><SwipeCarousel label="결과 이력" variant="history" activeId={current?.id} onActiveIdChange={setSelectedResultId} items={project.results.map((result, index) => ({ id: result.id, content: <button type="button" className={`history-item ${current?.id === result.id ? 'is-selected' : ''}`} aria-pressed={current?.id === result.id} onClick={() => setSelectedResultId(result.id)}><AssetImage uri={result.imageUri} alt={`결과 ${index + 1} 미리보기`} /><span><strong>버전 {index + 1} · {project.cameras.find((camera) => camera.id === result.cameraId)?.name ?? '삭제된 시점'}</strong><small>{result.origin === 'ai' ? 'AI 생성' : '사전 제공 샘플'} · {result.approved ? '승인됨' : '검토 중'} · {result.stale ? '이전 조건' : '현재 조건'}</small></span></button> }))} /></div>
      {approved.length > 0 && <div className="moodboard-section"><div className="section-heading"><h3>승인 이미지 모아보기</h3><span className="meta">승인된 결과만 표시</span></div><SwipeCarousel label="승인 이미지" variant="gallery" activeId={current?.approved ? current.id : undefined} onActiveIdChange={setSelectedResultId} items={approved.map((result) => ({ id: result.id, content: <button type="button" className={`approved-result-card ${current?.id === result.id ? 'is-selected' : ''}`} aria-pressed={current?.id === result.id} onClick={() => setSelectedResultId(result.id)}><AssetImage uri={result.imageUri} alt={`승인된 ${result.origin === 'ai' ? 'AI 생성' : '사전 제공 샘플'} 결과 버전 ${project.results.indexOf(result) + 1}`} /><span>버전 {project.results.indexOf(result) + 1} · {project.cameras.find((camera) => camera.id === result.cameraId)?.name ?? '시점'}</span></button> }))} /></div>}
    </section><aside className="result-inspector"><div className="panel-heading"><div><p className="eyebrow">이 결과의 조건</p><h2>조건 기록</h2></div></div>{snapshot ? <div className="result-conditions"><div className="condition-group"><div className="group-heading"><h3>Keep</h3><Button tone="quiet" onClick={() => go('keep')}>수정</Button></div><details className="result-details"><summary>보존 구조 {snapshot.common?.keeps.length ?? 0}개 펼쳐보기</summary>{(snapshot.common?.keeps ?? []).map((keep) => <p key={keep.id}>{snapshotProject.floorPlan?.structures.find((structure) => structure.id === keep.structureId)?.name ?? keep.description}</p>)}</details></div><div className="condition-group"><div className="group-heading"><h3>적용 요소</h3><Button tone="quiet" onClick={() => go('references')}>수정</Button></div>{(snapshot.common?.elements ?? []).filter((element) => element.status === 'apply').map((element) => <button key={element.id} className="condition-link" onClick={() => editElement(element.id)}><strong>{element.label}</strong><span>{targetDescription(snapshotProject, element.target)}</span></button>)}</div><div className="condition-group"><div className="group-heading"><h3>제외</h3><Button tone="quiet" onClick={() => go('references')}>수정</Button></div>{(snapshot.common?.elements ?? []).filter((element) => element.status === 'exclude').map((element) => <p key={element.id}>{element.label}</p>)}</div><div className="condition-group"><div className="group-heading"><h3>시점</h3><Button tone="quiet" onClick={() => go('camera')}>수정</Button></div><p>{project.cameras.find((camera) => camera.id === snapshot.camera.id)?.name ?? '시점'} · {pct(snapshot.camera.x)}%, {pct(snapshot.camera.y)}% · {snapshot.camera.directionDegrees}°</p></div></div> : <Empty>조건 기록이 없습니다.</Empty>}<div className="result-inspector-bottom"><Button onClick={() => go('review')}>조건 다시 검토</Button><Button onClick={() => { if (project.cameras.length >= 3) { setError('시점은 최대 3개까지 관리할 수 있습니다.'); return } const camera: Camera = { id: makeId('camera'), name: `추가 시점 ${project.cameras.length}`, x: .5, y: .78, directionDegrees: 270, fovPreset: 'standard', primary: false }; commit(addCamera(project, camera), '추가 시점을 만들었습니다. 위치를 설정해 주세요.'); setSelectedCameraId(camera.id); go('camera') }} disabled={project.cameras.length >= 3}>추가 시점 설정</Button></div></aside></div>
  }

  const stepIndex = step === 'projects' ? -1 : STEPS.indexOf(step)
  return <div className="app-shell"><header className="app-header"><div className="header-inner"><button className="brand" onClick={() => go('projects')} aria-label="프로젝트 목록으로 이동"><img className="brand-mark" src="/brand/mark.svg" alt="" aria-hidden="true" width="30" height="30" /><span>공간 레퍼런스 해석기</span></button><div className="header-right"><span className="demo-label">{generationStatus?.available ? 'AI 생성 연결됨' : '데모 사용 가능'}</span>{step !== 'projects' && <button className="project-switch" onClick={() => go('projects')}>{project.name} · 프로젝트 목록</button>}</div></div></header>
    {step !== 'projects' && <nav ref={stepNavRef} className="step-nav" aria-label="작업 단계"><div className="step-nav-inner">{STEPS.map((item, index) => <button key={item} className={`step-link ${item === step ? 'is-current' : ''} ${index < stepIndex ? 'is-complete' : ''}`} aria-current={item === step ? 'step' : undefined} onClick={() => go(item)}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><NucleoIcon name={STEP_ICONS[item]} /><span>{STEP_LABELS[item]}</span></button>)}</div></nav>}
    <main className={`main-content ${step === 'projects' ? 'project-main' : ''}`}><div className="content-wrap">{step !== 'projects' && <div className="page-intro"><div><p className="eyebrow">{project.name} · {String(stepIndex + 1).padStart(2, '0')} / 07</p><h1 ref={pageTitleRef} tabIndex={-1}>{STEP_LABELS[step]}</h1><p className="lede">{STEP_DESCRIPTIONS[step]}</p></div><div className="page-status"><Badge tone="info">{project.floorPlan?.geometryConfidence === 'schematic' ? '개략 도면' : project.floorPlan ? '도면 등록' : '도면 없음'}</Badge><span>수정 버전 {project.commonRevision}</span></div></div>}
      {error && <div className="alert alert-error" role="alert"><NucleoIcon name="warning" /><strong>확인 필요</strong><span>{error}</span><button onClick={() => setError('')} aria-label="오류 닫기" title="닫기"><NucleoIcon name="close" /></button></div>}{notice && <div key={noticeSerial} className="alert alert-info" role="status"><NucleoIcon name="info" /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="알림 닫기" title="닫기"><NucleoIcon name="close" /></button></div>}
      {step === 'projects' && renderProjects()}{step === 'space' && renderSpace()}{step === 'keep' && renderKeep()}{step === 'references' && renderReferences()}{step === 'placement' && renderPlacement()}{step === 'camera' && renderCamera()}{step === 'review' && renderReview()}{step === 'results' && renderResults()}
    </div></main>
    {step !== 'projects' && <footer className="app-footer"><div className="footer-inner"><span className="footer-note">{saveFailed ? '브라우저 저장 실패 · 오류를 확인해 주세요.' : '이 브라우저에 자동 저장 · 샘플과 AI 생성 결과는 출처를 구분해 표시합니다.'}</span><div className="footer-actions"><Button icon="previous" onClick={() => go(stepIndex === 0 ? 'projects' : STEPS[stepIndex - 1])}>{stepIndex === 0 ? '프로젝트 목록' : '이전 단계'}</Button>{stepIndex < STEPS.length - 1 && step !== 'review' && <Button tone="primary" icon="next" iconAfter onClick={() => go(STEPS[stepIndex + 1])}>다음 단계</Button>}</div></div></footer>}
  </div>
}
