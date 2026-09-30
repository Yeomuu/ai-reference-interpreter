import { useCallback, useEffect, useState } from 'react'

export const STEPS = ['space', 'keep', 'placement', 'references', 'camera', 'review', 'results'] as const
export type Step = typeof STEPS[number] | 'projects'
export interface ProjectRoute { step: Step; projectId?: string; navigation?: 'ui' | 'history' }

export function parseProjectRoute(path: string): ProjectRoute {
  const match = /^\/projects\/([^/]+)\/(space|keep|references|placement|camera|review|results)\/?$/.exec(path)
  if (!match) return { step: 'projects' }
  try { return { projectId: decodeURIComponent(match[1]), step: match[2] as Step } }
  catch { return { step: 'projects' } }
}

export function projectPath(route: ProjectRoute): string {
  return route.step === 'projects' || !route.projectId ? '/' : `/projects/${encodeURIComponent(route.projectId)}/${route.step}`
}

export function useProjectRoute() {
  const [route, setRoute] = useState(() => parseProjectRoute(window.location.pathname))
  useEffect(() => {
    const restore = () => setRoute({ ...parseProjectRoute(window.location.pathname), navigation: 'history' })
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  const navigate = useCallback((next: ProjectRoute, replace = false) => {
    const path = projectPath(next)
    if (window.location.pathname !== path) {
      window.history[replace ? 'replaceState' : 'pushState'](null, '', path)
      setRoute({ ...next, navigation: 'ui' })
    }
  }, [])
  return [route, navigate] as const
}
