/**
 * 消息推送器
 * 需求: 5.1, 5.2, 5.6, 5.7
 */

import {Context, Element, Logger} from 'koishi'
import {EventType, ParsedEvent} from './types'
import {PushTarget, queryTargets as querySubscriptionTargets} from './repository/subscription'
import {buildBatchFallbackMessage, buildForwardMessage, buildMessage} from './message'

const logger = new Logger('github-webhook-pusher')

/** 推送结果 */
export interface PushResult {
  target: PushTarget
  success: boolean
  queued?: boolean
  error?: Error
}

/** 合并转发相关推送配置 */
export interface PushOptions {
  concurrency: number
  forwardPrivateMessages: boolean
  forwardGroupMessages: boolean
  forwardBatchSeconds: number
}

interface MessageJob {
  target: PushTarget
  message: Element[]
  fallbackMessage?: Element[]
}

interface PendingForwardBatch {
  target: PushTarget
  events: ParsedEvent[]
}

const forwardBatches = new WeakMap<Context, Map<string, PendingForwardBatch>>()

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
  return pushJobsWithConcurrency(
    ctx,
    targets.map(target => ({target, message})),
    concurrency
  )
}

async function pushJobsWithConcurrency(
  ctx: Context,
  jobs: MessageJob[],
  concurrency: number
): Promise<PushResult[]> {
  if (jobs.length === 0) {
    return []
  }

  const results: PushResult[] = []
  const queue = [...jobs]

  // 创建工作协程
  const workerCount = Math.min(Math.max(1, concurrency || 1), queue.length)
  const workers = Array(workerCount)
    .fill(null)
    .map(async () => {
      while (queue.length > 0) {
        const job = queue.shift()
        if (!job) break

        let result = await sendMessage(ctx, job.target, job.message)
        if (!result.success && job.fallbackMessage) {
          logger.warn(
            `合并转发失败 [${job.target.platform}:${job.target.channelId}]，回退为普通文本: ${result.error?.message || '未知错误'}`
          )
          result = await sendMessage(ctx, job.target, job.fallbackMessage)
        }
        results.push(result)

        // 需求 5.7: 推送失败记录错误日志但不影响其他目标
        if (!result.success && result.error) {
          logger.error(
            `推送失败 [${job.target.platform}:${job.target.channelId}]: ${result.error.message}`
          )
        }
      }
    })

  await Promise.all(workers)
  return results
}

/** 判断目标会话是否启用了聊天记录形式 */
export function shouldUseForwardMessage(
  target: Pick<PushTarget, 'guildId'>,
  options: Pick<PushOptions, 'forwardPrivateMessages' | 'forwardGroupMessages'>
): boolean {
  return target.guildId
    ? options.forwardGroupMessages
    : options.forwardPrivateMessages
}

function getForwardBatchKey(target: PushTarget): string {
  return [target.platform, target.channelId, target.guildId || ''].join('\u0000')
}

function getForwardBatches(ctx: Context): Map<string, PendingForwardBatch> {
  let batches = forwardBatches.get(ctx)
  if (!batches) {
    batches = new Map()
    forwardBatches.set(ctx, batches)
  }
  return batches
}

function queueForwardMessage(
  ctx: Context,
  target: PushTarget,
  event: ParsedEvent,
  batchSeconds: number
): PushResult {
  const batches = getForwardBatches(ctx)
  const key = getForwardBatchKey(target)
  const existing = batches.get(key)

  if (existing) {
    existing.events.push(event)
  } else {
    batches.set(key, {target, events: [event]})
    ctx.setTimeout(() => {
      void flushForwardBatch(ctx, key)
    }, batchSeconds * 1000)
  }

  return {target, success: true, queued: true}
}

async function flushForwardBatch(ctx: Context, key: string): Promise<void> {
  const batches = getForwardBatches(ctx)
  const batch = batches.get(key)
  if (!batch) return

  // 先移除当前批次；发送期间到达的新事件会开启一个新窗口。
  batches.delete(key)

  const result = await sendMessage(
    ctx,
    batch.target,
    buildForwardMessage(batch.events)
  )

  if (result.success) {
    logger.info(
      `合并转发完成 [${batch.target.platform}:${batch.target.channelId}]: ${batch.events.length} 条事件`
    )
    return
  }

  logger.warn(
    `合并转发失败 [${batch.target.platform}:${batch.target.channelId}]，回退为普通文本: ${result.error?.message || '未知错误'}`
  )

  const fallbackResult = await sendMessage(
    ctx,
    batch.target,
    buildBatchFallbackMessage(batch.events)
  )
  if (!fallbackResult.success && fallbackResult.error) {
    logger.error(
      `回退推送失败 [${batch.target.platform}:${batch.target.channelId}]: ${fallbackResult.error.message}`
    )
  }
}

/**
 * 推送消息到所有订阅目标
 * @param ctx Koishi 上下文
 * @param event 解析后的事件
 * @param options 推送配置
 * @returns 推送结果列表
 */
export async function pushMessage(
  ctx: Context,
  event: ParsedEvent,
  options: PushOptions
): Promise<PushResult[]> {
  // 查询订阅目标
  const targets = await queryTargets(ctx, event.repo, event.type)

  if (targets.length === 0) {
    logger.debug(`仓库 ${event.repo} 的 ${event.type} 事件没有订阅目标`)
    return []
  }

  logger.info(`准备推送 ${event.type} 事件到 ${targets.length} 个目标`)

  const immediateJobs: MessageJob[] = []
  const results: PushResult[] = []
  const batchSeconds = Math.max(0, options.forwardBatchSeconds || 0)

  for (const target of targets) {
    if (!shouldUseForwardMessage(target, options)) {
      immediateJobs.push({target, message: buildMessage(event)})
    } else if (batchSeconds > 0) {
      results.push(queueForwardMessage(ctx, target, event, batchSeconds))
    } else {
      immediateJobs.push({
        target,
        message: buildForwardMessage([event]),
        fallbackMessage: buildMessage(event),
      })
    }
  }

  results.push(...await pushJobsWithConcurrency(
    ctx,
    immediateJobs,
    Math.max(1, options.concurrency || 5)
  ))

  // 统计结果
  const successCount = results.filter(r => r.success && !r.queued).length
  const queuedCount = results.filter(r => r.queued).length
  const failCount = results.filter(r => !r.success).length

  logger.info(`推送完成: 成功 ${successCount}, 已排队 ${queuedCount}, 失败 ${failCount}`)

  return results
}

/**
 * 推送事件（完整流程）
 * 整合事件解析、消息构建和推送
 * @param ctx Koishi 上下文
 * @param event 解析后的事件
 * @param options 推送配置
 * @returns 推送结果
 */
export async function pushEvent(
  ctx: Context,
  event: ParsedEvent,
  options: PushOptions
): Promise<{ pushed: number; queued: number; failed: number; results: PushResult[] }> {
  const results = await pushMessage(ctx, event, options)

  return {
    pushed: results.filter(r => r.success && !r.queued).length,
    queued: results.filter(r => r.queued).length,
    failed: results.filter(r => !r.success).length,
    results,
  }
}
