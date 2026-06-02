import {describe, expect, it, vi} from 'vitest'
import {buildMessage} from '../src/message'
import {ParsedEvent} from '../src/types'

vi.mock('koishi', () => ({
  Element: class Element {},
  h: (_type: string, attrs: Record<string, unknown>) => ({attrs}),
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
