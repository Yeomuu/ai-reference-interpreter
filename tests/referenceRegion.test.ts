import { describe, expect, it } from 'vitest'
import { createSampleProject } from '../src/data/sample'
import { setStructurePreservation, updateElement } from '../src/domain/revisions'
import { isProject } from '../src/services/persistence'
import { buildGenerationPrompt, referencePreparationFor, type GenerationImage } from '../src/services/generationContract'

const images: GenerationImage[] = [
  { role: 'existing-space', sourceId: 'photo-existing', dataUrl: '' },
  { role: 'product', sourceId: 'photo-product', dataUrl: '' },
]

describe('reference source region', () => {
  it('transmits released structure geometry separately from protected structures', () => {
    const changed = setStructurePreservation(createSampleProject(), 'pillar-west', false)
    const prompt = buildGenerationPrompt(changed, 'camera-entrance', images)
    const protectedSection = prompt.split('Protected structures')[1].split('Saved preservation conditions')[0]
    const editableSection = prompt.split('User-editable plan structures')[1].split('Registered plan areas')[0]
    expect(protectedSection).not.toContain('기존 기둥')
    expect(editableSection).toContain('기존 기둥 [pillar, base]')
    expect(prompt).not.toContain('Preserve the existing shell, doors')
  })
  it('keeps one normalized image region on the element, with whole image as the default', () => {
    const sample = createSampleProject()
    const region = { x: 0.2, y: 0.25, width: 0.4, height: 0.5 }
    const changed = updateElement(sample, 'element-display', { sourceRegion: region })
    expect(changed.elements.find((element) => element.id === 'element-display')?.sourceRegion).toEqual(region)
    expect(changed.elements.find((element) => element.id === 'element-graphic')?.sourceRegion).toBeUndefined()
    expect(changed.commonRevision).toBe(sample.commonRevision + 1)
    expect(changed.results.every((result) => result.stale)).toBe(true)
    expect(isProject(JSON.parse(JSON.stringify(changed)))).toBe(true)
  })

  it('rejects an out-of-image region before it can be restored or sent for generation', () => {
    const invalid = createSampleProject()
    invalid.elements[0].sourceRegion = { x: 0.9, y: 0.1, width: 0.2, height: 0.3 }
    expect(isProject(invalid)).toBe(false)
  })

  it('describes a transmitted crop as the entire reference input, without stale source coordinates', () => {
    const sample = createSampleProject()
    const changed = updateElement(sample, 'element-display', { sourceRegion: { x: 0.2, y: 0.25, width: 0.4, height: 0.5 } })
    const prepared: GenerationImage[] = [images[0], { ...images[1], referencePreparation: referencePreparationFor(changed, 'photo-product') }]
    const prompt = buildGenerationPrompt(changed, 'camera-entrance', prepared)
    expect(prompt).toContain('input image 2')
    expect(prompt).toContain('The entire transmitted reference image is the user-selected crop')
    expect(prompt).not.toContain('normalized region x 20% to 60%')
  })

  it('preserves the original image when another applied element needs its whole image', () => {
    const sample = createSampleProject()
    const changed = updateElement(sample, 'element-display', { sourceRegion: { x: 0.2, y: 0.25, width: 0.4, height: 0.5 } })
    changed.elements.push({ ...changed.elements[0], id: 'whole-product-element', sourceRegion: undefined })
    expect(referencePreparationFor(changed, 'photo-product')).toBeUndefined()
    const prompt = buildGenerationPrompt(changed, 'camera-entrance', images)
    expect(prompt).toContain('Use only its normalized region x 20% to 60%, y 25% to 75%')
    expect(prompt).toContain('Use the whole reference only to identify this named attribute.')
  })

  it('maps different selected parts of one source to named grid panels', () => {
    const sample = createSampleProject()
    const first = { x: 0.1, y: 0.1, width: 0.3, height: 0.3 }
    const second = { x: 0.6, y: 0.4, width: 0.3, height: 0.3 }
    const changed = updateElement(sample, 'element-display', { sourceRegion: first })
    changed.elements.push({ ...changed.elements[0], id: 'second-product-element', sourceRegion: second })
    const referencePreparation = referencePreparationFor(changed, 'photo-product')
    expect(referencePreparation).toEqual({ mode: 'grid', regions: [first, second] })
    const prompt = buildGenerationPrompt(changed, 'camera-entrance', [images[0], { ...images[1], referencePreparation }])
    expect(prompt).toContain('upper-left panel')
    expect(prompt).toContain('upper-right panel')
  })

  it('rejects more than four different crops from one source before any paid request', () => {
    const sample = createSampleProject()
    sample.elements = Array.from({ length: 5 }, (_, index) => ({ ...sample.elements[0], id: `part-${index}`,
      sourceRegion: { x: index * 0.15, y: 0.1, width: 0.1, height: 0.2 } }))
    expect(() => referencePreparationFor(sample, 'photo-product')).toThrow('최대 4개')
  })
})
