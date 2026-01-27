/**
 * 信任仓库管理命令
 * 需求: 2.1-2.5, 8.3
 */

import {Context} from 'koishi'
import {
  addTrustedRepo,
  removeTrustedRepo,
  listTrustedRepos,
  enableRepo,
  disableRepo,
  isValidRepoFormat,
} from '../repository/trust'

/** 管理员权限等级 */
const ADMIN_AUTHORITY = 3

/** 用户类型（用于权限检查） */
interface User {
  authority?: number
}

/**
 * 注册信任仓库管理命令
 * @param ctx Koishi 上下文
 */
export function registerTrustCommands(ctx: Context) {
  // 创建 gh.trust 命令组
  const trust = ctx.command('gh.trust', '管理信任的 GitHub 仓库')
    .usage('gh.trust <add|remove|list|enable|disable> [repo]')

  // gh.trust.add <repo> - 添加信任仓库
  trust.subcommand('.add <repo:string>', '添加信任仓库')
    .usage('gh.trust.add owner/repo')
    .example('gh.trust.add koishijs/koishi')
    .action(async ({session}, repo) => {
      // 权限检查
      const user = session?.user as User | undefined
      if ((user?.authority ?? 0) < ADMIN_AUTHORITY) {
        return '❌ 权限不足，需要管理员权限'
      }

      if (!repo) {
        return '❌ 请指定仓库名，格式: owner/repo'
      }

      // 格式验证
      if (!isValidRepoFormat(repo)) {
        return '❌ 仓库格式错误，请使用 owner/repo 格式'
      }

      const result = await addTrustedRepo(ctx, repo)
      if (result) {
        return `✅ 已添加信任仓库: ${repo}`
      }
      return '❌ 添加失败'
    })

  // gh.trust.remove <repo> - 移除信任仓库
  trust.subcommand('.remove <repo:string>', '移除信任仓库')
    .usage('gh.trust.remove owner/repo')
    .example('gh.trust.remove koishijs/koishi')
    .action(async ({session}, repo) => {
      // 权限检查
      const user = session?.user as User | undefined
      if ((user?.authority ?? 0) < ADMIN_AUTHORITY) {
        return '❌ 权限不足，需要管理员权限'
      }

      if (!repo) {
        return '❌ 请指定仓库名'
      }

      const success = await removeTrustedRepo(ctx, repo)
      if (success) {
        return `✅ 已移除信任仓库: ${repo}`
      }
      return `❌ 仓库 ${repo} 不在信任列表中`
    })


  // gh.trust.list - 列出所有信任仓库
  trust.subcommand('.list', '列出所有信任仓库')
    .usage('gh.trust.list')
    .action(async ({session}) => {
      // 权限检查
      const user = session?.user as User | undefined
      if ((user?.authority ?? 0) < ADMIN_AUTHORITY) {
        return '❌ 权限不足，需要管理员权限'
      }

      const repos = await listTrustedRepos(ctx)
      if (repos.length === 0) {
        return '📋 信任仓库列表为空'
      }

      const lines = ['📋 信任仓库列表:']
      for (const repo of repos) {
        const status = repo.enabled ? '✅' : '⏸️'
        lines.push(`${status} ${repo.repo}`)
      }
      return lines.join('\n')
    })

  // gh.trust.enable <repo> - 启用信任仓库
  trust.subcommand('.enable <repo:string>', '启用信任仓库')
    .usage('gh.trust.enable owner/repo')
    .example('gh.trust.enable koishijs/koishi')
    .action(async ({session}, repo) => {
      // 权限检查
      const user = session?.user as User | undefined
      if ((user?.authority ?? 0) < ADMIN_AUTHORITY) {
        return '❌ 权限不足，需要管理员权限'
      }

      if (!repo) {
        return '❌ 请指定仓库名'
      }

      const success = await enableRepo(ctx, repo)
      if (success) {
        return `✅ 已启用仓库: ${repo}`
      }
      return `❌ 仓库 ${repo} 不在信任列表中`
    })

  // gh.trust.disable <repo> - 禁用信任仓库
  trust.subcommand('.disable <repo:string>', '禁用信任仓库')
    .usage('gh.trust.disable owner/repo')
    .example('gh.trust.disable koishijs/koishi')
    .action(async ({session}, repo) => {
      // 权限检查
      const user = session?.user as User | undefined
      if ((user?.authority ?? 0) < ADMIN_AUTHORITY) {
        return '❌ 权限不足，需要管理员权限'
      }

      if (!repo) {
        return '❌ 请指定仓库名'
      }

      const success = await disableRepo(ctx, repo)
      if (success) {
        return `⏸️ 已禁用仓库: ${repo}`
      }
      return `❌ 仓库 ${repo} 不在信任列表中`
    })
}
