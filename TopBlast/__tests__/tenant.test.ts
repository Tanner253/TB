import { encryptSecret, decryptSecret } from '@/lib/tenant/crypto'

describe('tenant crypto', () => {
  const originalKey = process.env.TENANT_ENCRYPTION_KEY

  beforeAll(() => {
    process.env.TENANT_ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests-only'
  })

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env.TENANT_ENCRYPTION_KEY
    } else {
      process.env.TENANT_ENCRYPTION_KEY = originalKey
    }
  })

  it('round-trips payout private keys', () => {
    const secret = '5KexampleBase58PrivateKeyPayloadForTestingPurposesOnly'
    const encrypted = encryptSecret(secret)
    expect(encrypted).not.toContain(secret)
    expect(decryptSecret(encrypted)).toBe(secret)
  })
})
