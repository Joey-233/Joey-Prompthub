export interface ReleasePromptSeed {
  id: string
  title: string
  content: string
  tags: string[]
  isFavorite: boolean
}

/**
 * Initial prompt library for a brand-new installation.
 * Existing databases are never overwritten or backfilled from this list.
 */
export const RELEASE_PROMPT_SEEDS: ReleasePromptSeed[] = [
  {
    id: 'release-prompt-004',
    title: '双城之战人物风格设定',
    content:
      '根据 {{Portrait 1}} 的人物，补充全身的正视图、侧视图、背视图，以及正脸中景人像肖像照，人物外貌、服装穿搭等内容保持不变，纯白色背景，保持人物的【风格】不变：整体为《双城之战》风格的3D绘画渲染，笔触纹理化明暗，通透体积雾，画面干净清爽，无多余噪点 ultra realistic lighting, cinematic composition, 3D painterly rendering style inspired by Arcane, stylized brush-textured shading, volumetlic fog, dramatic rim.',
    tags: [],
    isFavorite: false
  },
  {
    id: 'release-prompt-003',
    title: '徐克风格',
    content:
      '全景，大特写俯视角弹琵琶的手，徐克 2001 年香港玄幻仙侠电影美学，35mm 柯达胶片原生颗粒感，高光处柔和弥散光晕，暗部保留细腻胶片底色，复古电影质感。大幅度跟拍跟踪运镜，低角度广角透视强化动作动能，行云流水的航拍穿梭于悬浮群峰，快慢交织的镜头节奏。戏剧性体积光束穿透浓密云海雾霭，丁达尔效应弥漫，表现主义打光服务叙事而非写实，侧逆光勾勒人物神圣轮廓，魔道场景底光顶光营造扭曲恐怖。衣袍在超自然狂风中极端飘动，运动碎片悬浮半空，实体烟雾与风机效果。黑泽明式高对比度阵营色彩编码（金青红正道 vs 黑红紫魔道），哥特浪漫主义的破碎凄美，融合中国戏曲舞台对称与失衡调度。极速剪辑营造芭蕾般优雅凌厉的动作强度，水墨写意与工业朋克共生，太空仙侠宇宙感，孤绝清冷与浩然正气交织的东方魔幻史诗。 --ar 2:3 --raw --profile xcpp7td 8ca28y8 --hd',
    tags: [],
    isFavorite: false
  },
  {
    id: 'release-prompt-002',
    title: '人物脸+三视图',
    content:
      '参考画面生成主角的形象，生成正视角的面部特征以及全身三视图，最左侧占满三分之一的位置是超大面部特写，右侧三分之二放三视图(正视图，侧视图，背视图)，纯白色的背景，衣服和身体稍微有写实感，保持人脸风格不变',
    tags: [],
    isFavorite: false
  },
  {
    id: 'release-prompt-001',
    title: '基于此角色和背景，请制作一份类似官方设定',
    content:
      '基于此角色和背景，请制作一份类似官方设定资料的横版角色设定图。・画面中心为三视图：正面、侧面和背面・标尺线标注人物身高170cm・添加喜怒哀乐四种不同的角色面部表情的变化・完全一比一分解并展示服装和装备的详细部分，要求细节完全一样・添加色板・・总体上，使用有组织的布局（白色背景，插画风格）图片比例为横屏16:9，',
    tags: ['GPT'],
    isFavorite: false
  }
]
