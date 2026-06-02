import {describe, expect, it} from 'vitest'
import {parseCreateEvent, parseDeleteEvent, parsePushEvent} from '../src/parser'

const repository = {
  full_name: 'AUTO-MAS-Project/AUTO-MAS',
  html_url: 'https://github.com/AUTO-MAS-Project/AUTO-MAS',
}

const sender = {
  login: 'ClozyA',
}

describe('parsePushEvent', () => {
  it('ignores branch creation push events because GitHub also sends a create event', () => {
    const event = parsePushEvent({
      ref: 'refs/heads/feat/refeactor_home',
      commits: [],
      created: true,
      deleted: false,
      repository,
      sender,
    })

    expect(event).toBeNull()
  })

  it('ignores branch deletion push events because GitHub also sends a delete event', () => {
    const event = parsePushEvent({
      ref: 'refs/heads/codex/add-example-for-timestamp-format-input',
      commits: [],
      created: false,
      deleted: true,
      repository,
      sender,
    })

    expect(event).toBeNull()
  })

  it('keeps normal push events', () => {
    const event = parsePushEvent({
      ref: 'refs/heads/main',
      commits: [
        {
          id: '1234567890abcdef',
          message: 'fix parser',
          author: {name: 'ClozyA'},
          url: 'https://github.com/AUTO-MAS-Project/AUTO-MAS/commit/1234567',
        },
      ],
      created: false,
      deleted: false,
      compare: 'https://github.com/AUTO-MAS-Project/AUTO-MAS/compare/old...new',
      repository,
      sender,
    })

    expect(event).toMatchObject({
      type: 'push',
      displayType: 'Commit',
      repo: repository.full_name,
      actor: sender.login,
      ref: 'main',
      totalCommits: 1,
      url: 'https://github.com/AUTO-MAS-Project/AUTO-MAS/compare/old...new',
    })
  })
})

describe('create and delete events', () => {
  it('still parses the dedicated branch create event', () => {
    expect(parseCreateEvent({
      ref: 'feat/refeactor_home',
      ref_type: 'branch',
      repository,
      sender,
    })).toMatchObject({
      type: 'create',
      action: 'created',
      ref: 'branch:feat/refeactor_home',
    })
  })

  it('still parses the dedicated branch delete event', () => {
    expect(parseDeleteEvent({
      ref: 'codex/add-example-for-timestamp-format-input',
      ref_type: 'branch',
      repository,
      sender,
    })).toMatchObject({
      type: 'delete',
      action: 'deleted',
      ref: 'branch:codex/add-example-for-timestamp-format-input',
    })
  })
})
