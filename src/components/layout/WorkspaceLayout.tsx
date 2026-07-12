import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

import { useAppStore } from '../../stores/appStore'

type Pane = 'resource' | 'detail'
type Breakpoint = 'desktop' | 'tablet' | 'mobile'

export interface WorkspaceLayoutProps {
  resource?: ReactNode
  resourceLabel?: string
  main: ReactNode
  detail?: ReactNode
  detailLabel?: string
}

function getBreakpoint(): Breakpoint {
  if (typeof window.matchMedia !== 'function') return 'desktop'
  if (window.matchMedia('(min-width: 1320px)').matches) return 'desktop'
  if (window.matchMedia('(min-width: 1024px)').matches) return 'tablet'
  return 'mobile'
}

function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(getBreakpoint)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const desktop = window.matchMedia('(min-width: 1320px)')
    const tablet = window.matchMedia('(min-width: 1024px)')
    const update = () => setBreakpoint(desktop.matches ? 'desktop' : tablet.matches ? 'tablet' : 'mobile')
    desktop.addEventListener('change', update)
    tablet.addEventListener('change', update)
    return () => {
      desktop.removeEventListener('change', update)
      tablet.removeEventListener('change', update)
    }
  }, [])
  return breakpoint
}

export function WorkspaceLayout({ resource, resourceLabel = '资源', main, detail, detailLabel = '详情' }: WorkspaceLayoutProps) {
  const breakpoint = useBreakpoint()
  const layout = useAppStore((state) => state.layout)
  const setPaneWidth = useAppStore((state) => state.setPaneWidth)
  const setPaneCollapsed = useAppStore((state) => state.setPaneCollapsed)
  const [drawer, setDrawer] = useState<Pane | null>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const resourceTrigger = useRef<HTMLButtonElement>(null)
  const detailTrigger = useRef<HTMLButtonElement>(null)
  const pendingFocus = useRef<HTMLElement | null>(null)
  const stopResize = useRef<(() => void) | null>(null)

  const closeDrawer = () => {
    pendingFocus.current = (drawer === 'resource' ? resourceTrigger : detailTrigger).current
    setDrawer(null)
  }

  useEffect(() => {
    if (drawer || !pendingFocus.current) return
    const trigger = pendingFocus.current
    pendingFocus.current = null
    if (trigger.isConnected) trigger.focus()
  }, [drawer])

  useEffect(() => {
    if (!drawer) return
    const panel = drawerRef.current
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((element) => !element.hasAttribute('disabled'))
    focusable()[0]?.focus()
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDrawer()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (items.length === 1 || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawer])

  useEffect(() => {
    stopResize.current?.()
    if (!drawer) return
    pendingFocus.current = (drawer === 'resource' ? resourceTrigger : detailTrigger).current
    setDrawer(null)
  }, [breakpoint])

  useEffect(() => () => stopResize.current?.(), [])

  const startResize = (pane: Pane) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    stopResize.current?.()
    const startX = event.clientX
    const pointerId = event.pointerId
    const source = event.currentTarget
    const startWidth = pane === 'resource' ? layout.resourceWidth : layout.detailWidth
    const direction = pane === 'resource' ? 1 : -1
    const previousUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      setPaneWidth(pane, startWidth + direction * (moveEvent.clientX - startX))
    }
    let finish: (finishEvent: PointerEvent) => void
    let lostCapture: () => void
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      source.removeEventListener('lostpointercapture', lostCapture)
      document.body.style.userSelect = previousUserSelect
      stopResize.current = null
      try {
        if (source.releasePointerCapture && (!source.hasPointerCapture || source.hasPointerCapture(pointerId))) source.releasePointerCapture(pointerId)
      } catch { /* capture may already have been released by the browser */ }
    }
    finish = (finishEvent: PointerEvent) => {
      if (finishEvent.pointerId === pointerId) cleanup()
    }
    lostCapture = cleanup
    stopResize.current = cleanup
    try { source.setPointerCapture?.(pointerId) } catch { /* pointer capture is optional */ }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    source.addEventListener('lostpointercapture', lostCapture)
  }

  const separatorKey = (pane: Pane) => (event: KeyboardEvent<HTMLDivElement>) => {
    const value = pane === 'resource' ? layout.resourceWidth : layout.detailWidth
    const min = pane === 'resource' ? 180 : 280
    const max = pane === 'resource' ? 320 : 480
    if (event.key === 'ArrowLeft') setPaneWidth(pane, value - 8)
    else if (event.key === 'ArrowRight') setPaneWidth(pane, value + 8)
    else if (event.key === 'Home') setPaneWidth(pane, min)
    else if (event.key === 'End') setPaneWidth(pane, max)
    else return
    event.preventDefault()
  }

  const separator = (pane: Pane) => {
    const resourcePane = pane === 'resource'
    const value = resourcePane ? layout.resourceWidth : layout.detailWidth
    return <div className="pane-separator" role="separator" tabIndex={0} aria-orientation="vertical" aria-label={`调整${resourcePane ? resourceLabel : detailLabel}面板宽度`} aria-valuemin={resourcePane ? 180 : 280} aria-valuemax={resourcePane ? 320 : 480} aria-valuenow={value} onKeyDown={separatorKey(pane)} onPointerDown={startResize(pane)} onDoubleClick={() => setPaneWidth(pane, resourcePane ? 220 : 320)} />
  }

  const inlineResource = breakpoint !== 'mobile' && resource && !layout.resourceCollapsed
  const inlineDetail = breakpoint === 'desktop' && detail && !layout.detailCollapsed
  const drawerContent = drawer === 'resource' ? resource : detail
  const drawerLabel = drawer === 'resource' ? resourceLabel : detailLabel

  return (
    <div className="workspace-layout" style={{ '--resource-width': `${layout.resourceWidth}px`, '--detail-width': `${layout.detailWidth}px` } as CSSProperties}>
      <div className="workspace-tools">
        {resource && (breakpoint === 'mobile' ? <button ref={resourceTrigger} type="button" onClick={() => setDrawer('resource')}>打开资源面板</button> : <button type="button" onClick={() => setPaneCollapsed('resource', !layout.resourceCollapsed)}>{layout.resourceCollapsed ? '展开资源面板' : '收起资源面板'}</button>)}
        {detail && (breakpoint === 'desktop' ? <button type="button" onClick={() => setPaneCollapsed('detail', !layout.detailCollapsed)}>{layout.detailCollapsed ? '展开详情面板' : '收起详情面板'}</button> : <button ref={detailTrigger} type="button" onClick={() => setDrawer('detail')}>打开详情面板</button>)}
      </div>
      <div className="workspace-panes">
        {inlineResource && <><aside className="workspace-pane resource-pane" role="region" aria-label={resourceLabel} style={{ minWidth: 180, flexShrink: 1 }}>{resource}</aside>{separator('resource')}</>}
        <section className="workspace-main" style={{ minWidth: 480 }}>{main}</section>
        {inlineDetail && <>{separator('detail')}<aside className="workspace-pane detail-pane" role="region" aria-label={detailLabel} style={{ minWidth: 280, flexShrink: 1 }}>{detail}</aside></>}
      </div>
      {drawer && drawerContent && <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer() }}><aside ref={drawerRef} className="workspace-drawer" role="dialog" aria-modal="true" aria-label={drawerLabel}><button type="button" onClick={closeDrawer}>关闭{drawerLabel}面板</button>{drawerContent}</aside></div>}
    </div>
  )
}
