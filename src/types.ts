/**
 * 事件类型和接口定义
 * 需求: 4.1-4.7
 */

/** 支持的事件类型 */
export type EventType = 'issues' | 'release' | 'push' | 'pull_request' | 'star'

/** 提交信息 */
export interface CommitInfo {
  sha: string
  message: string
  author: string
  url: string
}

/** 解析后的事件数据 */
export interface ParsedEvent {
  type: EventType
  displayType: string  // 显示名称，如 push -> commit
  repo: string         // owner/repo
  actor: string        // 操作者
  action?: string      // 事件动作
  title?: string       // 标题（issues/PR）
  number?: number      // 编号（issues/PR）
  url: string          // GitHub 链接
  body?: string        // 详细内容
  commits?: CommitInfo[]  // 提交列表（push）
  totalCommits?: number   // 总提交数（push）
  ref?: string         // 分支/标签（push/release）
  tagName?: string     // 版本号（release）
  starCount?: number   // Star 数量
}

/** 事件类型显示信息 */
export interface EventDisplayInfo {
  name: string
  emoji: string
}

/** 事件类型到显示名称和 emoji 的映射 */
export const EVENT_DISPLAY_MAP: Record<EventType, EventDisplayInfo> = {
  issues: { name: 'Issue', emoji: '📌' },
  release: { name: 'Release', emoji: '🚀' },
  push: { name: 'Commit', emoji: '⬆️' },
  pull_request: { name: 'PR', emoji: '🔀' },
  star: { name: 'Star', emoji: '⭐' },
}

/**
 * 获取事件类型的显示名称
 * @param type 事件类型
 * @returns 显示名称
 */
export function getDisplayType(type: EventType): string {
  return EVENT_DISPLAY_MAP[type].name
}

/**
 * 获取事件类型的 emoji
 * @param type 事件类型
 * @returns emoji 字符
 */
export function getEventEmoji(type: EventType): string {
  return EVENT_DISPLAY_MAP[type].emoji
}
