import type { Camera } from './types.js';

export const MAX_LAYOUT_ITEMS = 20;
export const MAX_REFERENCE_IMAGES = 8;
export const USER_AREA_KINDS = ['spatial', 'passage'] as const;
export const MAX_CAMERAS = 3;
export const LAYOUT_LIMIT_MESSAGE = `배치 요소는 최대 ${MAX_LAYOUT_ITEMS}개까지 추가할 수 있습니다. 기존 요소를 삭제한 후 다시 추가해주세요.`;
export const REFERENCE_LIMIT_MESSAGE = `레퍼런스는 최대 ${MAX_REFERENCE_IMAGES}장까지 등록할 수 있습니다. 한 이미지는 여러 요소에 반복 적용할 수 있습니다.`;

// Rendering suggestions, NOT verified anthropometric means. Before using these
// presets in research, replace them with sex/age-specific Size Korea eye-height
// statistics (standing eye height, not stature). Keep the notice in the editor.
export const CAMERA_EYE_HEIGHT_PRESETS = {
  'average-female': { label: '여성 평균 눈높이 · 임시', heightMeters: 1.48 },
  'average-male': { label: '남성 평균 눈높이 · 임시', heightMeters: 1.60 },
  custom: { label: '직접 지정', heightMeters: 1.60 },
} as const;
export const EYE_HEIGHT_NOTICE = '여성·남성 눈높이는 임시값입니다. 연구 적용 전 공식 인체치수 근거로 확인 필요';
export const CAMERA_PRESETS = {
  overview: { name: '전체 배치', heightMeters: 3.2, pitchDegrees: -45, fovPreset: 'wide' },
  entry: { name: '입구에서 안쪽', heightMeters: CAMERA_EYE_HEIGHT_PRESETS.custom.heightMeters, pitchDegrees: 0, fovPreset: 'wide' },
  secondary: { name: '다른 방향', heightMeters: CAMERA_EYE_HEIGHT_PRESETS.custom.heightMeters, pitchDegrees: 0, fovPreset: 'standard' },
  custom: { name: '직접 설정', heightMeters: CAMERA_EYE_HEIGHT_PRESETS.custom.heightMeters, pitchDegrees: 0, fovPreset: 'standard' },
} satisfies Record<NonNullable<Camera['viewPreset']>, {name: string; heightMeters: number; pitchDegrees: number; fovPreset: NonNullable<Camera['fovPreset']>}>;
export const CAMERA_RECOMMENDATION = {
  gridSteps: 24, wallMargin: .018, frontDistance: .08,
  minViewDistance: .18, minViewAngle: 45,
} as const;
