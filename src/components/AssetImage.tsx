import { useEffect, useState } from 'react'
import { resolveImageUri, revokeImageUrl } from '../services/assets'

interface Props {
  uri: string
  alt: string
  className?: string
}

export default function AssetImage({ uri, alt, className }: Props) {
  const [src, setSrc] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    let current = true
    let resolved = ''
    setSrc('')
    setError(false)
    resolveImageUri(uri).then((url) => {
      resolved = url
      if (current) setSrc(url)
      else revokeImageUrl(url)
    }).catch(() => { if (current) setError(true) })
    return () => {
      current = false
      revokeImageUrl(resolved)
    }
  }, [uri])

  if (error) return <div className={`image-empty ${className ?? ''}`} role="img" aria-label={alt}>저장된 이미지를 불러올 수 없습니다.</div>
  if (!src) return <div className={`image-empty ${className ?? ''}`} aria-hidden="true">이미지 불러오는 중</div>
  return <img className={className} src={src} alt={alt} onError={() => setError(true)} />
}
