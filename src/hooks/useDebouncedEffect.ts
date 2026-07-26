import { DependencyList, useEffect, useRef } from 'react'

export function useDebouncedEffect(
  effect: () => void | (() => void),
  delay: number,
  dependencies: DependencyList
) {
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }

    const timeoutId = window.setTimeout(() => {
      effect()
    }, delay)

    return () => {
      window.clearTimeout(timeoutId)
    }
    // The caller owns this hook's dependency list, mirroring React's built-in effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}
