import { PublicKey } from '@solana/web3.js'
import {
  derivePumpBondingCurveAddress,
  getLiquidityPoolExclusionReason,
  isLiquidityPoolWallet,
  refreshLiquidityPoolAddresses,
  resetLiquidityPoolCache,
} from '@/lib/eligibility/liquidityPools'
import {
  isExcludedParticipantWallet,
  resetExcludedWalletCache,
} from '@/lib/eligibility/excludedWallets'
import { evaluateHolderEligibility } from '@/lib/eligibility/evaluateHolder'

jest.mock('@/lib/config', () => ({
  config: {
    get tokenMint() {
      return process.env.TOKEN_MINT_ADDRESS || 'So11111111111111111111111111111111111111112'
    },
    get devWalletAddress() {
      return process.env.DEV_WALLET_ADDRESS || ''
    },
  },
}))

jest.mock('@/lib/tenant/context', () => ({
  getTenantSlug: jest.fn(() => 'tbla'),
  getPayoutPrivateKey: jest.fn(() => undefined),
  getTenantRuntime: jest.fn(() => undefined),
}))

import { getTenantSlug } from '@/lib/tenant/context'

const TEST_MINT = 'So11111111111111111111111111111111111111112'
const DEV_WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuQosgAsU'

describe('liquidityPools tenant isolation', () => {
  beforeEach(() => {
    global._liquidityPoolCacheByKey = undefined
    resetLiquidityPoolCache()
    jest.clearAllMocks()
    ;(getTenantSlug as jest.Mock).mockReturnValue('tbla')
  })

  it('scopes LP cache per tenant', async () => {
    await refreshLiquidityPoolAddresses(TEST_MINT)
    const bonding = derivePumpBondingCurveAddress(TEST_MINT)!
    expect(isLiquidityPoolWallet(bonding, TEST_MINT)).toBe(true)

    ;(getTenantSlug as jest.Mock).mockReturnValue('wagmi')
    expect(isLiquidityPoolWallet(bonding, TEST_MINT)).toBe(false)
  })
})

describe('liquidityPools', () => {
  const originalMint = process.env.TOKEN_MINT_ADDRESS

  beforeEach(() => {
    global._liquidityPoolCacheByKey = undefined
    ;(getTenantSlug as jest.Mock).mockReturnValue('tbla')
    process.env.TOKEN_MINT_ADDRESS = TEST_MINT
    resetLiquidityPoolCache()
    resetExcludedWalletCache()
  })

  afterEach(() => {
    if (originalMint === undefined) delete process.env.TOKEN_MINT_ADDRESS
    else process.env.TOKEN_MINT_ADDRESS = originalMint
    resetLiquidityPoolCache()
    resetExcludedWalletCache()
  })

  it('derives a stable Pump.fun bonding-curve address for a mint', () => {
    const a = derivePumpBondingCurveAddress(TEST_MINT)
    const b = derivePumpBondingCurveAddress(TEST_MINT)
    expect(a).toBeTruthy()
    expect(a).toBe(b)
    // eslint-disable-next-line no-new
    new PublicKey(a!)
  })

  it('caches bonding-curve and DexScreener pair addresses', async () => {
    await refreshLiquidityPoolAddresses(TEST_MINT)
    const bonding = derivePumpBondingCurveAddress(TEST_MINT)!
    expect(isLiquidityPoolWallet(bonding, TEST_MINT)).toBe(true)
    expect(isExcludedParticipantWallet(bonding)).toBe(true)
  })

  it('marks liquidity pool wallets ineligible for payout', async () => {
    await refreshLiquidityPoolAddresses(TEST_MINT)
    const bonding = derivePumpBondingCurveAddress(TEST_MINT)!

    const result = evaluateHolderEligibility({
      wallet: bonding,
      balance: 999_000_000,
      vwap: 0.00001,
      tokenPrice: 0.000005,
      firstBuyTimestamp: Date.now() - 20 * 60 * 1000,
      poolUsd: 100,
      totalTokensBought: 999_000_000,
    })

    expect(result.isEligible).toBe(false)
    expect(result.ineligibleReason).toBe(getLiquidityPoolExclusionReason())
  })
})

describe('dev wallet exclusion', () => {
  const originalDev = process.env.DEV_WALLET_ADDRESS

  beforeEach(() => {
    process.env.DEV_WALLET_ADDRESS = DEV_WALLET
    resetExcludedWalletCache()
  })

  afterEach(() => {
    if (originalDev === undefined) delete process.env.DEV_WALLET_ADDRESS
    else process.env.DEV_WALLET_ADDRESS = originalDev
    resetExcludedWalletCache()
  })

  it('marks dev wallet ineligible via evaluateHolder', () => {
    const result = evaluateHolderEligibility({
      wallet: DEV_WALLET,
      balance: 1_000_000,
      vwap: 0.00001,
      tokenPrice: 0.000005,
      firstBuyTimestamp: Date.now() - 20 * 60 * 1000,
      poolUsd: 100,
      totalTokensBought: 1_000_000,
    })

    expect(result.isEligible).toBe(false)
    expect(result.ineligibleReason).toBe('Protocol wallet excluded')
  })
})
