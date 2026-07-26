import type {
  Seedance2LegacyTemplateData,
  Seedance2RefGroup,
  Seedance2TemplateData,
  Seedance2TemplateSection
} from '../../shared/types'
import { createBuiltInSeedance2Template } from '../../shared/seedance2Default'

export function serializeReferenceGroups(refGroups: Seedance2RefGroup[]): string {
  const lines: string[] = []
  for (const group of refGroups) {
    if (!group.title.trim() && !group.description.trim() && group.items.length === 0) continue
    lines.push(`【${group.title.trim() || '参考'}】`)
    if (group.description.trim()) lines.push(group.description.trim())
    for (const item of group.items) {
      const ref = `${item.emoji}${item.label}`.trim()
      if (item.note.trim()) lines.push(`${ref} ${item.note.trim()}`)
      else if (ref) lines.push(ref)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

function normalizeSections(sections: Seedance2TemplateSection[]): Seedance2TemplateSection[] {
  return sections.map((section) =>
    section.kind === 'references'
      ? {
          id: section.id,
          title: section.title,
          kind: 'text',
          content: serializeReferenceGroups(section.refGroups)
        }
      : section.kind === 'shots'
        ? {
            id: section.id,
            title: section.title,
            kind: 'shots',
            segments: section.segments
          }
        : section
  )
}

export function normalizeTemplateData(
  data: Seedance2TemplateData | Seedance2LegacyTemplateData
): Seedance2TemplateData {
  if ('sections' in data) return { sections: normalizeSections(data.sections) }

  return {
    sections: [
      { id: 'intro', title: '开篇总述', kind: 'text', content: data.intro },
      {
        id: 'references',
        title: '参考资料',
        kind: 'text',
        content: serializeReferenceGroups(data.refGroups)
      },
      {
        id: 'shots',
        title: '镜头序列',
        kind: 'shots',
        segments: data.segments
      },
      { id: 'style', title: '风格', kind: 'text', content: data.style }
    ]
  }
}

function serializeReferences(
  section: Extract<Seedance2TemplateSection, { kind: 'references' }>
): string {
  return serializeReferenceGroups(section.refGroups)
}

function serializeShots(section: Extract<Seedance2TemplateSection, { kind: 'shots' }>): string {
  if (section.segments.length === 0) return ''

  const lines = ['【镜头序列（一镜到底）】', '']
  section.segments.forEach((segment, index) => {
    const shotType = segment.shotType.trim() ? `【${segment.shotType.trim()}】` : ''
    const time = segment.timeLabel.trim() ? `**${segment.timeLabel.trim()}**` : `${index + 1}.`
    lines.push(`${time}${shotType} ${segment.description.trim()}`.trim())
    if (segment.dialog.trim()) {
      segment.dialog
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => lines.push(line))
    }
    lines.push('')
  })
  return lines.join('\n').trim()
}

function serializeSection(section: Seedance2TemplateSection): string {
  const content =
    section.kind === 'text'
      ? section.content.trim()
      : section.kind === 'references'
        ? serializeReferences(section)
        : serializeShots(section)
  if (!content) return ''
  return `[${section.title.trim() || '未命名类目'}]\n${content}`
}

export function serializeTemplate(data: Seedance2TemplateData): string {
  const output = data.sections.map(serializeSection).filter(Boolean).join('\n\n')
  return output ? `${output}\n` : ''
}

export function emptyTemplate(): Seedance2TemplateData {
  return createBuiltInSeedance2Template()
}

export function emptySegment() {
  return { id: crypto.randomUUID(), timeLabel: '', shotType: '', description: '', dialog: '' }
}
