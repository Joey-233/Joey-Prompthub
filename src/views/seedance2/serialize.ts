import type { Seedance2TemplateData } from '../../shared/types'

/**
 * 把模板数据按你贴的那种 Markdown 结构拼成纯文本，可直接复制到 Seedance2。
 */
export function serializeTemplate(data: Seedance2TemplateData): string {
  const lines: string[] = []

  if (data.intro.trim()) {
    lines.push(data.intro.trim())
    lines.push('')
  }

  for (const group of data.refGroups) {
    if (!group.title.trim() && !group.description.trim() && group.items.length === 0) continue
    lines.push(`【${group.title.trim() || '参考'}】`)
    if (group.description.trim()) lines.push(group.description.trim())
    for (const item of group.items) {
      const ref = `${item.emoji}${item.label}`.trim()
      if (item.note.trim()) {
        lines.push(`${ref} ${item.note.trim()}`)
      } else if (ref) {
        lines.push(ref)
      }
    }
    lines.push('')
  }

  lines.push('【镜头序列（一镜到底）】')
  lines.push('')
  data.segments.forEach((seg, idx) => {
    const header = seg.shotType.trim() ? `【${seg.shotType.trim()}】` : ''
    const time = seg.timeLabel.trim() ? `**${seg.timeLabel.trim()}**` : `${idx + 1}.`
    const body = seg.description.trim()
    lines.push(`${time}${header} ${body}`.trim())
    if (seg.dialog.trim()) {
      seg.dialog
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((l) => lines.push(l))
    }
    lines.push('')
  })

  if (data.segmentsFooter.trim()) {
    lines.push(data.segmentsFooter.trim())
    lines.push('')
  }

  if (data.style.trim()) {
    lines.push('【风格】')
    lines.push(data.style.trim())
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

export function emptyTemplate(): Seedance2TemplateData {
  return {
    intro:
      '15秒第一人称剧情动画，非真人，无人物唱歌，无BGM，全程一镜到底，无转场，轻微绿色昏暗色调，紧张氛围感，无过度霓虹，画面干净清爽',
    refGroups: [
      { title: '主角视角参考', description: '', items: [{ emoji: '🖐', label: '图片1', note: '第一人称游戏视角' }] },
      { title: '场景参考', description: '', items: [{ emoji: '🏛', label: '图片2', note: '主场景描述' }] },
      { title: '角色参考', description: '', items: [] }
    ],
    segments: [
      {
        id: crypto.randomUUID(),
        timeLabel: '0-5s',
        shotType: '第一视角',
        description: '画面一开始……',
        dialog: ''
      }
    ],
    segmentsFooter:
      '（全程模拟第一人称游戏感，运动流畅，模拟游戏实时CG流畅运动，模拟游戏动效，自由导演表演和调度，允许微调）',
    style:
      '《双城之战》3D绘画渲染，笔触纹理化明暗，通透体积雾，画面干净清爽，无多余噪点，ultra realistic lighting, cinematic composition, 3D painterly rendering style inspired by Arcane, stylized brush-textured shading, volumetric fog, dramatic rim lighting，动态流畅，速度感与氛围感拉满'
  }
}

export function emptySegment() {
  return {
    id: crypto.randomUUID(),
    timeLabel: '',
    shotType: '',
    description: '',
    dialog: ''
  }
}
