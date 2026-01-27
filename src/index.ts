import { Context } from 'koishi'
import { Config } from './config'
import { extendDatabase } from './database'

export const name = 'push-github-webhook'

export { Config }

export function apply(ctx: Context, config: Config) {
  // 初始化数据库
  extendDatabase(ctx)
  
  ctx.logger.info('GitHub Webhook 推送插件已加载')
}
