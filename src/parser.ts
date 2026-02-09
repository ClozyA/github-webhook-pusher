/**
 * GitHub Webhook 事件解析器
 * 需求: 4.1-4.7
 */

import {CommitInfo, getDisplayType, ParsedEvent} from './types'

/** Push 事件最大显示提交数 */
const MAX_COMMITS = 3

/**
 * 解析 Issues 事件
 * 需求 4.1: 提取 issue 标题、编号、操作者和链接
 */
export function parseIssuesEvent(payload: any): ParsedEvent | null {
  const {action, issue, repository, sender} = payload

  // 只处理 opened/closed/reopened/edited 动作
  if (!['opened', 'closed', 'reopened', 'edited'].includes(action)) {
    return null
  }

  return {
    type: 'issues',
    displayType: getDisplayType('issues'),
    repo: repository.full_name,
    actor: sender.login,
    action,
    title: issue.title,
    number: issue.number,
    url: issue.html_url,
    body: issue.body,
  }
}

/**
 * 解析 Issue Comment 事件
 */
export function parseIssueCommentEvent(payload: any): ParsedEvent | null {
  const {action, issue, comment, repository, sender} = payload

  // 只处理 created/edited/deleted 动作
  if (!['created', 'edited', 'deleted'].includes(action)) {
    return null
  }

  return {
    type: 'issue_comment',
    displayType: getDisplayType('issue_comment'),
    repo: repository.full_name,
    actor: sender.login,
    action,
    title: issue.title,
    number: issue.number,
    url: comment?.html_url || issue.html_url,
    body: comment?.body,
  }
}

/**
 * 解析 Release 事件
 * 需求 4.2: 提取版本号、发布者和下载链接
 */
export function parseReleaseEvent(payload: any): ParsedEvent | null {
  const {action, release, repository, sender} = payload

  // 只处理 published/created 动作
  if (!['published', 'created'].includes(action)) {
    return null
  }

  return {
    type: 'release',
    displayType: getDisplayType('release'),
    repo: repository.full_name,
    actor: sender.login,
    action,
    title: release.name || release.tag_name,
    tagName: release.tag_name,
    url: release.html_url,
    body: release.body,
  }
}


/**
 * 解析 Push 事件
 * 需求 4.3, 4.6: 提取分支名、提交列表（最多5条）和推送者信息
 */
export function parsePushEvent(payload: any): ParsedEvent | null {
  const {ref, commits, repository, sender, compare, created, deleted} = payload

  // 提取分支名（去掉 refs/heads/ 前缀）
  const branch = ref?.replace('refs/heads/', '') || ''

  if ((!commits || commits.length === 0) && (created || deleted)) {
    const actionText = created ? '创建分支' : '删除分支'
    const type = created ? 'create' : 'delete'

    return {
      type,
      displayType: getDisplayType(type),
      repo: repository.full_name,
      actor: sender.login,
      action: actionText,
      ref: branch,
      url: repository.html_url,
    }
  }

  // 解析提交列表
  const allCommits: CommitInfo[] = (commits || []).map((commit: any) => ({
    sha: commit.id?.substring(0, 7) || '',
    message: commit.message?.split('\n')[0] || '',  // 只取第一行
    author: commit.author?.name || commit.author?.username || '',
    url: commit.url || '',
  }))

  // 截断到最多 MAX_COMMITS 条
  const displayCommits = allCommits.slice(0, MAX_COMMITS)

  return {
    type: 'push',
    displayType: getDisplayType('push'),  // 显示为 "Commit"
    repo: repository.full_name,
    actor: sender.login,
    ref: branch,
    commits: displayCommits,
    totalCommits: allCommits.length,
    url: compare || `https://github.com/${repository.full_name}`,
  }
}

/**
 * 解析 Pull Request 事件
 * 需求 4.4: 提取 PR 标题、编号、操作者和链接
 */
export function parsePullRequestEvent(payload: any): ParsedEvent | null {
  const {action, pull_request, repository, sender} = payload

  // 只处理 opened/closed/merged 动作
  // 注意: merged 实际上是 closed + merged 标志
  const validActions = ['opened', 'closed', 'reopened', 'edited']
  if (!validActions.includes(action)) {
    return null
  }

  // 判断是否为合并
  const actualAction = action === 'closed' && pull_request.merged ? 'merged' : action

  return {
    type: 'pull_request',
    displayType: getDisplayType('pull_request'),
    repo: repository.full_name,
    actor: sender.login,
    action: actualAction,
    title: pull_request.title,
    number: pull_request.number,
    url: pull_request.html_url,
    body: pull_request.body,
  }
}

/**
 * 解析 Pull Request Review 事件
 */
