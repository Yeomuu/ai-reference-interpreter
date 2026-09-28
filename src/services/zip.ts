/** Small, dependency-free ZIP (STORE) for UTF-8 experiment text files. No image compression or ZIP64. */
export function textZip(files: Record<string, string>): Blob {
  const encoder = new TextEncoder()
  const chunks: Uint8Array<ArrayBuffer>[] = [], directory: Uint8Array<ArrayBuffer>[] = []
  let offset = 0
  function header(length: number) { const bytes = new Uint8Array(length); return { bytes, view: new DataView(bytes.buffer) } }
  function crc32(bytes: Uint8Array) {
    let crc = 0xffffffff
    for (const byte of bytes) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
    return (crc ^ 0xffffffff) >>> 0
  }
  for (const [path, content] of Object.entries(files)) {
    if (!/^[a-z0-9_.\-/]+$/i.test(path) || path.includes('..') || path.startsWith('/')) throw new Error('내보내기 파일 이름을 확인해 주세요.')
    const name = encoder.encode(path), data = encoder.encode(content), crc = crc32(data)
    const local = header(30)
    local.view.setUint32(0, 0x04034b50, true); local.view.setUint16(4, 20, true)
    local.view.setUint16(6, 0x0800, true); local.view.setUint16(12, 33, true)
    local.view.setUint32(14, crc, true); local.view.setUint32(18, data.length, true); local.view.setUint32(22, data.length, true)
    local.view.setUint16(26, name.length, true)
    chunks.push(local.bytes, name, data)
    const central = header(46)
    central.view.setUint32(0, 0x02014b50, true); central.view.setUint16(4, 20, true); central.view.setUint16(6, 20, true)
    central.view.setUint16(8, 0x0800, true); central.view.setUint16(14, 33, true)
    central.view.setUint32(16, crc, true); central.view.setUint32(20, data.length, true); central.view.setUint32(24, data.length, true)
    central.view.setUint16(28, name.length, true); central.view.setUint32(42, offset, true)
    directory.push(central.bytes, name)
    offset += local.bytes.length + name.length + data.length
  }
  const size = directory.reduce((sum, item) => sum + item.length, 0)
  const end = header(22), count = Object.keys(files).length
  end.view.setUint32(0, 0x06054b50, true); end.view.setUint16(8, count, true); end.view.setUint16(10, count, true)
  end.view.setUint32(12, size, true); end.view.setUint32(16, offset, true)
  return new Blob([...chunks, ...directory, end.bytes], { type: 'application/zip' })
}
