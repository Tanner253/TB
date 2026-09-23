import {
  CHAIN_DEPOSIT_WARNING,
  CHAIN_ID,
  CHAIN_ID_TESTNET,
  CHAIN_LABEL,
  CHAIN_NAME,
} from '@/lib/marketing/urls'
import {
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from '@/lib/pons/contracts'
import { RECOMMENDED_LISTING } from '@/lib/platform/recommendedListing'

/**
 * The chain id reaches the UI that tells people where to send money, and it
 * lives in two files because lib/pons/contracts is server-only. If they ever
 * drift, the site confidently names a network nobody is watching and the funds
 * are gone with no error to react to.
 */
describe('chain identity shown to users', () => {
  it('matches the chain the payout engine actually signs for', () => {
    expect(CHAIN_ID).toBe(ROBINHOOD_MAINNET_CHAIN_ID)
    expect(CHAIN_ID_TESTNET).toBe(ROBINHOOD_TESTNET_CHAIN_ID)
  })

  it('is Robinhood Chain mainnet 4663, not the testnet', () => {
    expect(CHAIN_ID).toBe(4663)
    expect(CHAIN_ID).not.toBe(CHAIN_ID_TESTNET)
  })

  it('names both the chain and the id wherever a deposit is requested', () => {
    expect(CHAIN_LABEL).toContain(CHAIN_NAME)
    expect(CHAIN_LABEL).toContain(String(CHAIN_ID))
    expect(CHAIN_DEPOSIT_WARNING).toContain(CHAIN_NAME)
    expect(CHAIN_DEPOSIT_WARNING).toContain(String(CHAIN_ID))
  })

  it('warns that other networks lose the funds', () => {
    expect(CHAIN_DEPOSIT_WARNING).toMatch(/lost|cannot be recovered/i)
    expect(CHAIN_DEPOSIT_WARNING).toMatch(/mainnet|Base|Arbitrum/i)
  })
})

describe('recommended listing mirrors the proven platform config', () => {
  it('is the setup that has actually run a full cycle', () => {
    expect(RECOMMENDED_LISTING).toEqual({
      winnerCount: 3,
      payoutIntervalMinutes: 15,
      minTokenHolding: 100_000,
      payoutMode: 'token',
    })
  })

  it('recommends buyback, so payouts land as chart volume', () => {
    expect(RECOMMENDED_LISTING.payoutMode).toBe('token')
  })
})
