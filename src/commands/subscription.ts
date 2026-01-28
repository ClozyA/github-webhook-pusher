/**
 * 订阅管理命令
 * 需求: 3.1-3.7
 */

import {Context} from 'koishi'
import {Config} from '../config'
import {EventType, EVENT_DISPLAY_MAP} from '../types'
import {isInTrustList} from '../repository/trust'
import {
  createSubscription,
  removeSubscription,
  listSubscriptions,
  getSubscription,
  updateEvents,
  SessionIdentifier,
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
 * 解析事件变更参数
 * 格式: +issues -star +release
 * @param changes 变更参数数组
 * @param currentEvents 当前事件列表
 * @returns 新的事件列表
 */
function parseEventChanges(changes: string[], currentEvents: EventType[]): EventType[] {
  const events = new Set(currentEvents)

  for (const change of changes) {
    if (!change) continue

    const prefix = change[0]
    const eventName = change.slice(1) as EventType

    // 验证事件类型
    if (!ALL_EVENT_TYPES.includes(eventName)) {
      continue
    }

    if (prefix === '+') {
      events.add(eventName)
    } else if (prefix === '-') {
      events.delete(eventName)
    }
  }

  return Array.from(events)
}


/**
 * 注册订阅管理命令
 * @param ctx Koishi 上下文
 * @param config 插件配置
 */
export function registerSubscriptionCommands(ctx: Context, config: Config) {
  ctx.command('gh', 'GitHub Webhook 指令')

  // gh.sub <repo> - 订阅仓库
  ctx.command('gh.sub <repo:string>', '订阅 GitHub 仓库事件')
    .usage('gh.sub owner/repo')
    .example('gh.sub koishijs/koishi')
    .action(async ({session}, repo) => {
      if (!session) return '❌ 无法获取会话信息'

      if (!repo) {
        return '❌ 请指定仓库名，格式: owner/repo'
      }

      // 检查仓库是否在信任列表中
      const trusted = await isInTrustList(ctx, repo)
      if (!trusted) {
        return '❌ 该仓库不在信任列表中'
      }

      const sessionId = getSessionIdentifier(session)
      const subscription = await createSubscription(ctx, sessionId, repo, config.defaultEvents)

      if (subscription) {
        const eventList = subscription.events.join(', ')
        return `✅ 已订阅仓库: ${repo}\n📋 订阅事件: ${eventList}`
      }
      return '❌ 订阅失败'
    })

  // gh.unsub <repo> - 取消订阅
  ctx.command('gh.unsub <repo:string>', '取消订阅 GitHub 仓库')
    .usage('gh.unsub owner/repo')
    .example('gh.unsub koishijs/koishi')
    .action(async ({session}, repo) => {
      if (!session) return '❌ 无法获取会话信息'

      if (!repo) {
        return '❌ 请指定仓库名'
      }

      const sessionId = getSessionIdentifier(session)
      const success = await removeSubscription(ctx, sessionId, repo)

      if (success) {
        return `✅ 已取消订阅: ${repo}`
      }
      return `❌ 未找到仓库 ${repo} 的订阅`
    })


  // gh.list - 列出当前会话的所有订阅
  ctx.command('gh.list', '列出当前会话的所有订阅')
    .usage('gh.list')
    .action(async ({session}) => {
      if (!session) return '❌ 无法获取会话信息'

      const sessionId = getSessionIdentifier(session)
      const subscriptions = await listSubscriptions(ctx, sessionId)

      if (subscriptions.length === 0) {
        return '📋 当前会话没有订阅任何仓库'
      }

      const lines = ['📋 订阅列表:']
      for (const sub of subscriptions) {
        const status = sub.enabled ? '✅' : '⏸️'
        const events = sub.events.join(', ')
        lines.push(`${status} ${sub.repo}`)
        lines.push(`   事件: ${events}`)
      }
      return lines.join('\n')
    })

  // gh.events <repo> - 查看订阅事件
  ctx.command('gh.events [repo:string]', '查看订阅的事件类型')
    .usage('gh.events [owner/repo]')
    .example('gh.events koishijs/koishi')
    .action(async ({session}, repo) => {
      if (!session) return '❌ 无法获取会话信息'

      if (!repo) {
        // 显示所有可用事件类型
        const lines = ['📋 可用事件类型:']
        for (const [type, info] of Object.entries(EVENT_DISPLAY_MAP)) {
          lines.push(`${info.emoji} ${type} - ${info.name}`)
        }
        return lines.join('\n')
      }

      const sessionId = getSessionIdentifier(session)
      const subscription = await getSubscription(ctx, sessionId, repo)

      if (!subscription) {
        return `❌ 未找到仓库 ${repo} 的订阅`
      }

      const events = subscription.events.join(', ')
      return `📋 ${repo} 订阅的事件:\n${events}`
    })

  ctx.command('gh.on <repo:string> [...events:string]', '快捷启用订阅事件')
    .usage('gh.on owner/repo issues pull_request')
    .example('gh.on koishijs/koishi issues pull_request')
    .action(async ({session}, repo, ...events) => {
      if (!session) return '❌ 无法获取会话信息'

      if (!repo) {
        return '❌ 请指定仓库名'
      }

      if (!events || events.length === 0) {
        const eventList = ALL_EVENT_TYPES.map(e => {
          const info = EVENT_DISPLAY_MAP[e]
          return `${info.emoji} ${e}`
        }).join(', ')
        return `❌ 请指定事件类型\n可用类型: ${eventList}`
      }

      const sessionId = getSessionIdentifier(session)
      const subscription = await getSubscription(ctx, sessionId, repo)

      if (!subscription) {
        return `❌ 未找到仓库 ${repo} 的订阅`
      }

      const changes = events.map(event => `+${event}`)
      const newEvents = parseEventChanges(changes, subscription.events)
      const success = await updateEvents(ctx, sessionId, repo, newEvents)

      if (success) {
        const eventList = newEvents.join(', ')
        return `✅ 已启用 ${repo} 的订阅事件:\n${eventList}`
      }
      return '❌ 更新失败'
    })

  ctx.command('gh.off <repo:string> [...events:string]', '快捷禁用订阅事件')
    .usage('gh.off owner/repo issues pull_request')
    .example('gh.off koishijs/koishi issues pull_request')
    .action(async ({session}, repo, ...events) => {
      if (!session) return '❌ 无法获取会话信息'

      if (!repo) {
        return '❌ 请指定仓库名'
      }

      if (!events || events.length === 0) {
        const eventList = ALL_EVENT_TYPES.map(e => {
          const info = EVENT_DISPLAY_MAP[e]
          return `${info.emoji} ${e}`
        }).join(', ')
        return `❌ 请指定事件类型\n可用类型: ${eventList}`
      }

      const sessionId = getSessionIdentifier(session)
      const subscription = await getSubscription(ctx, sessionId, repo)

      if (!subscription) {
        return `❌ 未找到仓库 ${repo} 的订阅`
      }

      const changes = events.map(event => `-${event}`)
      const newEvents = parseEventChanges(changes, subscription.events)
      const success = await updateEvents(ctx, sessionId, repo, newEvents)

      if (success) {
        const eventList = newEvents.join(', ')
        return `✅ 已禁用 ${repo} 的订阅事件:\n${eventList}`
      }
      return '❌ 更新失败'
    })
}
