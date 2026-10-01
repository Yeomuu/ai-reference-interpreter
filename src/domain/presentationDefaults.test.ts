import { describe, expect, it } from 'vitest'
import { createSampleProject } from '../data/sample'
import { createCampusProject } from '../data/campus'
import { suggestNextCamera } from './cameraDefaults'
import { displayName } from './displayName'
import { validateCamera } from './validation'
import { prepareRecommendedCameras } from './cameraRecommendations'
import { addCamera } from './revisions'

describe('new plan labels and camera suggestions', () => {
  it('numbers blank names without reusing names that already exist', () => {
    expect(displayName(['공간 영역 (1)'], '', '공간 영역')).toBe('공간 영역 (2)')
    expect(displayName(['전시대'], '전시대', '가구')).toBe('전시대 (1)')
    expect(displayName(['전시대'], '안내 책상', '가구')).toBe('안내 책상')
  })

  it('places the first suggested camera near a registered entrance facing the room', () => {
    const project = { ...createSampleProject(), cameras: [] }
    const suggestion = suggestNextCamera(project)
    expect(suggestion.x).toBeCloseTo(.5)
    expect(suggestion.y).toBeGreaterThan(.7)
    expect(suggestion.directionDegrees).toBeGreaterThan(240)
    expect(validateCamera(addCamera(project, { id: 'suggested', name: '대표 시점', ...suggestion, primary: true }), 'suggested').valid).toBe(true)
  })

  it('keeps the school starting view on usable floor', () => {
    const project = prepareRecommendedCameras(createCampusProject('exhibition'))
    expect(validateCamera(project, project.cameras[0].id).valid).toBe(true)
  })
})
