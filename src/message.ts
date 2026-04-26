/**
 * 消息构建器
 * 需求: 5.3, 5.4, 5.5
 */

import {Element, h} from 'koishi'
import {getEventEmoji, ParsedEvent} from './types'

/**
 * 构建推送消息
 * @param event 解析后的事件
 * @returns Koishi Element 消息数组
 */
export function buildMessage(event: ParsedEvent): Element[] {
  switch (event.type) {
    case 'issues':
      return buildIssuesMessage(event)
    case 'issue_comment':
      return buildIssueCommentMessage(event)
    case 'release':
      return buildReleaseMessage(event)
    case 'push':
      return buildPushMessage(event)
    case 'pull_request':
      return buildPullRequestMessage(event)
    case 'pull_request_review':
      return buildPullRequestReviewMessage(event)
    case 'pull_request_review_comment':
      return buildPullRequestReviewCommentMessage(event)
    case 'star':
      return buildStarMessage(event)
    case 'fork':
      return buildForkMessage(event)
    case 'create':
      return buildCreateMessage(event)
    case 'delete':
      return buildDeleteMessage(event)
    case 'workflow_run':
      return buildWorkflowRunMessage(event)
    default:
      return buildGenericMessage(event)
  }
}

/**
 * 构建 Issues 事件消息
 * 格式: 📌 [owner/repo] Issue
 *       user opened #123: Issue Title
 *       https://github.com/...
 */
function buildIssuesMessage(event: ParsedEvent): Element[] {
  const emoji = getEventEmoji(event.type)
  const actionText = getActionText(event.action)

  const lines = [
    `${emoji} [${event.repo}] ${event.displayType}`,
    `${event.actor} ${actionText} #${event.number}: ${event.title}`,
    event.url,
  ]

  return [h('text', {content: lines.join('\n')})]
}

function buildIssueCommentMessage(event: ParsedEvent): Element[] {
  const emoji = getEventEmoji(event.type)
  const actionText = getActionText(event.action)

  const lines = [
    `${emoji} [${event.repo}] ${event.displayType}`,
    `${event.actor} ${actionText} #${event.number}: ${event.title}`,
  ]

  appendBody(lines, event.body)
  lines.push(event.url)

  return [h('text', {content: lines.join('\n')})]
}

/**
 * 构建 Release 事件消息
 * 格式: 🚀 [owner/repo] Release
 *       user published v1.0.0
 *       https://github.com/...
 */
function buildReleaseMessage(event: ParsedEvent): Element[] {
  const emoji = getEventEmoji(event.type)
  const actionText = getActionText(event.action)

  const lines = [
    `${emoji} [${event.repo}] ${event.displayType}`,
    `${event.actor} ${actionText} ${event.tagName || event.title}`,
    event.url,
  ]

  return [h('text', {content: lines.join('\n')})]
}


/**
 * 构建 Push 事件消息
 * 格式: ⬆️ [owner/repo] Commit
 *       user 推送了 3 个提交到 main
 *
 *       • abc1234 - 提交消息1
 *       • def5678 - 提交消息2
 *       • ghi9012 - 提交消息3
 *
 *       还有 2 条提交...
 *       https://github.com/...
 */
function buildPushMessage(event: ParsedEvent): Element[] {
  const emoji = getEventEmoji(event.type)
  const commits = event.commits || []
  const totalCommits = event.totalCommits || commits.length

  const lines: string[] = [
    `${emoji} [${event.repo}] ${event.displayType}`,
    `${event.actor} 推送了 ${totalCommits} 个提交到 ${event.ref}`,
    '',
  ]

  // 添加提交列表
  for (const commit of commits) {
    lines.push(`• ${commit.sha} - ${commit.message}`)
  }

  // 如果有更多提交，显示提示
  if (totalCommits > commits.length) {
    lines.push('')
    lines.push(`还有 ${totalCommits - commits.length} 条提交...`)
  }

  lines.push(event.url)

  return [h('text', {content: lines.join('\n')})]
}

/**
 * 构建 Pull Request 事件消息
 * 格式: 🔀 [owner/repo] PR
 *       user opened #123: PR Title
 *       https://github.com/...
 */
function buildPullRequestMessage(event: ParsedEvent): Element[] {
  const emoji = getEventEmoji(event.type)
  const actionText = getActionText(event.action)

  const lines = [
    `${emoji} [${event.repo}] ${event.displayType}`,
    `${event.actor} ${actionText} #${event.number}: ${event.title}`,
    event.url,
  ]

  return [h('text', {content: lines.join('\n')})]
}

