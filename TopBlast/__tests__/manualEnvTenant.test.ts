import {
  buildManualEnvCatalogEntry,
  isManualEnvConfigured,
  MANUAL_MIN_TOKEN_HOLDING,
  MANUAL_PAYOUT_INTERVAL_MINUTES,
  MANUAL_WINNER_COUNT,
  resolveManualEnvRuntime,
} from '@/lib/platform/manualEnvTenant'
import { decorateCatalogTenants } from '@/lib/platform/catalog'
import { catalogPayoutTenantKey } from '@/lib/platform/catalogMetrics'
import { testSolanaSecretKey } from './helpers/testKeypair'

describe('manualEnvTenant', () => {
  const keys = [
    'MANUAL_TENANT_SLUG',
    'MANUAL_TOKEN_MINT',
    'MANUAL_TOKEN_SYMBOL',
    'MANUAL_PAYOUT_WALLET_PRIVATE_KEY',
    'MANUAL_EXECUTE_PAYOUTS',
    'PLATFORM_TENANT_SLUG',
    'TOKEN_MINT_ADDRESS',
  ] as const
  const originals: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of keys) originals[k] = process.env[k]
  })

  afterEach(() => {
    for (const k of keys) {
      if (originals[k] === undefined) delete process.env[k]
      else process.env[k] = originals[k]
    }
  })

  it('is configured only when slug, mint, and payout key are set', () => {
    process.env.MANUAL_TENANT_SLUG = 'mylist'
    process.env.MANUAL_TOKEN_MINT = 'So11111111111111111111111111111111111111112'
    process.env.MANUAL_PAYOUT_WALLET_PRIVATE_KEY = testSolanaSecretKey()
    expect(isManualEnvConfigured()).toBe(true)
  })

  it('rejects platform slug collision', () => {
    process.env.PLATFORM_TENANT_SLUG = 'topblast'
    process.env.MANUAL_TENANT_SLUG = 'topblast'
    process.env.MANUAL_TOKEN_MINT = 'So11111111111111111111111111111111111111112'
    process.env.MANUAL_PAYOUT_WALLET_PRIVATE_KEY = testSolanaSecretKey()
    expect(isManualEnvConfigured()).toBe(false)
  })

  it('resolves runtime with fixed 10 winners / 1M hold / 1h cycle and real slug scope', () => {
    process.env.MANUAL_TENANT_SLUG = 'mylist'
    process.env.MANUAL_TOKEN_MINT = 'So11111111111111111111111111111111111111112'
    process.env.MANUAL_TOKEN_SYMBOL = 'MYTOK'
    process.env.MANUAL_PAYOUT_WALLET_PRIVATE_KEY = testSolanaSecretKey()
    process.env.MANUAL_EXECUTE_PAYOUTS = 'true'

    const runtime = resolveManualEnvRuntime('mylist')
    expect(runtime).not.toBeNull()
    expect(runtime!.tenantSlug).toBe('mylist')
    expect(runtime!.tenantSlug).not.toBe('_legacy')
    expect(runtime!.tokenSymbol).toBe('MYTOK')
    expect(runtime!.winnerCount).toBe(MANUAL_WINNER_COUNT)
    expect(runtime!.winnerCount).toBe(10)
    expect(runtime!.minTokenHolding).toBe(MANUAL_MIN_TOKEN_HOLDING)
    expect(runtime!.minTokenHolding).toBe(1_000_000)
    expect(runtime!.payoutIntervalMinutes).toBe(MANUAL_PAYOUT_INTERVAL_MINUTES)
    expect(runtime!.payoutIntervalMinutes).toBe(60)
    expect(runtime!.executePayouts).toBe(true)
    expect(resolveManualEnvRuntime('other')).toBeNull()
  })

  it('catalog entry looks like a normal listing (not platform / not featured)', () => {
    process.env.MANUAL_TENANT_SLUG = 'mylist'
    process.env.MANUAL_TOKEN_MINT = 'ManualMint111111111111111111111111111111111'
    process.env.MANUAL_TOKEN_SYMBOL = 'MYTOK'
    process.env.MANUAL_PAYOUT_WALLET_PRIVATE_KEY = testSolanaSecretKey()
    delete process.env.TOKEN_MINT_ADDRESS

    const entry = buildManualEnvCatalogEntry()
    expect(entry.isPlatformToken).toBe(false)
    expect(entry.featured).toBe(false)
    expect(entry.runsFromEnv).toBeUndefined()
    expect(entry.winnerCount).toBe(10)
    expect(entry.payoutIntervalMinutes).toBe(60)
    expect(catalogPayoutTenantKey(entry)).toBe('mylist')

    const decorated = decorateCatalogTenants([])
    const manual = decorated.find(t => t.slug === 'mylist')
    expect(manual).toBeDefined()
    expect(manual!.isPlatformToken).toBe(false)
    expect(manual!.featured).toBe(false)
  })
})
