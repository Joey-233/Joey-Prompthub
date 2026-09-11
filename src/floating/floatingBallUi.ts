import type { FloatingWindowState, PromptHubFloatingApi } from '../shared/types'

const DRAG_THRESHOLD = 6

export function mountFloatingBall(root: HTMLElement, api: PromptHubFloatingApi) {
  root.innerHTML = `
    <main class="floating-root">
      <button aria-label="打开 Joey Prompthub 主面板（右键打开快捷菜单）" class="floating-ball-button" data-dragging="false" data-side="right" type="button">
        <span class="floating-ball-brand">prompt</span>
      </button>
    </main>
  `
  const button = root.querySelector<HTMLButtonElement>('.floating-ball-button')
  if (!button) throw new Error('浮球按钮初始化失败')

  let drag = { active: false, moved: false, pointerId: -1, startX: 0, startY: 0 }

  const applyState = (state: FloatingWindowState) => {
    button.dataset.side = state.side
  }
  const ignoreFailure = () => undefined
  void api.getState().then(applyState).catch(ignoreFailure)

  const finishDrag = (snap: boolean, wasClick: boolean) => {
    if (!drag.active) return
    const pointerId = drag.pointerId
    drag = { active: false, moved: false, pointerId: -1, startX: 0, startY: 0 }
    button.dataset.dragging = 'false'
    try {
      if (button.hasPointerCapture?.(pointerId)) button.releasePointerCapture?.(pointerId)
    } catch {
      // Pointer capture is best-effort across Electron/Windows versions.
    }
    void api.dragEnd(snap).then(applyState).catch(ignoreFailure)
    // 单击 = 直接打开主面板；快捷菜单在右键 / 键盘菜单键里。无需延时区分双击。
    if (wasClick) void api.openMainWindow().catch(ignoreFailure)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    drag = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      startX: event.screenX,
      startY: event.screenY
    }
    try {
      button.setPointerCapture?.(event.pointerId)
    } catch {
      // Pointer capture may already belong to another target.
    }
    void api
      .dragStart({ cursorScreenX: event.screenX, cursorScreenY: event.screenY })
      .then(applyState)
      .catch(ignoreFailure)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!drag.active || drag.pointerId !== event.pointerId || drag.moved) return
    if (
      Math.abs(event.screenX - drag.startX) + Math.abs(event.screenY - drag.startY) >=
      DRAG_THRESHOLD
    ) {
      drag.moved = true
      button.dataset.dragging = 'true'
    }
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!drag.active || drag.pointerId !== event.pointerId) return
    finishDrag(drag.moved, !drag.moved)
  }

  const onPointerCancel = (event: PointerEvent) => {
    if (drag.active && drag.pointerId === event.pointerId) finishDrag(true, false)
  }

  const onBlur = () => finishDrag(true, false)
  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    void api.showContextMenu().catch(ignoreFailure)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      // 按钮语义：回车 / 空格 = 打开主面板
      event.preventDefault()
      void api.openMainWindow().catch(ignoreFailure)
    } else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault()
      void api.showContextMenu().catch(ignoreFailure)
    }
  }

  button.addEventListener('pointerdown', onPointerDown)
  button.addEventListener('contextmenu', onContextMenu)
  button.addEventListener('keydown', onKeyDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  window.addEventListener('blur', onBlur)

  return () => {
    button.removeEventListener('pointerdown', onPointerDown)
    button.removeEventListener('contextmenu', onContextMenu)
    button.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerCancel)
    window.removeEventListener('blur', onBlur)
  }
}
