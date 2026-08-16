import {describe, expect, it} from 'vitest'
import {isBotActor, isBotPayload} from '../src/bot'

describe('GitHub bot detection', () => {
  it.each(['sourcery-ai[bot]', 'chatgpt-codex-connector[bot]'])(
    'recognizes %s as a bot actor',
    login => {
      expect(isBotActor({login})).toBe(true)
    }
  )

  it('recognizes GitHub actors declared as Bot', () => {
    expect(isBotActor({type: 'Bot', login: 'github-actions'})).toBe(true)
  })

  it('recognizes the sender in a webhook payload', () => {
    expect(isBotPayload({sender: {login: 'sourcery-ai[bot]'}})).toBe(true)
    expect(isBotPayload({sender: {login: 'maintainer', type: 'User'}})).toBe(false)
  })

  it('does not classify an unrelated payload as a bot message', () => {
    expect(isBotPayload({repository: {full_name: 'owner/repo'}})).toBe(false)
    expect(isBotPayload(null)).toBe(false)
  })
})
