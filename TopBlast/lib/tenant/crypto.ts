import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getMasterKey(): Buffer {
  const raw = process.env.TENANT_ENCRYPTION_KEY || process.env.MASTER_ENCRYPTION_KEY
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TopBlast is not fully configured to store payout keys securely. Please try again later.')
    }
    // Dev-only fallback — never use in production
    return crypto.createHash('sha256').update('topblast-dev-encryption-key').digest()
  }
  return crypto.createHash('sha256').update(raw).digest()
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptSecret(payload: string): string {
  const data = Buffer.from(payload, 'base64')
  const iv = data.subarray(0, IV_LENGTH)
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + 16)
  const encrypted = data.subarray(IV_LENGTH + 16)
  const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
