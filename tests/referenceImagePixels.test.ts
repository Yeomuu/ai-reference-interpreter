import { afterEach, describe, expect, it, vi } from 'vitest'
import { compactImage } from '../src/services/imageProvider'

afterEach(() => vi.unstubAllGlobals())

function fakeImageBrowser() {
  const draws: unknown[][] = []
  const bitmap = { width: 1000, height: 800, close: vi.fn() }
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({
      fillStyle: '', fillRect: vi.fn(),
      drawImage: (...args: unknown[]) => draws.push(args),
    }),
    toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['small'], { type: 'image/jpeg' })),
  }
  vi.stubGlobal('document', { createElement: () => canvas })
  vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap))
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['image'], { type: 'image/png' }) })))
  vi.stubGlobal('FileReader', class {
    result = 'data:image/jpeg;base64,c21hbGw='
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    readAsDataURL() { this.onload?.() }
  })
  return { draws, bitmap, canvas }
}

describe('reference image pixels before generation', () => {
  it('takes only the selected source rectangle for one cropped element', async () => {
    const { draws, bitmap, canvas } = fakeImageBrowser()
    await compactImage('/sample/product.png', { mode: 'crop', regions: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.4 }] })
    expect(draws).toHaveLength(1)
    expect(draws[0]).toEqual([bitmap, 100, 160, 300, 320, 0, 0, canvas.width, canvas.height])
    expect(canvas.width).toBe(300)
    expect(canvas.height).toBe(320)
  })

  it('sends two different source crops as separate left and right panels in one image', async () => {
    const { draws, bitmap, canvas } = fakeImageBrowser()
    await compactImage('/sample/product.png', { mode: 'grid', regions: [
      { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      { x: 0.6, y: 0.5, width: 0.2, height: 0.2 },
    ] })
    expect(canvas.width).toBe(1000)
    expect(canvas.height).toBe(500)
    expect(draws).toHaveLength(2)
    expect(draws[0].slice(0, 5)).toEqual([bitmap, 100, 160, 300, 320])
    expect(draws[1].slice(0, 5)).toEqual([bitmap, 600, 400, 200, 160])
    expect(Number(draws[0][5])).toBeLessThan(Number(draws[1][5]))
    expect(Number(draws[0][6])).toBeGreaterThan(0)
    expect(Number(draws[1][6])).toBeGreaterThan(0)
  })

  it('keeps whole source pixels when no crop is requested', async () => {
    const { draws, bitmap, canvas } = fakeImageBrowser()
    await compactImage('/sample/product.png')
    expect(draws).toEqual([[bitmap, 0, 0, canvas.width, canvas.height]])
  })
})
