import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {pushMessage, shouldUseForwardMessage, type PushOptions} from '../src/pusher'
import type {ParsedEvent} from '../src/types'

const {queryTargetsMock} = vi.hoisted(() => ({
  queryTargetsMock: vi.fn(),
}))

vi.mock('../src/repository/subscription', () => ({
  queryTargets: queryTargetsMock,
}))

vi.mock('koishi', () => ({
  h: (
    type: string,
    attrs: Record<string, unknown> = {},
    children: unknown[] = []
  ) => ({type, attrs, children}),
  Logger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

const groupTarget = {
  platform: 'onebot',
  channelId: '123456',
  guildId: '123456',
}

const privateTarget = {
  platform: 'onebot',
  channelId: 'private:654321',
  userId: '654321',
}

const options: PushOptions = {
  concurrency: 5,
  forwardPrivateMessages: false,
  forwardGroupMessages: false,
  forwardBatchSeconds: 3,
}

function createEvent(actor: string, action: 'created' | 'deleted' = 'created'): ParsedEvent {
  return {
    type: 'star',
    displayType: 'Star',
    repo: 'AUTO-MAS-Project/AUTO-MAS',
    actor,
    action,
    url: 'https://github.com/AUTO-MAS-Project/AUTO-MAS',
    starCount: action === 'created' ? 1234 : 1233,
  }
}

function createContext(sendMessage = vi.fn().mockResolvedValue([])) {
  return {
    bots: [{platform: 'onebot', sendMessage}],
    setTimeout(callback: () => void, delay: number) {
      const timer = setTimeout(callback, delay)
      return () => clearTimeout(timer)
    },
  }
}

describe('forward target selection', () => {
  it('uses independent switches for private and group conversations', () => {
    expect(shouldUseForwardMessage(groupTarget, {
      forwardPrivateMessages: true,
      forwardGroupMessages: false,
    })).toBe(false)
    expect(shouldUseForwardMessage(privateTarget, {
      forwardPrivateMessages: true,
      forwardGroupMessages: false,
    })).toBe(true)
  })
})

describe('pushMessage forward batching', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    queryTargetsMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('keeps the existing plain-text behavior when group forwarding is disabled', async () => {
    const sendMessage = vi.fn().mockResolvedValue([])
    const ctx = createContext(sendMessage)
    queryTargetsMock.mockResolvedValue([groupTarget])

    const results = await pushMessage(ctx as any, createEvent('ClozyA'), options)

    expect(results).toEqual([{target: groupTarget, success: true}])
    expect(sendMessage).toHaveBeenCalledOnce()
    expect(sendMessage.mock.calls[0][1][0]).toMatchObject({type: 'text'})
  })

  it('collects events arriving in the fixed window into one group forward', async () => {
    const sendMessage = vi.fn().mockResolvedValue([])
    const ctx = createContext(sendMessage)
    const forwardOptions = {...options, forwardGroupMessages: true}
    queryTargetsMock
      .mockResolvedValueOnce([{...groupTarget, userId: 'subscriber-a'}])
      .mockResolvedValueOnce([{...groupTarget, userId: 'subscriber-b'}])

    const first = await pushMessage(ctx as any, createEvent('ClozyA'), forwardOptions)
    await vi.advanceTimersByTimeAsync(2000)
    const second = await pushMessage(
      ctx as any,
      createEvent('octocat', 'deleted'),
      forwardOptions
    )

    expect(first[0].queued).toBe(true)
    expect(second[0].queued).toBe(true)
    expect(sendMessage).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(999)
    expect(sendMessage).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(sendMessage).toHaveBeenCalledOnce()
    expect(sendMessage).toHaveBeenCalledWith(
      groupTarget.channelId,
      expect.any(Array),
      groupTarget.guildId
    )

    const [forward] = sendMessage.mock.calls[0][1]
    expect(forward).toMatchObject({type: 'message', attrs: {forward: true}})
    expect(forward.children).toHaveLength(2)
  })

  it('sends private forwards immediately when the window is zero', async () => {
    const sendMessage = vi.fn().mockResolvedValue([])
    const ctx = createContext(sendMessage)
    queryTargetsMock.mockResolvedValue([privateTarget])

    const results = await pushMessage(ctx as any, createEvent('ClozyA'), {
      ...options,
      forwardPrivateMessages: true,
      forwardBatchSeconds: 0,
    })

    expect(results[0].queued).toBeUndefined()
    expect(sendMessage).toHaveBeenCalledOnce()
    expect(sendMessage.mock.calls[0][1][0]).toMatchObject({
      type: 'message',
      attrs: {forward: true},
    })
  })

  it('falls back for an immediate private forward when the window is zero', async () => {
    const sendMessage = vi.fn()
      .mockRejectedValueOnce(new Error('forward is unavailable'))
      .mockResolvedValueOnce([])
    const ctx = createContext(sendMessage)
    queryTargetsMock.mockResolvedValue([privateTarget])

    const results = await pushMessage(ctx as any, createEvent('ClozyA'), {
      ...options,
      forwardPrivateMessages: true,
      forwardBatchSeconds: 0,
    })

    expect(results).toEqual([{target: privateTarget, success: true}])
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(sendMessage.mock.calls[1][1][0]).toMatchObject({type: 'text'})
  })

  it('keeps batches from different conversations separate', async () => {
    const sendMessage = vi.fn().mockResolvedValue([])
    const ctx = createContext(sendMessage)
    const otherTarget = {...groupTarget, channelId: '789012', guildId: '789012'}
    const forwardOptions = {...options, forwardGroupMessages: true}
    queryTargetsMock
      .mockResolvedValueOnce([groupTarget])
      .mockResolvedValueOnce([otherTarget])

    await pushMessage(ctx as any, createEvent('ClozyA'), forwardOptions)
    await pushMessage(ctx as any, createEvent('octocat'), forwardOptions)
    await vi.advanceTimersByTimeAsync(3000)

    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(sendMessage.mock.calls.map(call => call[0]).sort()).toEqual([
      groupTarget.channelId,
      otherTarget.channelId,
    ].sort())
  })

  it('falls back to one combined text message when forwarding fails', async () => {
    const sendMessage = vi.fn()
      .mockRejectedValueOnce(new Error('forward is unavailable'))
      .mockResolvedValueOnce([])
    const ctx = createContext(sendMessage)
    const forwardOptions = {...options, forwardGroupMessages: true}
    queryTargetsMock.mockResolvedValue([groupTarget])

    await pushMessage(ctx as any, createEvent('ClozyA'), forwardOptions)
    await pushMessage(ctx as any, createEvent('octocat', 'deleted'), forwardOptions)
    await vi.advanceTimersByTimeAsync(3000)

    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(sendMessage.mock.calls[1][1][0]).toMatchObject({type: 'text'})
    expect(sendMessage.mock.calls[1][1][0].attrs.content).toContain('──────────')
  })
})
