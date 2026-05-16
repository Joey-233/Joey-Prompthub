import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'

import type { FloatingWindowState } from '../shared/types'

const DRAG_THRESHOLD = 6

const defaultFloatingState: FloatingWindowState = {
  x: 0,
  y: 0,
  side: 'right',
  expanded: false
}

type DragRef = {
  active: boolean
  moved: boolean
  pointerId: number | null
  startScreenX: number
  startScreenY: number
}

const initialDrag: DragRef = {
  active: false,
  moved: false,
  pointerId: null,
  startScreenX: 0,
  startScreenY: 0
}

export function FloatingBallApp() {
  const [floatingState, setFloatingState] = useState<FloatingWindowState>(defaultFloatingState)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<DragRef>({ ...initialDrag })
  const captureRef = useRef<{ element: HTMLButtonElement; pointerId: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.promptHub.system.getFloatingState().then((state) => {
      if (!cancelled) {
        setFloatingState({ ...state, expanded: false })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  function releasePointerCapture() {
    const capture = captureRef.current
    captureRef.current = null

    if (
      capture &&
      typeof capture.element.hasPointerCapture === 'function' &&
      typeof capture.element.releasePointerCapture === 'function' &&
      capture.element.hasPointerCapture(capture.pointerId)
    ) {
      capture.element.releasePointerCapture(capture.pointerId)
    }
  }

  function openMainWindow() {
    void window.promptHub.system.openMainWindow()
  }

  function openFloatingContextMenu() {
    void window.promptHub.system.showFloatingContextMenu()
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    dragRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY
    }

    captureRef.current = { element: event.currentTarget, pointerId: event.pointerId }
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // safari/firefox occasionally throw if the pointer is already captured
      }
    }

    void window.promptHub.system
      .floatingDragStart({ cursorScreenX: event.screenX, cursorScreenY: event.screenY })
      .then((state) => {
        setFloatingState({ ...state, expanded: false })
      })
  }

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag.active || drag.pointerId !== event.pointerId) {
        return
      }
      if (drag.moved) {
        return
      }

      const distance =
        Math.abs(event.screenX - drag.startScreenX) +
        Math.abs(event.screenY - drag.startScreenY)

      if (distance >= DRAG_THRESHOLD) {
        drag.moved = true
        setIsDragging(true)
      }
    }

    function finishDrag(snap: boolean, options: { wasClick: boolean }) {
      const drag = dragRef.current
      if (!drag.active) {
        return
      }
      dragRef.current = { ...initialDrag }
      setIsDragging(false)
      releasePointerCapture()

      void window.promptHub.system.floatingDragEnd(snap).then((state) => {
        setFloatingState({ ...state, expanded: false })
      })

      if (options.wasClick) {
        openMainWindow()
      }
    }

    function onPointerUp(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag.active || drag.pointerId !== event.pointerId) {
        return
      }
      finishDrag(drag.moved, { wasClick: !drag.moved })
    }

    function onPointerCancel(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag.active || drag.pointerId !== event.pointerId) {
        return
      }
      finishDrag(true, { wasClick: false })
    }

    function onWindowBlur() {
      if (!dragRef.current.active) {
        return
      }
      finishDrag(true, { wasClick: false })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [])

  function handleContextMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    openFloatingContextMenu()
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openMainWindow()
      return
    }
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault()
      openFloatingContextMenu()
    }
  }

  return (
    <main className="floating-root">
      <button
        aria-label="打开菜单"
        className="floating-ball-button"
        data-dragging={isDragging}
        data-side={floatingState.side}
        type="button"
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        <span className="floating-ball-brand">prompt</span>
      </button>
    </main>
  )
}
