/**
 * Per-listing payout currency ('token' buyback+airdrop vs 'sol' direct).
 * The critical invariant: everything existing defaults to 'token' — legacy
 * Mongo rows without the field, env-driven sessions, and omitted form input
 * must all behave exactly as before the feature shipped.
 */

import { Keypair } from '@solana/web3.js'
import type { MongoMemoryServer } from 'mongodb-memory-server'
import { testSolanaSecretKey } from './helpers/testKeypair'
import {
  DEFAULT_PAYOUT_MODE,
  envDefaultPayoutMode,
  validatePayoutMode,
} from '@/lib/payout/payoutMode'
import { Tenant } from '@/lib/db/models'
import { createTenant, resolveTenantRuntime } from '@/lib/tenant/service'
import {
  clearMemoryCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from './helpers/memoryMongo'

const DEV_WALLET = Keypair.generate().publicKey.toBase58()

function freshKeyAndMint() {
  return {
    payoutWalletPrivateKey: testSolanaSecretKey(),
    mint: Keypair.generate().publicKey.toBase58(),
  }
}

describe('validatePayoutMode', () => {
  it("defaults to 'token' when omitted", () => {
    expect(DEFAULT_PAYOUT_MODE).toBe('token')
    expect(validatePayoutMode(undefined)).toBe('token')
    expect(validatePayoutMode(null)).toBe('token')
    expect(validatePayoutMode('')).toBe('token')
  })

  it('accepts both modes, tolerant of case and whitespace', () => {
    expect(validatePayoutMode('sol')).toBe('sol')
    expect(validatePayoutMode('token')).toBe('token')
    expect(validatePayoutMode(' SOL ')).toBe('sol')
    expect(validatePayoutMode('Token')).toBe('token')
  })

  it('rejects anything else', () => {
    expect(() => validatePayoutMode('usdc')).toThrow(/token.*sol|sol.*token/i)
    expect(() => validatePayoutMode(42)).toThrow()
    expect(() => validatePayoutMode(true)).toThrow()
  })
})

describe('envDefaultPayoutMode', () => {
  const original = process.env.PAYOUT_AS_NATIVE_TOKEN

  afterEach(() => {
    if (original === undefined) delete process.env.PAYOUT_AS_NATIVE_TOKEN
    else process.env.PAYOUT_AS_NATIVE_TOKEN = original
  })

  it("defaults to 'token' (current production behavior)", () => {
    delete process.env.PAYOUT_AS_NATIVE_TOKEN
    expect(envDefaultPayoutMode()).toBe('token')
  })

  it("maps PAYOUT_AS_NATIVE_TOKEN=false to 'sol'", () => {
    process.env.PAYOUT_AS_NATIVE_TOKEN = 'false'
    expect(envDefaultPayoutMode()).toBe('sol')
    process.env.PAYOUT_AS_NATIVE_TOKEN = '0'
    expect(envDefaultPayoutMode()).toBe('sol')
  })
})

describe('tenant payout mode persistence', () => {
  let mongo: MongoMemoryServer
  const originalEnv = {
    key: process.env.TENANT_ENCRYPTION_KEY,
    dev: process.env.DEV_WALLET_ADDRESS,
  }

  beforeAll(async () => {
    process.env.TENANT_ENCRYPTION_KEY = 'payout-mode-test-encryption-key'
    process.env.DEV_WALLET_ADDRESS = DEV_WALLET
    mongo = await startMemoryMongo()
  })

  afterAll(async () => {
    await stopMemoryMongo(mongo)
    if (originalEnv.key === undefined) delete process.env.TENANT_ENCRYPTION_KEY
    else process.env.TENANT_ENCRYPTION_KEY = originalEnv.key
    if (originalEnv.dev === undefined) delete process.env.DEV_WALLET_ADDRESS
    else process.env.DEV_WALLET_ADDRESS = originalEnv.dev
  })

  beforeEach(async () => {
    await clearMemoryCollections()
  })

  it("createTenant without payoutMode stores 'token' (no behavior change)", async () => {
    const created = await createTenant({
      slug: 'default-mode',
      symbol: 'DFLT',
      ...freshKeyAndMint(),
    })
    expect(created.payoutMode).toBe('token')

    const runtime = await resolveTenantRuntime('default-mode')
    expect(runtime?.payoutMode).toBe('token')
  })

  it("createTenant with payoutMode 'sol' persists and resolves to 'sol'", async () => {
    const created = await createTenant({
      slug: 'sol-mode',
      symbol: 'SOLPAY',
      payoutMode: 'sol',
      ...freshKeyAndMint(),
    })
    expect(created.payoutMode).toBe('sol')

    const runtime = await resolveTenantRuntime('sol-mode')
    expect(runtime?.payoutMode).toBe('sol')
  })

  it('createTenant rejects an invalid payoutMode', async () => {
    await expect(
      createTenant({
        slug: 'bad-mode',
        symbol: 'BAD',
        payoutMode: 'usdc',
        ...freshKeyAndMint(),
      })
    ).rejects.toThrow(/token.*sol|sol.*token/i)
  })

  it("legacy tenant rows without the field resolve as 'token'", async () => {
    await createTenant({
      slug: 'legacy-row',
      symbol: 'LEGACY',
      ...freshKeyAndMint(),
    })
    // Simulate a pre-feature document: strip the field entirely.
    await Tenant.updateOne({ slug: 'legacy-row' }, { $unset: { payoutMode: '' } })

    const runtime = await resolveTenantRuntime('legacy-row')
    expect(runtime?.payoutMode).toBe('token')
  })
})
