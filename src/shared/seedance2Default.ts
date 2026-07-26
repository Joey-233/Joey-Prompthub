import type { Seedance2TemplateData } from './types'

export const SEEDANCE2_DEFAULT_TEMPLATE_SETTING_KEY = 'seedance2_default_template_id'
export const BUILT_IN_SEEDANCE2_TEMPLATE_ID = 'builtin-default-template-1'
export const BUILT_IN_SEEDANCE2_TEMPLATE_TITLE = '默认模板1'

export function createBuiltInSeedance2Template(): Seedance2TemplateData {
  return {
    sections: [
      {
        id: 'intro',
        title: '风格设定',
        kind: 'text',
        content:
          '15秒第一人称剧情动画，非真人，无人物唱歌，无BGM，全程一镜到底，无转场，轻微绿色昏暗色调，紧张氛围感，无过度霓虹，画面干净清爽\n《双城之战》3D绘画渲染，笔触纹理化明暗，通透体积雾，画面干净清爽，无多余噪点，ultra realistic lighting, cinematic composition, 3D painterly rendering style inspired by Arcane, stylized brush-textured shading, volumetric fog, dramatic rim lighting，动态流畅，速度感与氛围感拉满'
      },
      {
        id: 'references',
        title: '角色与素材锚定',
        kind: 'text',
        content:
          '将@###作为主角的视觉参考\n将@###作为场景的视觉参考\n将@###作为道具的视觉参考\n将@###作为主角的音色参考'
      },
      {
        id: 'movement',
        title: '运镜设定',
        kind: 'text',
        content:
          '全程模拟第一人称游戏感，运动流畅，模拟游戏实时CG流畅运动，模拟游戏动效，自由导演表演和调度，允许微调'
      },
      {
        id: 'visual',
        title: '画面描述',
        kind: 'text',
        content: ''
      },
      {
        id: 'shots',
        title: '镜头序列',
        kind: 'shots',
        segments: [
          {
            id: 'default-shot-1',
            timeLabel: '0-5s',
            shotType: '',
            description: '画面一开始……',
            dialog: ''
          }
        ]
      },
      {
        id: 'audio',
        title: '音效设定',
        kind: 'text',
        content: '仅白噪音质感的环境音与动作音，不配任何旋律性背景音乐。'
      },
      {
        id: 'style',
        title: '特殊要求',
        kind: 'text',
        content: '画面中不出现任何文字、英文、签名、手写字、水印、logo。'
      }
    ]
  }
}
