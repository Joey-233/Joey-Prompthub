import { describe, expect, it } from 'vitest'

import { createBuiltInSeedance2Template } from '../../shared/seedance2Default'
import { emptyTemplate, normalizeTemplateData, serializeTemplate } from './serialize'

describe('Seedance2 template serialization', () => {
  it('uses the seven-section 默认模板1 as every new draft', () => {
    const data = emptyTemplate()

    expect(data).toEqual(createBuiltInSeedance2Template())
    expect(data.sections.map((section) => section.title)).toEqual([
      '风格设定',
      '角色与素材锚定',
      '运镜设定',
      '画面描述',
      '镜头序列',
      '音效设定',
      '特殊要求'
    ])
    expect(data.sections[1]).toMatchObject({
      kind: 'text',
      content:
        '将@###作为主角的视觉参考\n将@###作为场景的视觉参考\n将@###作为道具的视觉参考\n将@###作为主角的音色参考'
    })
    expect(data.sections[4]).not.toHaveProperty('footer')
  })

  it('converts legacy data to the four default titled sections', () => {
    const data = normalizeTemplateData({
      intro: 'opening',
      refGroups: [],
      segments: [],
      segmentsFooter: '旧版镜头序列底部说明',
      style: 'look'
    })

    expect(data.sections).toMatchObject([
      { title: '开篇总述', kind: 'text', content: 'opening' },
      { title: '参考资料', kind: 'text', content: '' },
      { title: '镜头序列', kind: 'shots' },
      { title: '风格', kind: 'text', content: 'look' }
    ])
    expect(data.sections[2]).not.toHaveProperty('footer')
    expect(serializeTemplate(data)).not.toContain('旧版镜头序列底部说明')
  })

  it('converts structured reference nodes to normal text without losing their content', () => {
    const data = normalizeTemplateData({
      sections: [
        {
          id: 'references',
          title: '参考资料',
          kind: 'references',
          refGroups: [
            {
              title: '角色参考',
              description: '保持人物一致',
              items: [{ emoji: '🖼️', label: '图片1', note: '主角正面' }]
            }
          ]
        }
      ]
    })

    expect(data.sections).toEqual([
      {
        id: 'references',
        title: '参考资料',
        kind: 'text',
        content: '【角色参考】\n保持人物一致\n🖼️图片1 主角正面'
      }
    ])
  })

  it('serializes each non-empty section with a square-bracket title', () => {
    expect(
      serializeTemplate({
        sections: [
          { id: 'intro', title: '开篇总述', kind: 'text', content: 'opening' },
          { id: 'role', title: '角色设定', kind: 'text', content: 'hero' }
        ]
      })
    ).toBe('[开篇总述]\nopening\n\n[角色设定]\nhero\n')
  })

  it('wraps reference and shot content in their customized titles', () => {
    const output = serializeTemplate({
      sections: [
        {
          id: 'references',
          title: '美术参考',
          kind: 'references',
          refGroups: [
            {
              title: '角色',
              description: '',
              items: [{ emoji: '🖼️', label: '图片1', note: '主角' }]
            }
          ]
        },
        {
          id: 'shots',
          title: '叙事节奏',
          kind: 'shots',
          segments: [
            { id: 'shot-1', timeLabel: '0-3s', shotType: '', description: '推镜', dialog: '' }
          ]
        }
      ]
    })

    expect(output).toContain('[美术参考]')
    expect(output).toContain('[叙事节奏]')
  })
})
