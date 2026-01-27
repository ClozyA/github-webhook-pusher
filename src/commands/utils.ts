/**
 * 工具命令
 * 需求: 8.1, 8.2
 */

import {Context} from 'koishi'
import {Config} from '../config'
import {EventType, EVENT_DISPLAY_MAP, ParsedEvent, getDisplayType} from '../types'
import {listTrustedRepos} from '../repository/trust'
import {buildMessage} from '../message'
import {name} from '../index'

/** 管理员权限等级 */
const ADMIN_AUTHORITY = 3

/** 所有支持的事件类型 */
const ALL_EVENT_TYPES: EventType[] = ['issues', 'release', 'push', 'pull_request', 'star']

/**
 * 生成测试事件数据
 */
function generateTestEvent(repo: string, eventType: EventType): ParsedEvent {
  const baseEvent = {
    type: eventType,
    displayType: getDisplayType(eventType),
    repo,
    actor: 'test-user',
    url: `https://github.com/${repo}`,
  }

  switch (eventType) {
    case 'issues':
      return {
        ...baseEvent,
        action: 'opened',
        title: '测试 Issue 标题',
        number: 123,
      }
    case 'release':
      return {
        ...baseEvent,
        action: 'published',
        title: 'v1.0.0',
        tagName: 'v1.0.0',
      }
    case 'push':
      return {
        ...baseEvent,
        ref: 'main',
        commits: [
          {sha: 'abc1234', message: '测试提交 1', author: 'test-user', url: ''},
          {sha: 'def5678', message: '测试提交 2', author: 'test-user', url: ''},
        ],
        totalCommits: 2,
      }
    case 'pull_request':
      return {
        ...baseEvent,
        action: 'opened',
        title: '测试 PR 标题',
        number: 456,
      }
    case 'star':
      return {
        ...baseEvent,
        action: 'created',
        starCount: 1234,
      }
    default:
      return baseEvent
  }
}


/**
 * 注册工具命令
 * @param ctx Koishi 上下文
 * @param config 插件配置
 */
export function registerUtilCommands(ctx: Context, config: Config) {
  // gh.ping - 返回插件状态信息
  ctx.command('gh.ping', '查看插件状态')
    .usage('gh.ping')
    .action(async () => {
      const repos = await listTrustedRepos(ctx)
      const enabledCount = repos.filter(r => r.enabled).length

      const lines = [
        '🏓 GitHub Webhook 推送插件',
        `📦 插件名称: ${name}`,
        `🔗 Webhook 路径: ${config.path}`,
        `📋 信任仓库: ${repos.length} 个 (${enabledCount} 个已启用)`,
        `🔧 调试模式: ${config.debug ? '开启' : '关闭'}`,
      ]

      return lines.join('\n')
    })

  // gh.test <repo> <event> - 生成并推送测试消息（管理员）
  ctx.command('gh.test <repo:string> <event:string>', '生成测试消息')
    .usage('gh.test owner/repo event')
    .example('gh.test koishijs/koishi issues')
    .example('gh.test koishijs/koishi push')
    .action(async ({session}, repo, event) => {
      // 权限检查
      const user = session?.user as {authority?: number} | undefined
      if ((user?.authority ?? 0) < ADMIN_AUTHORITY) {
        return '❌ 权限不足，需要管理员权限'
      }

      if (!repo) {
        return '❌ 请指定仓库名，格式: owner/repo'
      }

      if (!event) {
        const eventList = ALL_EVENT_TYPES.map(e => {
          const info = EVENT_DISPLAY_MAP[e]
          return `${info.emoji} ${e}`
        }).join(', ')
        return `❌ 请指定事件类型\n可用类型: ${eventList}`
      }

      // 验证事件类型
      if (!ALL_EVENT_TYPES.includes(event as EventType)) {
        const eventList = ALL_EVENT_TYPES.join(', ')
        return `❌ 不支持的事件类型: ${event}\n可用类型: ${eventList}`
      }

      // 生成测试事件
      const testEvent = generateTestEvent(repo, event as EventType)
      const message = buildMessage(testEvent)

      // 发送测试消息到当前会话
      await session?.send(message)

      return  // 消息已发送，不需要额外返回
    })
}
