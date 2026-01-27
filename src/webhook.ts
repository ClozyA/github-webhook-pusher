/**
 * Webhook 处理器
 * 需求: 1.1-1.6, 2.6, 9.1-9.6
 */

import {Context, Logger} from 'koishi'
import type {Context as KoaContext} from 'koa'
import {Config} from './config'
import {verifySignature} from './signature'
import {parseEvent} from './parser'
import {pushEvent} from './pusher'
import {isDelivered, isTrusted, recordDelivery} from './repository'

// 声明 server 服务类型
declare module 'koishi' {
  interface Context {
    server: {
      post(path: string, handler: (ctx: KoaContext) => Promise<void>): void
    }
  }
}

const logger = new Logger('github-webhook')

/** HTTP 响应类型 */
interface WebhookResponse {
  status: 'ok' | 'ignored' | 'duplicate' | 'error'
  reason?: string
  pushed?: number
  error?: string
}

/**
 * 注册 Webhook 处理器
 * 需求 1.1: 在配置的路径上监听 HTTP POST 请求
 * @param ctx Koishi 上下文
 * @param config 插件配置
 */
export function registerWebhook(ctx: Context, config: Config) {
  const path = config.path || '/github/webhook'

  logger.info(`注册 Webhook 处理器: ${path}`)

  // 使用 ctx.server.post 注册 HTTP POST 路由
  ctx.server.post(path, async (koaCtx: KoaContext) => {
    const startTime = Date.now()

    try {
      // 获取请求信息
      const signature = koaCtx.get('X-Hub-Signature-256')
      const eventName = koaCtx.get('X-GitHub-Event')
      const deliveryId = koaCtx.get('X-GitHub-Delivery')

      // 获取原始请求体
      const rawBody = await getRawBody(koaCtx)

      // 需求 9.1: 记录请求来源、事件类型
      if (config.debug) {
        logger.debug(`收到 Webhook 请求: event=${eventName}, delivery=${deliveryId}`)
      }

      // 需求 1.2, 1.3, 1.4: 签名验证
      if (config.secret) {
        if (!signature) {
          // 需求 1.4: 缺少签名头
          logger.warn('请求缺少 X-Hub-Signature-256 头')
          koaCtx.status = 401
          koaCtx.body = {error: 'Missing signature'}
          return
        }

        if (!verifySignature(rawBody, signature, config.secret)) {
          // 需求 1.3, 9.2: 签名验证失败
          logger.warn('签名验证失败')
          koaCtx.status = 401
          koaCtx.body = {
            error: 'Invalid signature. Ensure Content-Type is application/json, and the signed payload matches the raw request body. 签名无效：请确认 Content-Type 为 application/json，且签名内容与实际请求体完全一致。'
          }
          return
        }
      }

      // 需求 1.5: 签名验证成功，继续处理

      // 解析 JSON 负载
      let payload: any
      try {
        payload = JSON.parse(rawBody)
      } catch (e) {
        logger.warn('无法解析 JSON 负载')
        koaCtx.status = 400
        koaCtx.body = {error: 'Invalid JSON payload'}
        return
      }

      // 获取仓库名
      const repo = payload.repository?.full_name
      if (!repo) {
        logger.warn('负载中缺少仓库信息')
        koaCtx.status = 400
        koaCtx.body = {error: 'Missing repository information'}
        return
      }

      // 需求 9.1: 记录仓库名
      logger.info(`收到 Webhook: [${repo}] ${eventName} (${deliveryId})`)

      // 需求 1.6: 去重检查
      if (deliveryId) {
        const isDuplicate = await isDelivered(ctx, deliveryId)
        if (isDuplicate) {
          logger.info(`跳过重复请求: ${deliveryId}`)
          koaCtx.status = 200
          koaCtx.body = {status: 'duplicate'} as WebhookResponse
          return
        }
      }

      // 需求 2.6: 信任仓库验证
      if (!config.allowUntrusted) {
        const trusted = await isTrusted(ctx, repo)
        if (!trusted) {
          // 需求 9.3: 记录非信任仓库事件
          logger.info(`忽略非信任仓库事件: ${repo}`)
          koaCtx.status = 200
          koaCtx.body = {status: 'ignored', reason: 'untrusted'} as WebhookResponse
          return
        }
      }

      // 解析事件
      const event = parseEvent(eventName, payload)
      if (!event) {
        logger.info(`不支持的事件类型: ${eventName}`)
        koaCtx.status = 200
        koaCtx.body = {status: 'ignored', reason: 'unsupported'} as WebhookResponse
        return
      }

      // 需求 1.6: 记录投递（在处理前记录，防止重复处理）
      if (deliveryId) {
        await recordDelivery(ctx, deliveryId, repo, eventName)
      }

      // 推送消息
      const result = await pushEvent(ctx, event, config.concurrency)

      // 需求 9.4: 记录推送结果
      const elapsed = Date.now() - startTime
      logger.info(`处理完成: 推送 ${result.pushed} 成功, ${result.failed} 失败 (${elapsed}ms)`)

      // 需求 1.5: 返回成功响应
      koaCtx.status = 200
      koaCtx.body = {status: 'ok', pushed: result.pushed} as WebhookResponse

    } catch (error) {
      // 需求 9.5: 记录错误
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`处理 Webhook 时发生错误: ${errorMessage}`)

      if (config.debug && error instanceof Error) {
        logger.error(error.stack || '')
      }

      koaCtx.status = 500
      koaCtx.body = {status: 'error', error: 'Internal server error'} as WebhookResponse
    }
  })
}

/**
 * 获取原始请求体
 * @param koaCtx Koa 上下文
 * @returns 原始请求体字符串
 */
async function getRawBody(koaCtx: any): Promise<string> {
  // 如果已经有解析好的 body，尝试重新序列化
  if (koaCtx.request.body) {
    return JSON.stringify(koaCtx.request.body)
  }

  // 否则从流中读取
  return new Promise((resolve, reject) => {
    let data = ''
    koaCtx.req.on('data', (chunk: Buffer) => {
      data += chunk.toString()
    })
    koaCtx.req.on('end', () => {
      resolve(data)
    })
    koaCtx.req.on('error', reject)
  })
}