export function parsePullRequestReviewEvent(payload: any): ParsedEvent | null {
  const {action, review, pull_request, repository, sender} = payload

  // 只处理 submitted/edited/dismissed 动作
  if (!['submitted', 'edited', 'dismissed'].includes(action)) {
    return null
  }

  return {
    type: 'pull_request_review',
    displayType: getDisplayType('pull_request_review'),
    repo: repository.full_name,
    actor: sender.login,
    action: review?.state || action,
    title: pull_request.title,
    number: pull_request.number,
    url: review?.html_url || pull_request.html_url,
    body: review?.body,
  }
}

/**
 * 解析 Pull Request Review Comment 事件
 */
export function parsePullRequestReviewCommentEvent(payload: any): ParsedEvent | null {
  const {action, comment, pull_request, repository, sender} = payload

  // 只处理 created/edited/deleted 动作
  if (!['created', 'edited', 'deleted'].includes(action)) {
    return null
  }

  return {
    type: 'pull_request_review_comment',
    displayType: getDisplayType('pull_request_review_comment'),
    repo: repository.full_name,
    actor: sender.login,
    action,
    title: pull_request.title,
    number: pull_request.number,
    url: comment?.html_url || pull_request.html_url,
    body: comment?.body,
  }
}

/**
 * 解析 Star 事件
 * 需求 4.5: 提取操作者和当前 star 数量
 */
export function parseStarEvent(payload: any): ParsedEvent | null {
  const {action, repository, sender} = payload

  // star 事件只有 created 和 deleted 动作
  if (!['created', 'deleted'].includes(action)) {
    return null
  }

  return {
    type: 'star',
    displayType: getDisplayType('star'),
    repo: repository.full_name,
    actor: sender.login,
    action,
    starCount: repository.stargazers_count,
    url: repository.html_url,
  }
}

/**
 * 解析 Fork 事件
 */
export function parseForkEvent(payload: any): ParsedEvent | null {
  const {forkee, repository, sender} = payload

  return {
    type: 'fork',
    displayType: getDisplayType('fork'),
    repo: repository.full_name,
    actor: sender.login,
    action: 'forked',
    title: forkee?.full_name,
    url: forkee?.html_url || repository.html_url,
  }
}

/**
 * 解析 Create 事件
 */
export function parseCreateEvent(payload: any): ParsedEvent | null {
  const {ref, ref_type, repository, sender} = payload

  return {
    type: 'create',
    displayType: getDisplayType('create'),
    repo: repository.full_name,
    actor: sender.login,
    action: 'created',
    ref: ref ? `${ref_type}:${ref}` : ref_type,
    url: repository.html_url,
  }
}

/**
 * 解析 Delete 事件
 */
export function parseDeleteEvent(payload: any): ParsedEvent | null {
  const {ref, ref_type, repository, sender} = payload

  return {
    type: 'delete',
    displayType: getDisplayType('delete'),
    repo: repository.full_name,
    actor: sender.login,
    action: 'deleted',
    ref: ref ? `${ref_type}:${ref}` : ref_type,
    url: repository.html_url,
  }
}

/**
 * 解析 Workflow Run 事件
 */
export function parseWorkflowRunEvent(payload: any): ParsedEvent | null {
  const {action, workflow_run, repository, sender} = payload

  // 只处理 requested/completed 动作
  if (!['requested', 'completed'].includes(action)) {
    return null
  }

  const conclusion = workflow_run?.conclusion ? `/${workflow_run.conclusion}` : ''

  return {
    type: 'workflow_run',
    displayType: getDisplayType('workflow_run'),
    repo: repository.full_name,
    actor: sender.login,
    action: `${action}${conclusion}`,
    title: workflow_run?.name,
    url: workflow_run?.html_url || repository.html_url,
  }
}

/**
 * 统一的事件解析入口函数
 * @param eventName X-GitHub-Event 头的值
 * @param payload 解析后的 JSON 负载
 * @returns 解析后的事件数据，不支持的事件返回 null
 */
export function parseEvent(eventName: string, payload: any): ParsedEvent | null {
  switch (eventName) {
    case 'issues':
      return parseIssuesEvent(payload)
    case 'issue_comment':
      return parseIssueCommentEvent(payload)
    case 'release':
      return parseReleaseEvent(payload)
    case 'push':
      return parsePushEvent(payload)
    case 'pull_request':
      return parsePullRequestEvent(payload)
    case 'pull_request_review':
      return parsePullRequestReviewEvent(payload)
    case 'pull_request_review_comment':
      return parsePullRequestReviewCommentEvent(payload)
    case 'star':
      return parseStarEvent(payload)
    case 'fork':
      return parseForkEvent(payload)
    case 'create':
      return parseCreateEvent(payload)
    case 'delete':
      return parseDeleteEvent(payload)
    case 'workflow_run':
      return parseWorkflowRunEvent(payload)
    default:
      return null
  }
}
