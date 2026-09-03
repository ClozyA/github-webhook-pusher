import {describe, expect, it, vi} from 'vitest'
import {buildBatchFallbackMessage, buildForwardMessage, buildMessage} from '../src/message'
import {ParsedEvent} from '../src/types'

vi.mock('koishi', () => ({
  Element: class Element {},
  h: (
    type: string,
    attrs: Record<string, unknown> = {},
    children: unknown[] = []
  ) => ({type, attrs, children}),
}))

const baseStarEvent: ParsedEvent = {
  type: 'star',
  displayType: 'Star',
  repo: 'AUTO-MAS-Project/AUTO-MAS',
  actor: 'ClozyA',
  url: 'https://github.com/AUTO-MAS-Project/AUTO-MAS',
  starCount: 1234,
}

function textContent(event: ParsedEvent): string {
  return buildMessage(event)[0].attrs.content
}

describe('buildMessage star events', () => {
  it('uses plus-star for starred events without appending the repository url', () => {
    const content = textContent({
      ...baseStarEvent,
      action: 'created',
    })

    expect(content).toBe([
      '+⭐ [AUTO-MAS-Project/AUTO-MAS] Star',
      'ClozyA starred (⭐ 1234)',
    ].join('\n'))
  })

  it('uses minus-star for unstarred events without appending the repository url', () => {
    const content = textContent({
      ...baseStarEvent,
      action: 'deleted',
      starCount: 1233,
    })

    expect(content).toBe([
      '-⭐ [AUTO-MAS-Project/AUTO-MAS] Star',
      'ClozyA unstarred (⭐ 1233)',
    ].join('\n'))
  })
})

describe('forward messages', () => {
  it('wraps every event in one forward node using the actor as its author', () => {
    const events = [
      {...baseStarEvent, action: 'created'},
      {...baseStarEvent, actor: 'octocat', action: 'deleted', starCount: 1233},
    ]

    const [forward] = buildForwardMessage(events)

    expect(forward.type).toBe('message')
    expect(forward.attrs).toEqual({forward: true})
    expect(forward.children).toHaveLength(2)
    expect(forward.children[0].children[0]).toMatchObject({
      type: 'author',
      attrs: {name: 'ClozyA'},
    })
    expect(forward.children[1].children[0]).toMatchObject({
      type: 'author',
      attrs: {name: 'octocat'},
    })
  })

  it('joins batched events into one readable fallback text', () => {
    const [fallback] = buildBatchFallbackMessage([
      {...baseStarEvent, action: 'created'},
      {...baseStarEvent, action: 'deleted', starCount: 1233},
    ])

    expect(fallback.type).toBe('text')
    expect(fallback.attrs.content).toContain('──────────')
    expect(fallback.attrs.content).toContain('ClozyA starred')
    expect(fallback.attrs.content).toContain('ClozyA unstarred')
  })
})
