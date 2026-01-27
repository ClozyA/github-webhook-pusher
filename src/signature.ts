import {createHmac, timingSafeEqual} from 'crypto'

/**
 * 创建 GitHub Webhook 签名
 * @param payload 原始请求体
 * @param secret Webhook Secret
 * @returns 签名字符串，格式为 sha256=<hex_digest>
 */
export function createSignature(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(payload, 'utf8')
  return `sha256=${hmac.digest('hex')}`
}

/**
 * 验证 GitHub Webhook 签名
 * @param payload 原始请求体
 * @param signature X-Hub-Signature-256 头的值
 * @param secret 配置的 Webhook Secret
 * @returns 签名是否有效
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  // 检查签名格式
  if (!signature || !signature.startsWith('sha256=')) {
    return false
  }

  const expected = createSignature(payload, secret)

  // 使用常量时间比较防止时序攻击
  const sigBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  // 长度不同时也需要进行比较以保持常量时间
  if (sigBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(sigBuffer, expectedBuffer)
}
