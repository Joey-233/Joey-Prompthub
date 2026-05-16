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
  }, dependencies)
}
