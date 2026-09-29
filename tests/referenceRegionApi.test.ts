import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import generate from '../api/generate'
import { IDENTITY_COOKIE, signedIdentity } from '../api/_lib/generationIdentity'
vi.mock('../api/_lib/generationQuota', async original => { const actual = await original<typeof import('../api/_lib/generationQuota')>(); return { ...actual, quotaConfigured: () => true, generationQuota: { reserve: vi.fn(async () => {}), finish: vi.fn(async () => {}) } }; })
import { createSampleProject } from '../src/data/sample'
import { referencePreparationFor, type GenerationRequest } from '../src/services/generationContract'

const dataUrl = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]).toString('base64')}`

function requestAndResponse(project = createSampleProject()) {
  project.results = []
  const body: GenerationRequest = {
    project, cameraId: 'camera-entrance',
    images: [
      { role: 'existing-space', sourceId: 'photo-existing', dataUrl },
      { role: 'inspiration', sourceId: 'photo-atmosphere', dataUrl },
      { role: 'inspiration', sourceId: 'photo-graphic', dataUrl },
      { role: 'product', sourceId: 'photo-product', dataUrl },
    ],
  }
  const request = { method: 'POST', headers: { host: 'example.test', origin: 'https://example.test',
    cookie: `${IDENTITY_COOKIE}=${signedIdentity('cccccccc-cccc-4ccc-8ccc-cccccccccccc')}`,
    'content-type': 'application/json', 'x-generation-request-id': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, body } as unknown as IncomingMessage & { body: unknown }
  const result = { statusCode: 200, body: '' }
  const response = {
    set statusCode(status: number) { result.statusCode = status },
    get statusCode() { return result.statusCode },
    setHeader: vi.fn(), end: (text: string) => { result.body = text },
  } as unknown as ServerResponse
  return { request, response, result, body }
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('reference crop API gate', () => {
  it('rejects a selected crop when its transmitted preparation metadata is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    const providerCall = vi.fn()
    vi.stubGlobal('fetch', providerCall)
    const { request, response, result, body } = requestAndResponse()
    body.project.elements[0].sourceRegion = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
    await generate(request, response)
    expect(result.statusCode).toBe(400)
    expect(result.body).toContain('선택 영역')
    expect(providerCall).not.toHaveBeenCalled()
  })

  it('rejects a changed grid order before contacting the model', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    const providerCall = vi.fn()
    vi.stubGlobal('fetch', providerCall)
    const { request, response, result, body } = requestAndResponse()
    body.project.elements[0].sourceRegion = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
    body.project.elements.push({ ...body.project.elements[0], id: 'second-display',
      target: { kind: 'floor-point', x: .75, y: .55, footprint: { width: .17, height: .12 } },
      sourceRegion: { x: 0.6, y: 0.5, width: 0.2, height: 0.2 } })
    const preparation = referencePreparationFor(body.project, 'photo-product')!
    body.images[3] = { ...body.images[3], referencePreparation: { ...preparation, regions: [...preparation.regions].reverse() } }
    await generate(request, response)
    expect(result.statusCode).toBe(400)
    expect(result.body).toContain('일치하지 않습니다')
    expect(providerCall).not.toHaveBeenCalled()
  })

  it('accepts matching grid metadata and directs each element to its transmitted panel', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    const providerCall = vi.fn(async (url: string, options: RequestInit) => {
      expect(url).toBe('https://api.openai.com/v1/images/edits')
      const prompt = String((options.body as FormData).get('prompt'))
      expect(prompt).toContain('upper-left panel')
      expect(prompt).toContain('upper-right panel')
      expect((options.body as FormData).getAll('image[]')).toHaveLength(4)
      return { ok: true, json: async () => ({ data: [{ b64_json: dataUrl.split(',')[1] }] }) }
    })
    vi.stubGlobal('fetch', providerCall)
    const { request, response, result, body } = requestAndResponse()
    body.project.elements[0].sourceRegion = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
    body.project.elements.push({ ...body.project.elements[0], id: 'second-display',
      target: { kind: 'floor-point', x: .75, y: .55, footprint: { width: .17, height: .12 } },
      sourceRegion: { x: 0.6, y: 0.5, width: 0.2, height: 0.2 } })
    body.images[3] = { ...body.images[3], referencePreparation: referencePreparationFor(body.project, 'photo-product') }
    await generate(request, response)
    expect(result.statusCode).toBe(200)
    expect(providerCall).toHaveBeenCalledTimes(1)
  })
})