function buildPullRequestReviewMessage(event: ParsedEvent): Element[] {
  const emoji = getEventEmoji(event.type)
  const actionText = getActionText(event.action)

  const lines = [
    `${emoji} [${event.repo}] ${event.displayType}`,
    `${event.actor} ${actionText} #${event.number}: ${event.title}`,
  ]

  appendBody(lines, event.body)
  lines.push(event.url)

  return [h('text', {content: lines.join('\n')})]
}

function buildPullRequestReviewCommentMessage(event: ParsedEvent): Element[] {
  const emoji = getEventEmoji(event.type)
  const actionText = getActionText(event.action)

  const lines = [
    `${emoji} [${event.repo}] ${event.displayType}`,
    `${event.actor} ${actionText} #${event.number}: ${event.title}`,
  ]

  appendBody(lines, event.body)
  lines.push(event.url)

  return [h('text', {content: lines.join('\n')})]
}

/**
 * 构建 Star 事件消息
 * 格式: ⭐ [owner/repo] Star
 *       user starred (⭐ 1234)
 *       https://github.com/...
 */
function buildStarMessage(event: ParsedEvent): Element[] {
  const emoji = getEventEmoji(event.type)
  const actionText = event.action === 'created' ? 'starred' : 'unstarred'

  const lines = [
    `${emoji} [${event.repo}] ${event.displayType}`,
    `${event.actor} ${actionText} (⭐ ${event.starCount})`,
    event.url,
  ]

  return [h('text', {content: lines.join('\n')})]
}

function buildForkMessage(event: ParsedEvent): Element[] {
  const emoji = getEventEmoji(event.type)
  const target = event.title ? ` -> ${event.title}` : ''

  const lines = [
    `${emoji} [${event.repo}] ${event.displayType}`,
    `${event.actor} forked${target}`,
    event.url,
  ]

  return [h('text', {content: lines.join('\n')})]
}

function buildCreateMessage(event: ParsedEvent): Element[] {
  const emoji = getEventEmoji(event.type)
  const actionText = getActionText(event.action)
  const refText = event.ref ? ` ${event.ref}` : ''

  const lines = [
    `${emoji} [${event.repo}] ${event.displayType}`,
    `${event.actor} ${actionText}${refText}`,
    event.url,
  ]

  return [h('text', {content: lines.join('\n')})]
}

function buildDeleteMessage(event: ParsedEvent): Element[] {
  const emoji = getEventEmoji(event.type)
  const actionText = getActionText(event.action)
  const refText = event.ref ? ` ${event.ref}` : ''

  const lines = [
    `${emoji} [${event.repo}] ${event.displayType}`,
    `${event.actor} ${actionText}${refText}`,
    event.url,
  ]

  return [h('text', {content: lines.join('\n')})]
}

function buildWorkflowRunMessage(event: ParsedEvent): Element[] {
  const emoji = getEventEmoji(event.type)
  const actionText = getActionText(event.action)
  const nameText = event.title ? ` ${event.title}` : ''

  const lines = [
    `${emoji} [${event.repo}] ${event.displayType}`,
    `${event.actor} ${actionText}${nameText}`,
    event.url,
  ]

  return [h('text', {content: lines.join('\n')})]
}

/**
 * 构建通用事件消息（兜底）
 */
function buildGenericMessage(event: ParsedEvent): Element[] {
  const emoji = getEventEmoji(event.type)

  const lines = [
    `${emoji} [${event.repo}] ${event.displayType}`,
    `${event.actor} ${event.action || 'triggered'}`,
    event.url,
  ]

  return [h('text', {content: lines.join('\n')})]
}

/** 评论正文最大显示长度 */
const MAX_BODY_LENGTH = 500

/**
 * 将评论正文追加到消息行中，超长截断并加省略号
 */
function appendBody(lines: string[], body?: string): void {
  if (!body) return
  const trimmed = body.trim()
  if (!trimmed) return

  const content = trimmed.length > MAX_BODY_LENGTH
    ? trimmed.slice(0, MAX_BODY_LENGTH) + '...'
    : trimmed

  lines.push('')
  lines.push(content)
  lines.push('')
}

/**
 * 获取动作的中文描述
 */
function getActionText(action?: string): string {
  const actionMap: Record<string, string> = {
    opened: 'opened',
    closed: 'closed',
    reopened: 'reopened',
    edited: 'edited',
    merged: 'merged',
    published: 'published',
    created: 'created',
    deleted: 'deleted',
    submitted: 'submitted',
    dismissed: 'dismissed',
    approved: 'approved',
    changes_requested: 'changes requested',
    commented: 'commented',
    requested: 'requested',
    completed: 'completed',
    forked: 'forked',
  }

  return actionMap[action || ''] || action || ''
}
