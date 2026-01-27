import {Context} from 'koishi'
import {Config} from './config'
import {extendDatabase} from './database'
import {registerWebhook} from './webhook'

export const name = 'push-github-webhook'

// 声明服务依赖 - 需要 server 服务提供 router
export const inject = ['server']

export {Config}

export function apply(ctx: Context, config: Config) {
  // 初始化数据库
  extendDatabase(ctx)

  // 注册 Webhook 处理器
  registerWebhook(ctx, config)

  ctx.logger.info('GitHub Webhook 推送插件已加载')
}
