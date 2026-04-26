/**
 * 订阅管理命令（交互式）
 */

import {Context} from 'koishi'
import {EVENT_DISPLAY_MAP, EventType} from '../types'
import {isInTrustList} from '../repository/trust'
import {
  createSubscription,
  getSubscription,
  listSubscriptions,
  removeSubscription,
  SessionIdentifier,
  updateEvents,
} from '../repository/subscription'

/** 所有支持的事件类型 */
const ALL_EVENT_TYPES: EventType[] = [
  'issues',
  'issue_comment',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
  'release',
  'push',
  'star',
  'fork',
  'create',
  'delete',
  'workflow_run',
]

/** 交互式回复等待时间（毫秒） */
const PROMPT_TIMEOUT = 60_000

/**
 * 从会话中提取会话标识
 */
function getSessionIdentifier(session: any): SessionIdentifier {
  return {
    platform: session.platform,
    channelId: session.channelId,
    guildId: session.guildId,
    userId: session.userId,
  }
}

/**
 * 格式化事件选项（带编号、emoji、名称）
 */
function formatEventOptions(events: EventType[]): string {
  return events.map((e, idx) => {
    const info = EVENT_DISPLAY_MAP[e]
    return `${idx + 1}. ${info.emoji} ${e} (${info.name})`
  }).join('\n')
}

/**
 * 解析用户回复的数字（支持空格、逗号、中英文逗号分隔；支持 all/0）
 * @returns 选中的事件列表；若回复 all/0 返回全部 events；若解析失败返回 null
 */
function parseSelection(reply: string, events: EventType[]): EventType[] | null {
  const trimmed = reply.trim().toLowerCase()
  if (!trimmed) return null
  if (trimmed === 'all' || trimmed === '全部' || trimmed === '0') {
    return [...events]
  }

  // 用任意非数字字符切分
  const tokens = trimmed.split(/[^0-9]+/).filter(Boolean)
  if (tokens.length === 0) return null

  const selected = new Set<EventType>()
  for (const tok of tokens) {
    const idx = parseInt(tok, 10)
    if (isNaN(idx) || idx < 1 || idx > events.length) return null
    selected.add(events[idx - 1])
  }
  return Array.from(selected)
}

/**
 * 注册订阅管理命令
 */
export function registerSubscriptionCommands(ctx: Context) {
  ctx.command('gh', 'GitHub Webhook 指令')

  // gh.sub <repo> - 交互式添加订阅事件
  ctx.command('gh.sub <repo:string>', '订阅 GitHub 仓库事件（交互式）')
    .usage('gh.sub owner/repo')
    .example('gh.sub koishijs/koishi')
    .action(async ({session}, repo) => {
      if (!session) return '❌ 无法获取会话信息'
      if (!repo) return '❌ 请指定仓库名，格式: owner/repo'

      const trusted = await isInTrustList(ctx, repo)
      if (!trusted) return '❌ 该仓库不在信任列表中'

      const sessionId = getSessionIdentifier(session)
      const existing = await getSubscription(ctx, sessionId, repo)
      const subscribed = new Set<EventType>(existing?.events ?? [])

      // 计算未订阅的事件
      const candidates = ALL_EVENT_TYPES.filter(e => !subscribed.has(e))

      if (candidates.length === 0) {
        return `ℹ️ ${repo} 已订阅全部事件类型，无需新增`
      }

      const header = existing
        ? `📋 ${repo} 当前未订阅的事件:`
        : `📋 请选择要订阅的事件 (${repo}):`

      await session.send([
        header,
        formatEventOptions(candidates),
        '',
        '请回复编号（支持多选，用空格或逗号分隔），回复 all 选择全部，回复其他内容取消。',
      ].join('\n'))

      const reply = await session.prompt(PROMPT_TIMEOUT)
      if (reply === undefined) return '⏰ 等待回复超时，已取消'

      const picked = parseSelection(reply, candidates)
      if (!picked || picked.length === 0) return '❌ 已取消订阅操作'

      // 合并已有事件
      const finalEvents = Array.from(new Set<EventType>([...subscribed, ...picked]))

      if (existing) {
        await updateEvents(ctx, sessionId, repo, finalEvents)
      } else {
        await createSubscription(ctx, sessionId, repo, finalEvents)
      }

      return [
        `✅ 已订阅仓库: ${repo}`,
        `➕ 新增事件: ${picked.join(', ')}`,
        `📋 当前订阅: ${finalEvents.join(', ')}`,
      ].join('\n')
    })

  // gh.unsub <repo> - 交互式移除订阅事件 / 完全取消订阅
  ctx.command('gh.unsub <repo:string>', '取消订阅事件（交互式）')
    .usage('gh.unsub owner/repo')
    .example('gh.unsub koishijs/koishi')
    .action(async ({session}, repo) => {
      if (!session) return '❌ 无法获取会话信息'
      if (!repo) return '❌ 请指定仓库名'

      const sessionId = getSessionIdentifier(session)
      const existing = await getSubscription(ctx, sessionId, repo)

      if (!existing) return `❌ 未找到仓库 ${repo} 的订阅`

      const current = existing.events as EventType[]

      if (current.length === 0) {
        // 没有任何事件订阅，直接整个删除
        await removeSubscription(ctx, sessionId, repo)
        return `✅ 已取消订阅: ${repo}`
      }

      await session.send([
        `📋 ${repo} 当前订阅的事件:`,
        formatEventOptions(current),
        '',
        '请回复要取消的编号（支持多选，用空格或逗号分隔），回复 all 取消整个订阅，回复其他内容退出。',
      ].join('\n'))

      const reply = await session.prompt(PROMPT_TIMEOUT)
      if (reply === undefined) return '⏰ 等待回复超时，已取消操作'

      const trimmed = reply.trim().toLowerCase()
      if (trimmed === 'all' || trimmed === '全部' || trimmed === '0') {
        await removeSubscription(ctx, sessionId, repo)
        return `✅ 已取消订阅: ${repo}`
      }

      const picked = parseSelection(reply, current)
      if (!picked || picked.length === 0) return '❌ 已退出取消订阅操作'

      const removeSet = new Set<EventType>(picked)
      const remaining = current.filter(e => !removeSet.has(e))

      if (remaining.length === 0) {
        await removeSubscription(ctx, sessionId, repo)
        return `✅ 已取消订阅: ${repo}（移除了全部事件）`
      }

      await updateEvents(ctx, sessionId, repo, remaining)
      return [
        `✅ ${repo} 已更新订阅`,
        `➖ 移除事件: ${picked.join(', ')}`,
        `📋 剩余订阅: ${remaining.join(', ')}`,
      ].join('\n')
    })

  // gh.list - 列出当前会话的所有订阅
  ctx.command('gh.list', '列出当前会话的所有订阅')
    .usage('gh.list')
    .action(async ({session}) => {
      if (!session) return '❌ 无法获取会话信息'

      const sessionId = getSessionIdentifier(session)
      const subscriptions = await listSubscriptions(ctx, sessionId)

      if (subscriptions.length === 0) {
        return '📋 当前会话没有订阅任何仓库\n💡 使用 gh.sub owner/repo 开始订阅'
      }

      const lines = ['📋 订阅列表:']
      for (const sub of subscriptions) {
        const status = sub.enabled ? '✅' : '⏸️'
        const events = sub.events.length > 0 ? sub.events.join(', ') : '(无)'
        lines.push(`${status} ${sub.repo}`)
        lines.push(`   事件: ${events}`)
      }
      return lines.join('\n')
    })
}
