/**
 * 订阅数据访问层
 * 需求: 3.1-3.7, 5.1, 5.2
 */

import {Context} from 'koishi'
import {Subscription} from '../database'
import {EventType} from '../types'

/** 推送目标信息 */
export interface PushTarget {
  platform: string
  channelId: string
  guildId?: string
  userId?: string
}

/** 会话标识 */
export interface SessionIdentifier {
  platform: string
  channelId: string
  guildId?: string
  userId?: string
}

/**
 * 创建订阅
 * 需求 3.1: 为当前会话创建订阅记录
 * @param ctx Koishi 上下文
 * @param session 会话标识
 * @param repo 仓库名 (owner/repo)
 * @param defaultEvents 默认事件列表
 * @returns 创建的订阅记录
 */
export async function createSubscription(
  ctx: Context,
  session: SessionIdentifier,
  repo: string,
  defaultEvents: EventType[]
): Promise<Subscription> {
  const now = new Date()

  // 检查是否已存在
  const existing = await ctx.database.get('github_subscriptions', {
    platform: session.platform,
    channelId: session.channelId,
    repo,
  })

  if (existing.length > 0) {
    return existing[0]
  }

  await ctx.database.create('github_subscriptions', {
    platform: session.platform,
    channelId: session.channelId,
    guildId: session.guildId || '',
    userId: session.userId || '',
    repo,
    events: defaultEvents,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  })

  const [created] = await ctx.database.get('github_subscriptions', {
    platform: session.platform,
    channelId: session.channelId,
    repo,
  })
  return created
}


/**
 * 移除订阅
 * 需求 3.3: 移除当前会话对该仓库的订阅
 * @param ctx Koishi 上下文
 * @param session 会话标识
 * @param repo 仓库名 (owner/repo)
 * @returns 是否成功移除
 */
export async function removeSubscription(
  ctx: Context,
  session: SessionIdentifier,
  repo: string
): Promise<boolean> {
  const result = await ctx.database.remove('github_subscriptions', {
    platform: session.platform,
    channelId: session.channelId,
    repo,
  })
  return (result.removed ?? 0) > 0
}

/**
 * 列出会话的所有订阅
 * 需求 3.4: 显示当前会话的所有订阅及其事件设置
 * @param ctx Koishi 上下文
 * @param session 会话标识
 * @returns 订阅列表
 */
export async function listSubscriptions(
  ctx: Context,
  session: SessionIdentifier
): Promise<Subscription[]> {
  return ctx.database.get('github_subscriptions', {
    platform: session.platform,
    channelId: session.channelId,
  })
}

/**
 * 获取单个订阅
 * 需求 3.5: 显示该仓库订阅的事件类型列表
 * @param ctx Koishi 上下文
 * @param session 会话标识
 * @param repo 仓库名 (owner/repo)
 * @returns 订阅记录，不存在返回 null
 */
export async function getSubscription(
  ctx: Context,
  session: SessionIdentifier,
  repo: string
): Promise<Subscription | null> {
  const subs = await ctx.database.get('github_subscriptions', {
    platform: session.platform,
    channelId: session.channelId,
    repo,
  })
  return subs.length > 0 ? subs[0] : null
}

/**
 * 更新订阅的事件类型
 * 需求 3.6: 根据 +/- 前缀启用或禁用对应事件类型
 * @param ctx Koishi 上下文
 * @param session 会话标识
 * @param repo 仓库名 (owner/repo)
 * @param events 新的事件列表
 * @returns 是否成功更新
 */
export async function updateEvents(
  ctx: Context,
  session: SessionIdentifier,
  repo: string,
  events: EventType[]
): Promise<boolean> {
  const result = await ctx.database.set('github_subscriptions', {
    platform: session.platform,
    channelId: session.channelId,
    repo,
  }, {
    events,
    updatedAt: new Date(),
  })
  return (result.modified ?? 0) > 0
}


/**
 * 查询订阅目标
 * 需求 5.1, 5.2: 查询所有订阅该仓库的目标会话，并根据事件类型过滤
 * @param ctx Koishi 上下文
 * @param repo 仓库名 (owner/repo)
 * @param eventType 事件类型
 * @returns 推送目标列表
 */
export async function queryTargets(
  ctx: Context,
  repo: string,
  eventType: EventType
): Promise<PushTarget[]> {
  // 获取所有订阅该仓库且已启用的订阅
  const subscriptions = await ctx.database.get('github_subscriptions', {
    repo,
    enabled: true,
  })

  // 过滤出订阅了该事件类型的目标
  return subscriptions
    .filter(sub => sub.events.includes(eventType))
    .map(sub => ({
      platform: sub.platform,
      channelId: sub.channelId,
      guildId: sub.guildId || undefined,
      userId: sub.userId || undefined,
    }))
}

/**
 * 获取仓库的所有订阅
 * @param ctx Koishi 上下文
 * @param repo 仓库名 (owner/repo)
 * @returns 订阅列表
 */
export async function getRepoSubscriptions(
  ctx: Context,
  repo: string
): Promise<Subscription[]> {
  return ctx.database.get('github_subscriptions', {repo})
}

/**
 * 启用订阅
 * @param ctx Koishi 上下文
 * @param session 会话标识
 * @param repo 仓库名 (owner/repo)
 * @returns 是否成功启用
 */
export async function enableSubscription(
  ctx: Context,
  session: SessionIdentifier,
  repo: string
): Promise<boolean> {
  const result = await ctx.database.set('github_subscriptions', {
    platform: session.platform,
    channelId: session.channelId,
    repo,
  }, {
    enabled: true,
    updatedAt: new Date(),
  })
  return (result.modified ?? 0) > 0
}

/**
 * 禁用订阅
 * @param ctx Koishi 上下文
 * @param session 会话标识
 * @param repo 仓库名 (owner/repo)
 * @returns 是否成功禁用
 */
export async function disableSubscription(
  ctx: Context,
  session: SessionIdentifier,
  repo: string
): Promise<boolean> {
  const result = await ctx.database.set('github_subscriptions', {
    platform: session.platform,
    channelId: session.channelId,
    repo,
  }, {
    enabled: false,
    updatedAt: new Date(),
  })
  return (result.modified ?? 0) > 0
}
