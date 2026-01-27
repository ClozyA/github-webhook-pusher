/**
 * 信任仓库数据访问层
 * 需求: 2.1-2.7
 */

import {Context} from 'koishi'
import {TrustedRepo} from '../database'

/** 仓库名格式验证正则表达式 */
const REPO_NAME_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/

/**
 * 验证仓库名格式是否符合 owner/repo 格式
 * @param repo 仓库名
 * @returns 是否有效
 */
export function isValidRepoFormat(repo: string): boolean {
  if (!repo || typeof repo !== 'string') {
    return false
  }
  return REPO_NAME_REGEX.test(repo)
}

/**
 * 添加信任仓库
 * 需求 2.1: 将仓库添加到信任列表并持久化到数据库
 * @param ctx Koishi 上下文
 * @param repo 仓库名 (owner/repo)
 * @returns 添加的仓库记录，如果格式错误返回 null
 */
export async function addTrustedRepo(ctx: Context, repo: string): Promise<TrustedRepo | null> {
  if (!isValidRepoFormat(repo)) {
    return null
  }

  const now = new Date()

  // 检查是否已存在
  const existing = await ctx.database.get('github_trusted_repos', {repo})
  if (existing.length > 0) {
    return existing[0]
  }

  await ctx.database.create('github_trusted_repos', {
    repo,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  })

  const [created] = await ctx.database.get('github_trusted_repos', {repo})
  return created
}

/**
 * 移除信任仓库
 * 需求 2.2: 从信任列表中移除该仓库
 * @param ctx Koishi 上下文
 * @param repo 仓库名 (owner/repo)
 * @returns 是否成功移除
 */
export async function removeTrustedRepo(ctx: Context, repo: string): Promise<boolean> {
  const result = await ctx.database.remove('github_trusted_repos', {repo})
  return (result.removed ?? 0) > 0
}


/**
 * 列出所有信任仓库
 * 需求 2.3: 显示所有信任仓库及其启用状态
 * @param ctx Koishi 上下文
 * @returns 信任仓库列表
 */
export async function listTrustedRepos(ctx: Context): Promise<TrustedRepo[]> {
  return ctx.database.get('github_trusted_repos', {})
}

/**
 * 检查仓库是否在信任列表中且已启用
 * 需求 2.6: 验证仓库是否可以处理事件
 * @param ctx Koishi 上下文
 * @param repo 仓库名 (owner/repo)
 * @returns 是否信任且启用
 */
export async function isTrusted(ctx: Context, repo: string): Promise<boolean> {
  const repos = await ctx.database.get('github_trusted_repos', {repo, enabled: true})
  return repos.length > 0
}

/**
 * 检查仓库是否在信任列表中（不考虑启用状态）
 * @param ctx Koishi 上下文
 * @param repo 仓库名 (owner/repo)
 * @returns 是否在信任列表中
 */
export async function isInTrustList(ctx: Context, repo: string): Promise<boolean> {
  const repos = await ctx.database.get('github_trusted_repos', {repo})
  return repos.length > 0
}

/**
 * 启用信任仓库
 * 需求 2.4: 启用该仓库的事件处理
 * @param ctx Koishi 上下文
 * @param repo 仓库名 (owner/repo)
 * @returns 是否成功启用
 */
export async function enableRepo(ctx: Context, repo: string): Promise<boolean> {
  const result = await ctx.database.set('github_trusted_repos', {repo}, {
    enabled: true,
    updatedAt: new Date(),
  })
  return (result.modified ?? 0) > 0
}

/**
 * 禁用信任仓库
 * 需求 2.5: 禁用该仓库的事件处理
 * @param ctx Koishi 上下文
 * @param repo 仓库名 (owner/repo)
 * @returns 是否成功禁用
 */
export async function disableRepo(ctx: Context, repo: string): Promise<boolean> {
  const result = await ctx.database.set('github_trusted_repos', {repo}, {
    enabled: false,
    updatedAt: new Date(),
  })
  return (result.modified ?? 0) > 0
}

/**
 * 获取单个信任仓库信息
 * @param ctx Koishi 上下文
 * @param repo 仓库名 (owner/repo)
 * @returns 仓库信息，不存在返回 null
 */
export async function getTrustedRepo(ctx: Context, repo: string): Promise<TrustedRepo | null> {
  const repos = await ctx.database.get('github_trusted_repos', {repo})
  return repos.length > 0 ? repos[0] : null
}
