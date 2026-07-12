import type {
  Seedance2LegacyTemplateData,
  Seedance2TemplateData,
  Seedance2TemplateSection
} from '../../shared/types'

export function normalizeTemplateData(
  data: Seedance2TemplateData | Seedance2LegacyTemplateData
): Seedance2TemplateData {
  if ('sections' in data) return data

  return {
    sections: [
      { id: 'intro', title: '开篇总述', kind: 'text', content: data.intro },
      { id: 'references', title: '参考资料', kind: 'references', refGroups: data.refGroups },
      { id: 'shots', title: '镜头序列', kind: 'shots', segments: data.segments, footer: data.segmentsFooter },
      { id: 'style', title: '风格', kind: 'text', content: data.style }
    ]
  }
}

function serializeReferences(section: Extract<Seedance2TemplateSection, { kind: 'references' }>): string {
  const lines: string[] = []
  for (const group of section.refGroups) {
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

function serializeShots(section: Extract<Seedance2TemplateSection, { kind: 'shots' }>): string {
  if (section.segments.length === 0 && !section.footer.trim()) return ''

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
  if (section.footer.trim()) lines.push(section.footer.trim())
  return lines.join('\n').trim()
}

function serializeSection(section: Seedance2TemplateSection): string {
  const content = section.kind === 'text'
    ? section.content.trim()
    : section.kind === 'references'
      ? serializeReferences(section)
      : serializeShots(section)
  if (!content) return ''
  return `[${section.title.trim() || '未命名类目'}]\n${content}`
}

export function serializeTemplate(data: Seedance2TemplateData): string {
  const output = data.sections
    .map(serializeSection)
    .filter(Boolean)
    .join('\n\n')
  return output ? `${output}\n` : ''
}

export function emptyTemplate(): Seedance2TemplateData {
  return {
    sections: [
      {
        id: 'intro',
        title: '开篇总述',
        kind: 'text',
        content: '15秒第一人称剧情动画，非真人，无人物唱歌，无BGM，全程一镜到底，无转场，轻微绿色昏暗色调，紧张氛围感，无过度霓虹，画面干净清爽'
      },
      {
        id: 'references',
        title: '参考资料',
        kind: 'references',
        refGroups: [
          { title: '主角视角参考', description: '', items: [{ emoji: '🖐', label: '图片1', note: '第一人称游戏视角' }] },
          { title: '场景参考', description: '', items: [{ emoji: '🏛', label: '图片2', note: '主场景描述' }] },
          { title: '角色参考', description: '', items: [] }
        ]
      },
      {
        id: 'shots',
        title: '镜头序列',
        kind: 'shots',
        segments: [{ id: crypto.randomUUID(), timeLabel: '0-5s', shotType: '第一视角', description: '画面一开始……', dialog: '' }],
        footer: '（全程模拟第一人称游戏感，运动流畅，模拟游戏实时CG流畅运动，模拟游戏动效，自由导演表演和调度，允许微调）'
      },
      {
        id: 'style',
        title: '风格',
        kind: 'text',
        content: '《双城之战》3D绘画渲染，笔触纹理化明暗，通透体积雾，画面干净清爽，无多余噪点，ultra realistic lighting, cinematic composition, 3D painterly rendering style inspired by Arcane, stylized brush-textured shading, volumetric fog, dramatic rim lighting，动态流畅，速度感与氛围感拉满'
      }
    ]
  }
}

export function emptySegment() {
  return { id: crypto.randomUUID(), timeLabel: '', shotType: '', description: '', dialog: '' }
}
