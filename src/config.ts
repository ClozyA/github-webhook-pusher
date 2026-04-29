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
  /** GitHub 访问代理前缀（用于 Issues 链接和截图），留空直连 */
  githubProxy: string
  /** Issues 截图配置 */
  issueScreenshot: IssueScreenshotConfig
}

export interface IssueScreenshotConfig {
  /** 是否启用截图功能 */
  enabled: boolean
  /** 页面加载超时时间（毫秒） */
  timeout: number
  /** 截图视口宽度（像素） */
  viewportWidth: number
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
  githubProxy: Schema.string().default('').description('GitHub 访问代理前缀，如 https://gh.072118.xyz（结尾不加斜杠），留空直连 github.com'),
  issueScreenshot: Schema.object({
    enabled: Schema.boolean().default(false).description('启用 Issues 截图功能（需要安装 puppeteer 服务）'),
    timeout: Schema.number().default(15000).description('页面加载超时（毫秒）'),
    viewportWidth: Schema.number().default(1280).description('截图视口宽度（像素）'),
  }).description('Issues 截图配置'),
}) as Schema<Config>
