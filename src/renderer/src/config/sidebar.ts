import type { SidebarIcon } from '@renderer/types'

/**
 * Icons intentionally removed from the my-classic-cherry personal build.
 * Kept out of both the default visible list and the settings re-enable list.
 */
export const HIDDEN_SIDEBAR_ICONS: SidebarIcon[] = [
  'agents',
  'store',
  'minapp',
  'code_tools',
  'openclaw'
]

/**
 * 默认显示的侧边栏图标
 * 这些图标会在侧边栏中默认显示
 */
export const DEFAULT_SIDEBAR_ICONS: SidebarIcon[] = [
  'assistants',
  'paintings',
  'translate',
  'knowledge',
  'files',
  'notes'
]

/**
 * 必须显示的侧边栏图标（不能被隐藏）
 * 这些图标必须始终在侧边栏中可见
 * 抽取为参数方便未来扩展
 */
export const REQUIRED_SIDEBAR_ICONS: SidebarIcon[] = ['assistants']
