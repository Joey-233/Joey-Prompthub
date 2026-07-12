import { describe, expect, it } from 'vitest'

import { normalizeTemplateData, serializeTemplate } from './serialize'

describe('Seedance2 template serialization', () => {
  it('converts legacy data to the four default titled sections', () => {
    const data = normalizeTemplateData({
      intro: 'opening',
      refGroups: [],
      segments: [],
      segmentsFooter: '',
      style: 'look'
    })

    expect(data.sections).toMatchObject([
      { title: '开篇总述', kind: 'text', content: 'opening' },
      { title: '参考资料', kind: 'references' },
      { title: '镜头序列', kind: 'shots' },
      { title: '风格', kind: 'text', content: 'look' }
    ])
  })

  it('serializes each non-empty section with a square-bracket title', () => {
    expect(serializeTemplate({
      sections: [
        { id: 'intro', title: '开篇总述', kind: 'text', content: 'opening' },
        { id: 'role', title: '角色设定', kind: 'text', content: 'hero' }
      ]
    })).toBe('[开篇总述]\nopening\n\n[角色设定]\nhero\n')
  })

  it('wraps reference and shot content in their customized titles', () => {
    const output = serializeTemplate({
      sections: [
        {
          id: 'references',
          title: '美术参考',
          kind: 'references',
          refGroups: [{ title: '角色', description: '', items: [{ emoji: '🖼️', label: '图片1', note: '主角' }] }]
        },
        {
          id: 'shots',
          title: '叙事节奏',
          kind: 'shots',
          segments: [{ id: 'shot-1', timeLabel: '0-3s', shotType: '', description: '推镜', dialog: '' }],
          footer: ''
        }
      ]
    })

    expect(output).toContain('[美术参考]')
    expect(output).toContain('[叙事节奏]')
  })
})
