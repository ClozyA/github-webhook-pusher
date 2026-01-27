/**
 * 消息推送器
 * 需求: 5.1, 5.2, 5.6, 5.7
 */

import {Context, Element, Logger} from 'koishi'
import {EventType, ParsedEvent} from './types'
import {PushTarget, queryTargets as querySubscriptionTargets} from './repository/subscription'
import {buildMessage} from './message'

const logger = new Logger('github-webhook-pusher')

/** 推送结果 */
export interface PushResult {
  target: PushTarget
  success: boolean
  error?: Error
}

/**
 * 查询订阅目标
 * 需求 5.1: 查询所有订阅该仓库的目标会话
 * 需求 5.2: 根据订阅的事件类型过滤目标
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
  return querySubscriptionTargets(ctx, repo, eventType)
}

/**
 * 发送消息到单个目标
 * @param ctx Koishi 上下文
 * @param target 推送目标
 * @param message 消息内容
 * @returns 推送结果
 */
async function sendMessage(
  ctx: Context,
  target: PushTarget,
  message: Element[]
): Promise<PushResult> {
  try {
    // 获取对应平台的 bot
    const bot = ctx.bots.find(b => b.platform === target.platform)
    if (!bot) {
      throw new Error(`未找到平台 ${target.platform} 的 bot`)
    }

    // 发送消息到目标频道
    await bot.sendMessage(target.channelId, message, target.guildId)

    return {target, success: true}
  } catch (error) {
    return {
      target,
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}

/**
 * 并发推送消息到多个目标
 * 需求 5.6: 使用 Promise.allSettled 并发推送并限制并发数
 * 需求 5.7: 推送失败记录错误日志但不影响其他目标的推送
 * @param ctx Koishi 上下文
 * @param targets 推送目标列表
 * @param message 消息内容
 * @param concurrency 并发数限制
 * @returns 推送结果列表
 */
export async function pushWithConcurrency(
  ctx: Context,
  targets: PushTarget[],
  message: Element[],
  concurrency: number
): Promise<PushResult[]> {
  if (targets.length === 0) {
    return []
  }

  const results: PushResult[] = []
  const queue = [...targets]

  // 创建工作协程
  const workers = Array(Math.min(concurrency, queue.length))
    .fill(null)
    .map(async () => {
      while (queue.length > 0) {
        const target = queue.shift()
        if (!target) break

        const result = await sendMessage(ctx, target, message)
        results.push(result)

        // 需求 5.7: 推送失败记录错误日志但不影响其他目标
        if (!result.success && result.error) {
          logger.error(
            `推送失败 [${target.platform}:${target.channelId}]: ${result.error.message}`
          )
        }
      }
    })

  await Promise.all(workers)
  return results
}

/**
 * 推送消息到所有订阅目标
 * @param ctx Koishi 上下文
 * @param event 解析后的事件
 * @param concurrency 并发数限制
 * @returns 推送结果列表
 */
export async function pushMessage(
  ctx: Context,
  event: ParsedEvent,
  concurrency: number = 5
): Promise<PushResult[]> {
  // 查询订阅目标
  const targets = await queryTargets(ctx, event.repo, event.type)

  if (targets.length === 0) {
    logger.debug(`仓库 ${event.repo} 的 ${event.type} 事件没有订阅目标`)
    return []
  }

  logger.info(`准备推送 ${event.type} 事件到 ${targets.length} 个目标`)

  // 构建消息
  const message = buildMessage(event)

  // 并发推送
  const results = await pushWithConcurrency(ctx, targets, message, concurrency)

  // 统计结果
  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length

  logger.info(`推送完成: 成功 ${successCount}, 失败 ${failCount}`)

  return results
}

/**
 * 推送事件（完整流程）
 * 整合事件解析、消息构建和推送
 * @param ctx Koishi 上下文
 * @param event 解析后的事件
 * @param concurrency 并发数限制
 * @returns 推送结果
 */
export async function pushEvent(
  ctx: Context,
  event: ParsedEvent,
  concurrency: number = 5
): Promise<{ pushed: number; failed: number; results: PushResult[] }> {
  const results = await pushMessage(ctx, event, concurrency)

  return {
    pushed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  }
}
