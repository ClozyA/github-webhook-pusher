import {Schema} from 'koishi'
import {EventType} from './types'

export {EventType}

export interface Config {
  /** Webhook 接收路径 */
  path: string
  /** GitHub Webhook Secret */
  secret: string
  /** 默认订阅事件 */
  defaultEvents: EventType[]
  /** 调试模式 */
  debug: boolean
  /** 允许非信任仓库 */
  allowUntrusted: boolean
  /** 推送并发数 */
  concurrency: number
  /** 投递记录保留天数（<=0 表示不清理） */
  deliveryRetentionDays: number
  /** 投递记录清理间隔（小时） */
  deliveryCleanupIntervalHours: number
}

/** 支持的事件类型列表 */
const EVENT_TYPES: EventType[] = [
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

export const Config: Schema<Config> = Schema.object({
  path: Schema.string().default('/github/webhook').description('Webhook 接收路径'),
  secret: Schema.string().required().description('GitHub Webhook Secret'),
  defaultEvents: Schema.array(Schema.union(EVENT_TYPES.map(e => Schema.const(e))))
    .default(['issues', 'release', 'push'] as EventType[])
    .description('默认订阅事件'),
  debug: Schema.boolean().default(false).description('调试模式'),
  allowUntrusted: Schema.boolean().default(false).description('允许非信任仓库'),
  concurrency: Schema.number().default(5).description('推送并发数'),
  deliveryRetentionDays: Schema.number().default(30).description('投递记录保留天数（<=0 表示不清理）'),
  deliveryCleanupIntervalHours: Schema.number().default(24).description('投递记录清理间隔（小时）'),
}) as Schema<Config>
