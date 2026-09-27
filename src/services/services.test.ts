import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSampleProject } from '../data/sample';
import { validateImageFile } from './assets';
import { OFFLINE_DEMO_NOTICE, offlineDemoProvider } from './imageProvider';
import { getProject, isProject, loadProjects, removeProject, saveProject } from './persistence';

afterEach(() => vi.unstubAllGlobals());

describe('uploaded image validation', () => {
  const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it('accepts a file whose extension, MIME and bytes agree', async () => {
    const file = new File([pngSignature], 'space.png', { type: 'image/png' });
    expect(await validateImageFile(file, 'floor-plan')).toMatchObject({ valid: true, mimeType: 'image/png' });
  });

  it('rejects a renamed file with conflicting MIME', async () => {
    const file = new File([pngSignature], 'space.jpg', { type: 'image/jpeg' });
    expect((await validateImageFile(file, 'photo')).valid).toBe(false);
  });
});

describe('offline result provenance', () => {
  it('returns a fixed sample and snapshots current conditions without changing the project', async () => {
    const project = createSampleProject();
    const before = structuredClone(project);
    const result = await offlineDemoProvider.createResult(project, 'camera-entrance');
    expect(result).toMatchObject({
      imageUri: '/sample/result.png',
      origin: 'sample',
      approved: false,
      cameraId: 'camera-entrance',
    });
    expect(result.conditionsSnapshot.appliedElementIds).toContain('element-display');
    expect(result.conditionsSnapshot.camera.fovPreset).toBe('standard');
    expect(OFFLINE_DEMO_NOTICE).toContain('현재 조건이나 카메라 설정을 반영해 생성한 결과가 아닙니다');
    expect(project).toEqual(before);
  });

  it('accepts an older result snapshot without a field of view', async () => {
    const project = createSampleProject();
    const existingPhotoId = project.sourceImages.find((image) => image.role === 'existing-space')!.id;
    const result = await offlineDemoProvider.createResult(project, 'camera-entrance', existingPhotoId);
    expect(result.conditionsSnapshot.existingPhotoId).toBe(existingPhotoId);
    delete result.conditionsSnapshot.camera.fovPreset;
    delete result.conditionsSnapshot.existingPhotoId;
    project.results.push(result);
    expect(isProject(project)).toBe(true);
    result.conditionsSnapshot.camera.fovPreset = 'wide';
    expect(isProject(project)).toBe(true);
  });

  it('rejects an invalid selected extra camera before returning a sample result', async () => {
    const project = createSampleProject();
    project.cameras.push({
      id: 'camera-outside', name: '도면 밖', x: 0.99, y: 0.99,
      directionDegrees: 180, primary: false,
    });
    await expect(offlineDemoProvider.createResult(project, 'camera-outside'))
      .rejects.toThrow('카메라는 이동 가능한 바닥 안에 놓고 방향을 지정해 주세요.');
  });
});

describe('versioned project storage', () => {
  it('saves, loads and removes project JSON', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const project = createSampleProject();
    saveProject(project);
    expect(loadProjects()).toHaveLength(1);
    expect(getProject(project.id)?.name).toBe('AURA POP-UP');
    removeProject(project.id);
    expect(loadProjects()).toEqual([]);
  });

  it('quarantines malformed floor plans without overwriting the original stored record', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const valid = createSampleProject();
    const invalidPlan = { ...createSampleProject(), id: 'invalid-plan', floorPlan: 'invalid' };
    const invalidGeometry = structuredClone(valid);
    invalidGeometry.id = 'invalid-geometry';
    invalidGeometry.floorPlan!.structures[0].geometry = { kind: 'rect', bounds: null } as never;
    const key = 'ai-reference-interpreter:projects:v1';
    const raw = JSON.stringify({ schemaVersion: 1, projects: [valid, invalidPlan, invalidGeometry] });
    values.set(key, raw);

    expect(loadProjects().map((project) => project.id)).toEqual([valid.id]);
    expect(() => saveProject(valid)).toThrow('손상되었거나 다른 버전의 프로젝트 데이터가 있어 덮어쓰지 않았습니다.');
    expect(values.get(key)).toBe(raw);
  });

  it('quarantines malformed collection items and result snapshots before they reach the UI', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const valid = createSampleProject();
    const invalidImages = { ...createSampleProject(), id: 'invalid-images', sourceImages: [null] };
    const invalidSnapshot = createSampleProject();
    invalidSnapshot.id = 'invalid-snapshot';
    invalidSnapshot.results[0].conditionsSnapshot.common!.elements = [null] as never;
    const key = 'ai-reference-interpreter:projects:v1';
    const raw = JSON.stringify({ schemaVersion: 1, projects: [valid, invalidImages, invalidSnapshot] });
    values.set(key, raw);

    expect(loadProjects().map((project) => project.id)).toEqual([valid.id]);
    expect(() => saveProject(valid)).toThrow('손상되었거나 다른 버전의 프로젝트 데이터가 있어 덮어쓰지 않았습니다.');
    expect(values.get(key)).toBe(raw);
  });
});
