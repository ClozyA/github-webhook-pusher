import {Context, h, Logger} from 'koishi'
import {Config} from '../config'
import {isValidRepoFormat} from '../repository'
import {getIssueBinding, removeIssueBinding, setIssueBinding} from '../repository'

const ISSUE_NUMBER_RE = /^#(\d+)$/
const logger = new Logger('github-issue-lookup')

function buildIssueUrl(repo: string, number: number, proxyUrl: string): string {
  const base = proxyUrl ? proxyUrl.replace(/\/$/, '') : 'https://github.com'
  if (proxyUrl) {
    return `${base}/${repo}/issues/${number}`
  }
  return `https://github.com/${repo}/issues/${number}`
}

async function screenshotIssue(
  ctx: Context,
  repo: string,
  number: number,
  config: Config
): Promise<Buffer | null> {
  const puppet = (ctx as any).puppeteer
  if (!puppet) return null

  const url = buildIssueUrl(repo, number, config.githubProxy)
  const width = config.issueScreenshot.viewportWidth || 1280
  const timeout = config.issueScreenshot.timeout || 15000

  const page = await puppet.page()
  try {
    await page.setViewport({width, height: 900})
    await page.goto(url, {waitUntil: 'networkidle2', timeout})

    // 等待 issue 主体内容加载
    await page.waitForSelector('.js-issue-title, .gh-header-title, [data-testid="issue-title"]', {timeout: 10000}).catch(() => {})

    // 等待页面内所有图片加载完成（包括头像、内嵌图片等）
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll('img'))
      await Promise.all(imgs.map(img => {
        if (img.complete) return Promise.resolve()
        return new Promise<void>(resolve => {
          img.addEventListener('load', () => resolve())
          img.addEventListener('error', () => resolve())
        })
      }))
    }).catch(() => {})

    // 隐藏与 issue/PR 内容无关的页面元素
    await page.evaluate(() => {
      const hide = (sel: string) => {
        document.querySelectorAll<HTMLElement>(sel).forEach(el => { el.style.display = 'none' })
      }
      hide('[data-testid="site-header"]')         // 新版已登录顶部导航
      hide('.AppHeader')                           // 新版已登录顶部导航（备用）
      hide('.HeaderMktg')                          // 未登录营销顶部导航
      hide('[class*="SignedOutBanner"]')           // 未登录横幅（CSS Module 类名）
      hide('[class*="menuActionsContainer"]')     // issue 头部操作按钮区（New issue、Copy link）
      hide('nav.js-repo-nav')                     // 仓库 tabs 导航栏
      hide('[data-testid="issue-viewer-metadata-container"]') // 新版右侧 metadata
      hide('.prc-PageLayout-PaneWrapper-pHPop')   // PR 右侧侧边栏（Reviewers/Labels 等）
      hide('#partial-discussion-sidebar')          // 旧版右侧侧边栏
      hide('#issue-comment-box')                   // 底部登录提示评论框
      hide('footer')
      hide('.footer')
    }).catch(() => {})

    // 全页截图
    return await page.screenshot({type: 'png', fullPage: true}) as Buffer
  } finally {
    await page.close()
  }
}

const ADMIN_AUTHORITY = 3

export function registerIssueLookupCommands(ctx: Context, config: Config) {
  // gh.bind <repo> - 为当前会话绑定仓库
  ctx.command('gh.bind <repo:string>', '绑定 Issues 查询仓库')
    .usage('gh.bind owner/repo')
    .example('gh.bind AUTO-MAS-Project/AUTO-MAS')
    .action(async ({session}, repo) => {
      if (!session) return '❌ 无法获取会话信息'
      const user = session.user as any
      if ((user?.authority ?? 0) < ADMIN_AUTHORITY) return '❌ 权限不足，需要管理员权限'
      if (!repo) return '❌ 请指定仓库名，格式: owner/repo'
      if (!isValidRepoFormat(repo)) return '❌ 仓库格式错误，请使用 owner/repo 格式'

      await setIssueBinding(ctx, {
        platform: session.platform as string,
        channelId: session.channelId as string,
        guildId: session.guildId ?? undefined,
        userId: session.userId ?? undefined,
      }, repo)

      return `✅ 已绑定 Issues 查询仓库: ${repo}\n💡 发送 #<编号> 即可查看对应 Issue`
    })

  // gh.unbind - 解绑当前会话的仓库
  ctx.command('gh.unbind', '解绑 Issues 查询仓库')
    .usage('gh.unbind')
    .action(async ({session}) => {
      if (!session) return '❌ 无法获取会话信息'
      const user = session.user as any
      if ((user?.authority ?? 0) < ADMIN_AUTHORITY) return '❌ 权限不足，需要管理员权限'

      const removed = await removeIssueBinding(ctx, {
        platform: session.platform as string,
        channelId: session.channelId as string,
      })

      return removed ? '✅ 已解绑 Issues 查询仓库' : '❌ 当前会话未绑定仓库'
    })

  // 消息中间件：拦截 #<number> 消息（始终注册，截图功能按配置降级）
  ctx.middleware(async (session, next) => {
    const content = session.content?.trim() ?? ''
    const m = ISSUE_NUMBER_RE.exec(content)
    if (!m) return next()

    const issueNumber = parseInt(m[1], 10)
    const binding = await getIssueBinding(ctx, {
      platform: session.platform as string,
      channelId: session.channelId as string,
    })
    if (!binding) return next()

    const url = buildIssueUrl(binding.repo, issueNumber, config.githubProxy)

    if (!config.issueScreenshot.enabled) {
      await session.send(`🔗 ${url}`)
      return
    }

    await session.send('正在截图...')
    try {
      const buf = await screenshotIssue(ctx, binding.repo, issueNumber, config)
      if (!buf) {
        logger.warn(`puppeteer 服务不可用，降级发链接`)
        await session.send(`🔗 ${url}`)
        return
      }
      const base64 = buf.toString('base64')
      await session.send(h('image', {url: `data:image/png;base64,${base64}`}))
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`截图 ${binding.repo}#${issueNumber} 失败: ${msg}`)
      await session.send(`❌ 获取 Issue #${issueNumber} 失败: ${msg}\n🔗 ${url}`)
    }
  })
}
