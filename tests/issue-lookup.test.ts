import {describe, expect, it, vi} from 'vitest'
import {screenshotIssue} from '../src/commands/issue-lookup'
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
