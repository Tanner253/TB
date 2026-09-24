import {
  MAX_PAYOUT_PCT_OF_SUPPLY,
  maxTokensPerPayout,
  splitPayoutAtSupplyCap,
} from '@/lib/payout/supplyCap'

const SUPPLY = 1_000_000_000
const CAP = SUPPLY * 0.035 // 35,000,000

describe('supply cap on token payouts', () => {
  it('caps at 3.5% of supply', () => {
    expect(MAX_PAYOUT_PCT_OF_SUPPLY).toBe(3.5)
    expect(maxTokensPerPayout(SUPPLY)).toBe(CAP)
  })

  it('leaves a normal payout entirely in tokens', () => {
    // Cycle 1's real shape: ~4M tokens out of 1B supply.
    const r = splitPayoutAtSupplyCap({ amountEth: 0.008, tokensPerEth: 500_000_000, totalSupply: SUPPLY })
    expect(r.capped).toBe(false)
    expect(r.cashEth).toBe(0)
    expect(r.tokenEth).toBe(0.008)
  })

  it('splits an oversized payout into capped tokens plus ETH', () => {
    // 1 ETH would buy 100M tokens — 10% of supply.
    const r = splitPayoutAtSupplyCap({ amountEth: 1, tokensPerEth: 100_000_000, totalSupply: SUPPLY })
    expect(r.capped).toBe(true)
    expect(r.tokens).toBe(CAP)
    expect(r.tokenEth).toBeCloseTo(0.35, 10)
    expect(r.cashEth).toBeCloseTo(0.65, 10)
  })

  it('never short-changes the winner — the legs always sum to the payout', () => {
    for (const amountEth of [0.001, 0.05, 1, 7.25]) {
      for (const tokensPerEth of [1e6, 1e8, 5e8, 2e9]) {
        const r = splitPayoutAtSupplyCap({ amountEth, tokensPerEth, totalSupply: SUPPLY })
        expect(r.tokenEth + r.cashEth).toBeCloseTo(amountEth, 9)
        expect(r.tokenEth).toBeGreaterThanOrEqual(0)
        expect(r.cashEth).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('never exceeds the cap, however large the pool', () => {
    for (const amountEth of [1, 10, 100, 10_000]) {
      const r = splitPayoutAtSupplyCap({ amountEth, tokensPerEth: 1e9, totalSupply: SUPPLY })
      expect(r.tokens).toBeLessThanOrEqual(CAP + 1e-6)
    }
  })

  it('sits exactly on the boundary without flipping to capped', () => {
    const r = splitPayoutAtSupplyCap({ amountEth: 1, tokensPerEth: CAP, totalSupply: SUPPLY })
    expect(r.capped).toBe(false)
    expect(r.tokens).toBeCloseTo(CAP, 6)
    expect(r.cashEth).toBe(0)
  })

  it('scales the cap with the token, not a fixed number', () => {
    expect(maxTokensPerPayout(1_000_000)).toBeCloseTo(35_000, 6)
    expect(maxTokensPerPayout(21_000_000)).toBeCloseTo(735_000, 6)
  })

  describe('missing inputs must not quietly convert a payout to ETH', () => {
    it.each([
      ['no supply', { amountEth: 1, tokensPerEth: 1e9, totalSupply: 0 }],
      ['no price', { amountEth: 1, tokensPerEth: 0, totalSupply: SUPPLY }],
      ['NaN supply', { amountEth: 1, tokensPerEth: 1e9, totalSupply: NaN }],
    ])('%s pays in tokens as before', (_label, input) => {
      const r = splitPayoutAtSupplyCap(input as Parameters<typeof splitPayoutAtSupplyCap>[0])
      expect(r.cashEth).toBe(0)
      expect(r.capped).toBe(false)
      expect(r.tokenEth).toBe(1)
    })
  })

  it('returns nothing for a zero payout', () => {
    const r = splitPayoutAtSupplyCap({ amountEth: 0, tokensPerEth: 1e9, totalSupply: SUPPLY })
    expect(r.tokenEth).toBe(0)
    expect(r.cashEth).toBe(0)
  })

  it('treats an unknown supply as no cap rather than a zero cap', () => {
    expect(maxTokensPerPayout(0)).toBe(Infinity)
    expect(maxTokensPerPayout(NaN)).toBe(Infinity)
  })
})
