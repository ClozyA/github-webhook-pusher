/**
 * Koishi GitHub Webhook 推送插件入口
 * 需求: 1.1, 7.1-7.7
 */

import {Context, Logger} from 'koishi'
import {Config} from './config'
import {extendDatabase} from './database'
import {registerWebhook} from './webhook'
import {registerTrustCommands, registerSubscriptionCommands, registerUtilCommands} from './commands'
import {cleanupDeliveries} from './repository'

/** 插件名称 */
export const name = 'github-webhook-pusher'

/** 声明服务依赖 - 需要 server 服务提供 router 和 database 服务 */
export const inject = ['server', 'database']

/** 导出配置 Schema */
export {Config}

/** 插件日志 */
const logger = new Logger('github-webhook-pusher')

/**
 * 插件入口函数
 * @param ctx Koishi 上下文
 * @param config 插件配置
 */
export function apply(ctx: Context, config: Config) {
  // 需求 7.1-7.7: 使用配置项
  logger.info(`正在加载 GitHub Webhook 插件...`)

  // 初始化数据库
  // 需求 6.1, 6.2, 6.3: 创建数据库表
  extendDatabase(ctx)
  logger.debug('数据库模型已注册')

  // 需求 1.1: 注册 Webhook 处理器
  registerWebhook(ctx, config)
  logger.debug(`Webhook 处理器已注册: ${config.path}`)

  // 注册所有命令
  // 需求 2.1-2.5: 信任仓库管理命令
  registerTrustCommands(ctx)
  logger.debug('信任仓库管理命令已注册')

  // 需求 3.1-3.7: 订阅管理命令
  registerSubscriptionCommands(ctx, config)
  logger.debug('订阅管理命令已注册')

  // 需求 8.1, 8.2: 工具命令
  registerUtilCommands(ctx, config)
  logger.debug('工具命令已注册')

  scheduleDeliveryCleanup(ctx, config)

  // 插件启动日志
  logger.info(`GitHub Webhook 插件已加载`)
  logger.info(`Webhook 路径: ${config.path}`)
  logger.info(`默认订阅事件: ${config.defaultEvents.join(', ')}`)

  if (config.debug) {
    logger.info('调试模式已启用')
  }
}

function scheduleDeliveryCleanup(ctx: Context, config: Config) {
  if (config.deliveryRetentionDays <= 0) {
    logger.debug('投递记录清理已禁用')
    return
  }

  const intervalHours = Math.max(1, config.deliveryCleanupIntervalHours || 24)
  const intervalMs = intervalHours * 60 * 60 * 1000

  const runCleanup = async () => {
    const beforeDate = new Date(Date.now() - config.deliveryRetentionDays * 24 * 60 * 60 * 1000)
    const removed = await cleanupDeliveries(ctx, beforeDate)
    if (config.debug) {
      logger.debug(`清理投递记录: ${removed} 条 (保留 ${config.deliveryRetentionDays} 天)`)
    }
  }

  runCleanup().catch(error => {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`投递记录清理失败: ${message}`)
  })

  ctx.setInterval(() => {
    runCleanup().catch(error => {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`投递记录清理失败: ${message}`)
    })
  }, intervalMs)
}
