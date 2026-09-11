import type { Seedance2TemplateData } from '../../shared/types'
import { normalizeTemplateData } from './serialize'

/**
 * 主窗口关闭 = 渲染进程被销毁（electron/main.ts）。Library 的编辑草稿由
 * `__prompthubBeforeClose` 强制落库，而 Seedance2 的编辑态只存在于组件内存，
 * 所以组件持续把「脏会话」镜像到 localStorage（随分区落盘，窗口销毁不丢），
 * 重开窗口时恢复，保持与旧版「关窗只是隐藏」一致的体验。
 */

const SESSION_KEY = 'prompthub.seedance2.session.v1'

export interface Seedance2SessionState {
  currentId: string | null
  title: string
  draft: Seedance2TemplateData
  activeSectionId: string | null
}

export function saveSeedance2Session(state: Seedance2SessionState) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state))
  } catch {
    // localStorage 不可用（配额/隐私模式）时放弃持久化，只损失关窗后的编辑恢复
  }
}

export function clearSeedance2Session() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * 纯读取（不清除键位）：结构不合法或字段缺失时返回 null，
 * 避免跨版本 schema 漂移导致 Seedance2 无法进入初始加载流程。
 * 是否清除由组件在恢复判定后通过 clearSeedance2Session/saveSeedance2Session 决定。
 */
export function readSeedance2Session(): Seedance2SessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Seedance2SessionState> | null
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.title !== 'string' ||
      !parsed.draft ||
      !Array.isArray(parsed.draft.sections) ||
      (parsed.currentId !== null && typeof parsed.currentId !== 'string') ||
      (parsed.activeSectionId !== null && typeof parsed.activeSectionId !== 'string')
    ) {
      return null
    }
    return {
      currentId: parsed.currentId,
      title: parsed.title,
      draft: normalizeTemplateData(parsed.draft as Seedance2TemplateData),
      activeSectionId: parsed.activeSectionId
    }
  } catch {
    return null
  }
}
