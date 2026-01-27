/**
 * 投递记录数据访问层
 * 需求: 1.6
 */

import {Context} from 'koishi'
import {Delivery} from '../database'

/**
 * 记录投递
 * 需求 1.6: 记录 Delivery ID 用于去重
 * @param ctx Koishi 上下文
 * @param deliveryId GitHub Delivery ID
 * @param repo 仓库名 (owner/repo)
 * @param event 事件类型
 * @returns 创建的投递记录
 */
export async function recordDelivery(
  ctx: Context,
  deliveryId: string,
  repo: string,
  event: string
): Promise<Delivery> {
  const now = new Date()

  await ctx.database.create('github_deliveries', {
    deliveryId,
    repo,
    event,
    receivedAt: now,
  })

  const [created] = await ctx.database.get('github_deliveries', {deliveryId})
  return created
}

/**
 * 检查是否已投递
 * 需求 1.6: 检查 Delivery ID 是否已处理过，用于去重
 * @param ctx Koishi 上下文
 * @param deliveryId GitHub Delivery ID
 * @returns 是否已投递
 */
export async function isDelivered(ctx: Context, deliveryId: string): Promise<boolean> {
  const deliveries = await ctx.database.get('github_deliveries', {deliveryId})
  return deliveries.length > 0
}

/**
 * 获取投递记录
 * @param ctx Koishi 上下文
 * @param deliveryId GitHub Delivery ID
 * @returns 投递记录，不存在返回 null
 */
export async function getDelivery(ctx: Context, deliveryId: string): Promise<Delivery | null> {
  const deliveries = await ctx.database.get('github_deliveries', {deliveryId})
  return deliveries.length > 0 ? deliveries[0] : null
}

/**
 * 清理旧的投递记录
 * @param ctx Koishi 上下文
 * @param beforeDate 清理此日期之前的记录
 * @returns 清理的记录数
 */
export async function cleanupDeliveries(ctx: Context, beforeDate: Date): Promise<number> {
  const result = await ctx.database.remove('github_deliveries', {
    receivedAt: {$lt: beforeDate},
  })
  return result.removed ?? 0
}
