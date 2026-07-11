import type { ReactNode, Ref } from 'react'

interface Props {
  id: string
  title: string
  expanded: boolean
  sectionRef: Ref<HTMLElement>
  onToggle: () => void
  children: ReactNode
}

export function SeedanceSection({ id, title, expanded, sectionRef, onToggle, children }: Props) {
  return <section ref={sectionRef} className="s2-accordion">
    <h2><button type="button" aria-expanded={expanded} aria-controls={`seedance-section-${id}`} onClick={onToggle}>{title}</button></h2>
    <div id={`seedance-section-${id}`} hidden={!expanded}>{children}</div>
  </section>
}
