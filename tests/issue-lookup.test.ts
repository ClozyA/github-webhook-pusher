import {describe, expect, it, vi} from 'vitest'
import {h} from 'koishi'
import {registerIssueLookupCommands, screenshotIssue} from '../src/commands/issue-lookup'
import type {Config} from '../src/config'

vi.mock('koishi', () => ({
  h: vi.fn(),
  Logger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
  })),
}))

const config = {
  githubProxy: '',
  issueScreenshot: {
    enabled: true,
    timeout: 15000,
    viewportWidth: 1280,
  },
} as Config

describe('screenshotIssue', () => {
  it('rejects non-success page responses before taking a screenshot', async () => {
    const screenshot = vi.fn()
    const close = vi.fn()
    const page = {
      setViewport: vi.fn(),
      goto: vi.fn().mockResolvedValue({
        status: () => 504,
      }),
      waitForSelector: vi.fn(),
      evaluate: vi.fn(),
      screenshot,
      close,
    }
    const ctx = {
      puppeteer: {
        page: vi.fn().mockResolvedValue(page),
      },
    }

    await expect(screenshotIssue(ctx as any, 'AUTO-MAS-Project/AUTO-MAS', 166, config))
      .rejects
      .toThrow('HTTP 504')
    expect(screenshot).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })
})

describe('registerIssueLookupCommands', () => {
  function createCommandChain() {
    const chain = {
      usage: vi.fn(() => chain),
      example: vi.fn(() => chain),
      action: vi.fn(() => chain),
    }
    return chain
  }

  function createCtx(page?: any) {
    const middleware = vi.fn()
    const ctx = {
      command: vi.fn(() => createCommandChain()),
      middleware,
      puppeteer: page
        ? {
          page: vi.fn().mockResolvedValue(page),
        }
        : undefined,
    }
    return ctx
  }

  it('screenshots the first GitHub issue URL without requiring an issue binding', async () => {
    vi.mocked(h).mockReturnValue('image-element' as any)
    const page = {
      setViewport: vi.fn(),
      goto: vi.fn().mockResolvedValue({
        status: () => 200,
      }),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png')),
      close: vi.fn(),
    }
    const ctx = createCtx(page)
    registerIssueLookupCommands(ctx as any, config)
    const handler = ctx.middleware.mock.calls[0][0]
    const next = vi.fn()
    const session = {
      content: '看看这个 https://github.com/AUTO-MAS-Project/AUTO-MAS/issues/212 后面还有 https://github.com/other/repo/issues/1',
      platform: 'qq',
      channelId: '123',
      send: vi.fn(),
    }

    await handler(session, next)

    expect(next).not.toHaveBeenCalled()
    expect(page.goto).toHaveBeenCalledWith('https://github.com/AUTO-MAS-Project/AUTO-MAS/issues/212', {
      waitUntil: 'networkidle2',
      timeout: 15000,
    })
    expect(session.send).toHaveBeenCalledWith('正在截图...')
    expect(session.send).toHaveBeenCalledWith('image-element')
  })

  it('does not send a parsed link when GitHub issue URL screenshots are disabled', async () => {
    const ctx = createCtx()
    registerIssueLookupCommands(ctx as any, {
      ...config,
      issueScreenshot: {
        ...config.issueScreenshot,
        enabled: false,
      },
    })
    const handler = ctx.middleware.mock.calls[0][0]
    const next = vi.fn()
    const session = {
      content: 'https://github.com/AUTO-MAS-Project/AUTO-MAS/pull/212',
      platform: 'qq',
      channelId: '123',
      send: vi.fn(),
    }

    await handler(session, next)

    expect(next).not.toHaveBeenCalled()
    expect(session.send).not.toHaveBeenCalled()
  })

  it('screenshots GitHub pull request URLs through the issue page route', async () => {
    vi.mocked(h).mockReturnValue('image-element' as any)
    const page = {
      setViewport: vi.fn(),
      goto: vi.fn().mockResolvedValue({
        status: () => 200,
      }),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png')),
      close: vi.fn(),
    }
    const ctx = createCtx(page)
    registerIssueLookupCommands(ctx as any, config)
    const handler = ctx.middleware.mock.calls[0][0]
    const session = {
      content: 'https://github.com/AUTO-MAS-Project/AUTO-MAS/pull/212',
      platform: 'qq',
      channelId: '123',
      send: vi.fn(),
    }

    await handler(session, vi.fn())

    expect(page.goto).toHaveBeenCalledWith('https://github.com/AUTO-MAS-Project/AUTO-MAS/issues/212', {
      waitUntil: 'networkidle2',
      timeout: 15000,
    })
    expect(session.send).toHaveBeenCalledWith('image-element')
  })
})
