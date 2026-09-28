import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSampleProject } from '../src/data/sample'
import { createApiImageProvider, GenerationOutcomeUnknownError } from '../src/services/imageProvider'

afterEach(() => vi.unstubAllGlobals())

function stubImagePreparation(post: () => Promise<unknown>) {
  const send = vi.fn(async (input: string, init?: RequestInit) => { void input; void init; return post() })
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => input === '/api/generate'
    ? send(input, init) : { ok: true, blob: async () => input.startsWith('data:image/jpeg;')
      ? new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9])], { type: 'image/jpeg' })
      : new Blob(['image'], { type: 'image/png' }) }))
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1000, height: 800, close: vi.fn() })))
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }),
    toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['small'], { type: 'image/jpeg' })),
  }) })
  vi.stubGlobal('FileReader', class {
    result = 'data:image/jpeg;base64,c21hbGw='
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    readAsDataURL() { this.onload?.() }
  })
  return send
}

describe('uncertain paid request outcome', () => {
  it('distinguishes a lost network response from a definitive rejection', async () => {
    const send = stubImagePreparation(async () => { throw new TypeError('connection reset') })
    const action = createApiImageProvider().createResult(createSampleProject(), 'camera-entrance')
    await expect(action).rejects.toMatchObject({ name: 'GenerationOutcomeUnknownError', message: expect.stringContaining('즉시 다시 요청하지 마세요') })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('marks a success response with unreadable body as uncertain', async () => {
    stubImagePreparation(async () => ({ ok: true, json: async () => { throw new SyntaxError('truncated') } }))
    await expect(createApiImageProvider().createResult(createSampleProject(), 'camera-entrance'))
      .rejects.toBeInstanceOf(GenerationOutcomeUnknownError)
  })

  it('keeps a server-declared validation rejection as an ordinary error', async () => {
    stubImagePreparation(async () => ({ ok: false, json: async () => ({ error: '입력 형식을 확인해 주세요.' }) }))
    const action = createApiImageProvider().createResult(createSampleProject(), 'camera-entrance')
    await expect(action).rejects.toThrow('입력 형식을 확인해 주세요.')
    await expect(action).rejects.not.toBeInstanceOf(GenerationOutcomeUnknownError)
  })

  it('keeps server-reported upstream uncertainty and an unreadable gateway error locked', async () => {
    stubImagePreparation(async () => ({ ok: false, status:502, json: async () => ({ error:'결과 불확실', outcomeUnknown:true }) }));
    await expect(createApiImageProvider().createResult(createSampleProject(), 'camera-entrance')).rejects.toBeInstanceOf(GenerationOutcomeUnknownError);
    stubImagePreparation(async () => ({ ok:false, status:504, json:async () => { throw new SyntaxError('gateway HTML'); } }));
    await expect(createApiImageProvider().createResult(createSampleProject(), 'camera-entrance')).rejects.toBeInstanceOf(GenerationOutcomeUnknownError);
  });

  it('sends the chosen existing-space photo as the first input', async () => {
    const send = stubImagePreparation(async () => ({ ok: false, json: async () => ({ error: '검증 종료' }) }))
    const project = createSampleProject()
    const existing = project.sourceImages.find((image) => image.role === 'existing-space')!
    project.sourceImages.push({ ...existing, id: 'second-existing', name: '두 번째 기존 공간 사진' })
    await expect(createApiImageProvider().createResult(project, 'camera-entrance', 'second-existing'))
      .rejects.toThrow('검증 종료')
    const options = send.mock.calls[0][1]!
    const body = JSON.parse(String(options.body))
    expect(body.images[0]).toMatchObject({ role: 'existing-space', sourceId: 'second-existing' })
  })

  it('blocks a missing selected existing-space photo before a paid call', async () => {
    const send = stubImagePreparation(async () => ({ ok: false, json: async () => ({ error: 'unexpected' }) }))
    await expect(createApiImageProvider().createResult(createSampleProject(), 'camera-entrance', 'deleted-photo'))
      .rejects.toThrow('선택한 기존 공간 사진을 찾지 못했습니다')
    expect(send).not.toHaveBeenCalled()
  })

  it('locks retry when the server generated an image but browser storage fails', async () => {
    const send = stubImagePreparation(async () => ({ ok: true, json: async () => ({
      imageDataUrl: 'data:image/jpeg;base64,/9j/4P/Z',
    }) }))
    const open = vi.fn(() => { throw new Error('storage unavailable') })
    vi.stubGlobal('indexedDB', { open })
    await expect(createApiImageProvider().createResult(createSampleProject(), 'camera-entrance'))
      .rejects.toMatchObject({ name: 'GenerationOutcomeUnknownError',
        message: expect.stringContaining('생성됐지만 이 브라우저에 저장하지 못했습니다') })
    expect(send).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledTimes(1)
  })
})
