import {Context} from 'koishi'
import {EventType} from './types'

declare module 'koishi' {
  interface Tables {
    github_trusted_repos: TrustedRepo
    github_subscriptions: Subscription
    github_deliveries: Delivery
  }
}

export interface TrustedRepo {
  id: number
  repo: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Subscription {
  id: number
  platform: string
  channelId: string
  guildId: string
  userId: string
  repo: string
  events: EventType[]  // JSON 序列化
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Delivery {
  deliveryId: string
  repo: string
  event: string
  receivedAt: Date
}

export function extendDatabase(ctx: Context) {
  ctx.model.extend('github_trusted_repos', {
    id: {type: 'unsigned', length: 10},
    repo: {type: 'string', length: 255},
    enabled: 'boolean',
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
  }, {
    primary: 'id',
    autoInc: true,
    unique: ['repo'],
  })

  ctx.model.extend('github_subscriptions', {
    id: {type: 'unsigned', length: 10},
    platform: 'string',
    channelId: 'string',
    guildId: 'string',
    userId: 'string',
    repo: 'string',
    events: 'json',
    enabled: 'boolean',
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
  }, {
    primary: 'id',
    autoInc: true,
  })

  ctx.model.extend('github_deliveries', {
    deliveryId: 'string',
    repo: 'string',
    event: 'string',
    receivedAt: 'timestamp',
  }, {
    primary: 'deliveryId',
  })
}
