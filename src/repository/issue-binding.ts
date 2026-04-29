import {Context} from 'koishi'
import {IssueBinding} from '../database'

export interface BindingIdentifier {
  platform: string
  channelId: string
  guildId?: string
  userId?: string
}

export async function getIssueBinding(
  ctx: Context,
  session: BindingIdentifier
): Promise<IssueBinding | null> {
  const rows = await ctx.database.get('github_issue_bindings', {
    platform: session.platform,
    channelId: session.channelId,
  })
  return rows.length > 0 ? rows[0] : null
}

export async function setIssueBinding(
  ctx: Context,
  session: BindingIdentifier,
  repo: string
): Promise<void> {
  const now = new Date()
  const existing = await ctx.database.get('github_issue_bindings', {
    platform: session.platform,
    channelId: session.channelId,
  })

  if (existing.length > 0) {
    await ctx.database.set('github_issue_bindings', {
      platform: session.platform,
      channelId: session.channelId,
    }, {repo, updatedAt: now})
  } else {
    await ctx.database.create('github_issue_bindings', {
      platform: session.platform,
      channelId: session.channelId,
      guildId: session.guildId || '',
      userId: session.userId || '',
      repo,
      createdAt: now,
      updatedAt: now,
    })
  }
}

export async function removeIssueBinding(
  ctx: Context,
  session: BindingIdentifier
): Promise<boolean> {
  const result = await ctx.database.remove('github_issue_bindings', {
    platform: session.platform,
    channelId: session.channelId,
  })
  return (result.removed ?? 0) > 0
}
