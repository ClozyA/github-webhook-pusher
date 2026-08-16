/**
 * GitHub Bot 识别工具
 */

export function isBotActor(actor: unknown): boolean {
  if (typeof actor !== 'object' || actor === null) {
    return false
  }

  const record = actor as Record<string, unknown>
  const type = record.type
  if (typeof type === 'string' && type.toLowerCase() === 'bot') {
    return true
  }

  const login = record.login
  return typeof login === 'string' && login.toLowerCase().endsWith('[bot]')
}

/**
 * 判断 GitHub payload 的事件操作者是否为 Bot
 */
export function isBotPayload(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null) {
    return false
  }

  const sender = (payload as Record<string, unknown>).sender
  return isBotActor(sender)
}
