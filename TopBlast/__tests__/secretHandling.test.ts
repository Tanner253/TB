import { redactSecrets, assertNoPrivateKeyFields } from '@/lib/security/redactSecrets'
import { encryptSecret } from '@/lib/tenant/crypto'

describe('secret handling', () => {
  it('redacts base58 private keys from error strings', () => {
    const key = '5'.repeat(87)
    const message = `Invalid key ${key} in request`
    expect(redactSecrets(message)).not.toContain(key)
    expect(redactSecrets(message)).toContain('[REDACTED_KEY]')
  })

  it('redacts EVM hex addresses from error strings', () => {
    const hex = '0x9b3283f077d49fee9ccc174a9482fd6c3b758589'
    expect(redactSecrets(`bad dev wallet ${hex}`)).not.toContain(hex)
  })

  it('blocks API payloads that include private key fields', () => {
    expect(() =>
      assertNoPrivateKeyFields({ slug: 'test', payoutWalletPrivateKey: 'secret' })
    ).toThrow(/Refusing to expose secret field/)
  })

  it('allows public tenant summary fields only', () => {
    expect(() =>
      assertNoPrivateKeyFields({
        slug: 'test',
        payoutWalletAddress: '7F8RuECaT5GqVCzFkh89GXUo24hptgaQbJFVWZM1WL3z',
      })
    ).not.toThrow()
  })

  it('encrypts secrets so ciphertext does not contain plaintext', () => {
    const secret = '5KexampleBase58PrivateKeyPayloadForTestingPurposesOnly'
    const encrypted = encryptSecret(secret)
    expect(encrypted).not.toContain(secret)
  })
})
