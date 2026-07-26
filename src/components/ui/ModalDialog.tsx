import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'

interface ModalDialogProps {
  children: ReactNode
  titleId?: string
  descriptionId?: string
  onClose: () => void
  closeDisabled?: boolean
  backdropClassName?: string
  panelClassName?: string
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

export function ModalDialog({
  children,
  titleId,
  descriptionId,
  onClose,
  closeDisabled = false,
  backdropClassName = 'dialog-backdrop',
  panelClassName = 'dialog-panel'
}: ModalDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const closeDisabledRef = useRef(closeDisabled)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    closeDisabledRef.current = closeDisabled
  }, [closeDisabled])

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const focusable = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
        (element) =>
          !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
      )
    const preferred = panel?.querySelector<HTMLElement>('[data-autofocus="true"]')
    ;(preferred ?? focusable()[0] ?? panel)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!closeDisabledRef.current) {
          event.preventDefault()
          closeRef.current()
        }
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) {
        event.preventDefault()
        panel?.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (!panel?.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !closeDisabled) onClose()
  }

  return (
    <div className={backdropClassName} onMouseDown={handleBackdropMouseDown}>
      <div
        ref={panelRef}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={panelClassName}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  )
}
