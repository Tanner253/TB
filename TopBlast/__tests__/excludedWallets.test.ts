import {
  isExcludedParticipantWallet,
  resetExcludedWalletCache,
} from '@/lib/eligibility/excludedWallets'
import { evaluateHolderEligibility } from '@/lib/eligibility/evaluateHolder'

const PROTOCOL_WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuQosgAsU'
const OTHER_WALLET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

describe('excludedWallets', () => {
  const originalExcluded = process.env.EXCLUDED_WALLETS

  afterEach(() => {
    if (originalExcluded === undefined) {
      delete process.env.EXCLUDED_WALLETS
    } else {
      process.env.EXCLUDED_WALLETS = originalExcluded
    }
    resetExcludedWalletCache()
  })

  it('excludes wallets listed in EXCLUDED_WALLETS', () => {
    process.env.EXCLUDED_WALLETS = PROTOCOL_WALLET
    resetExcludedWalletCache()
    expect(isExcludedParticipantWallet(PROTOCOL_WALLET)).toBe(true)
    expect(isExcludedParticipantWallet(OTHER_WALLET)).toBe(false)
  })

  it('marks protocol wallet ineligible in evaluation', () => {
    process.env.EXCLUDED_WALLETS = PROTOCOL_WALLET
    resetExcludedWalletCache()

    const result = evaluateHolderEligibility({
      wallet: PROTOCOL_WALLET,
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
