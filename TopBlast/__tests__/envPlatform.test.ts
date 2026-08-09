import {
  isPlatformEnvConfigured,
  resolvePlatformEnvRuntime,
} from '@/lib/platform/envPlatform'
import { testSolanaSecretKey } from './helpers/testKeypair'

describe('envPlatform', () => {
  const originalMint = process.env.TOKEN_MINT_ADDRESS
  const originalKey = process.env.PAYOUT_WALLET_PRIVATE_KEY
  const originalSlug = process.env.PLATFORM_TENANT_SLUG

  afterEach(() => {
    if (originalMint === undefined) delete process.env.TOKEN_MINT_ADDRESS
    else process.env.TOKEN_MINT_ADDRESS = originalMint
    if (originalKey === undefined) delete process.env.PAYOUT_WALLET_PRIVATE_KEY
    else process.env.PAYOUT_WALLET_PRIVATE_KEY = originalKey
    if (originalSlug === undefined) delete process.env.PLATFORM_TENANT_SLUG
    else process.env.PLATFORM_TENANT_SLUG = originalSlug
  })

  it('detects env platform when mint and payout key exist', () => {
    process.env.TOKEN_MINT_ADDRESS = 'So11111111111111111111111111111111111111112'
    process.env.PAYOUT_WALLET_PRIVATE_KEY = testSolanaSecretKey()
    expect(isPlatformEnvConfigured()).toBe(true)
  })

  it('resolves platform slug to legacy-scoped runtime from env', () => {
    process.env.PLATFORM_TENANT_SLUG = 'topblast'
    process.env.TOKEN_MINT_ADDRESS = 'So11111111111111111111111111111111111111112'
    process.env.TOKEN_SYMBOL = 'TBLAST'
    process.env.PAYOUT_WALLET_PRIVATE_KEY = testSolanaSecretKey()

    const runtime = resolvePlatformEnvRuntime('topblast')
    expect(runtime).not.toBeNull()
    expect(runtime!.tenantSlug).toBe('_legacy')
    expect(runtime!.tokenSymbol).toBe('TBLAST')
    expect(resolvePlatformEnvRuntime('other')).toBeNull()
  })
})
