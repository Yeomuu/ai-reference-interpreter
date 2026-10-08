const ICON_FILES = {
  add: 'IconPlusOutline18.svg',
  previous: 'IconChevronLeftOutline18.svg',
  next: 'IconChevronRightOutline18.svg',
  close: 'IconXmarkOutline18.svg',
  check: 'IconCheckOutline18.svg',
  info: 'IconCircleInfoOutline18.svg',
  warning: 'IconTriangleWarningOutline18.svg',
  image: 'IconImageOutline18.svg',
  images: 'IconImages2Outline18.svg',
  file: 'IconFileOutline18.svg',
  layers: 'IconLayers3Outline18.svg',
  show: 'IconEyeOpenOutline18.svg',
  hide: 'IconEyeClosedOutline18.svg',
  lock: 'IconLockOutline18.svg',
  trash: 'IconTrashOutline18.svg',
  refresh: 'IconRefresh2Outline18.svg',
  edit: 'IconPen3Outline18.svg',
  camera: 'IconCameraOutline18.svg',
  rotate: 'IconRotation360Outline18.svg',
  structure: 'IconSitemap4Outline18.svg',
  minus: 'IconMinusOutline18.svg',
  undo: 'IconArrowDottedRotateAnticlockwiseOutline18.svg',
  redo: 'IconArrowDottedRotateAnticlockwiseOutline18.svg',
} as const

export type NucleoIconName = keyof typeof ICON_FILES

/** Decorative mark paired with a visible Korean control label. Assets are verified in docs/ICON_MANIFEST.md. */
export default function NucleoIcon({ name }: { name: NucleoIconName }) {
  const uri = `/icons/nucleo/${ICON_FILES[name]}`
  return <span
    className={`nucleo-icon${name === 'redo' ? ' nucleo-icon--redo' : ''}`}
    aria-hidden="true"
    style={{ WebkitMaskImage: `url("${uri}")`, maskImage: `url("${uri}")` }}
  />
}
