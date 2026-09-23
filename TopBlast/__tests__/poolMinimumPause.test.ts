import {
  isPoolConfirmedBelowMinimum,
  isPoolFundedForPayout,
  poolFundingIsKnown,
} from '@/lib/payout/poolMinimum'
import type { LivePoolBalance } from '@/lib/payout/poolBalance'

/**
 * A price-feed failure must never look like an empty wallet.
 *
 * It used to: isPoolFundedForPayout returns false when the native price is
 * missing, the timer-pause path asked exactly that question, and so every
 * CoinGecko hiccup reset the countdown to the full interval. With a 60s cache
 * and a 60s worker tick the feed was hit almost every cycle, so a payout could
 * never reach zero.
 */
function pool(over: Partial<LivePoolBalance> = {}): LivePoolBalance {
  return {
    available: true,
    payoutWalletAddress: '0x2d32630c0ca699a383521c2784788446f73abed4',
    walletSol: 0.0166,
    solPrice: 2680,
    poolUsdFormatted: '$44.50',
    ...(over as object),
  } as LivePoolBalance
}

describe('pausing on pool minimum', () => {
  it('does not pause a funded pool', () => {
    const p = pool()
    expect(isPoolFundedForPayout(p)).toBe(true)
    expect(isPoolConfirmedBelowMinimum(p)).toBe(false)
  })

  it('pauses a pool that is genuinely too small', () => {
    const p = pool({ walletSol: 0.0000001 })
    expect(isPoolConfirmedBelowMinimum(p)).toBe(true)
  })

  it('NEVER pauses when the native price is unavailable', () => {
    for (const solPrice of [0, -1, NaN, undefined as unknown as number]) {
      const p = pool({ solPrice })
      // Still not payable — spending money must fail closed...
      expect(isPoolFundedForPayout(p)).toBe(false)
      // ...but it is not evidence of an empty pool, so the timer stands.
      expect(poolFundingIsKnown(p)).toBe(false)
      expect(isPoolConfirmedBelowMinimum(p)).toBe(false)
    }
  })

  it('treats an unreadable wallet as unknown, not as below minimum', () => {
    expect(isPoolConfirmedBelowMinimum(pool({ available: false }))).toBe(false)
    expect(isPoolConfirmedBelowMinimum(pool({ payoutWalletAddress: '' }))).toBe(false)
  })

  it('keeps the two questions independent', () => {
    // Priced and large: payable, not below minimum.
    expect(isPoolFundedForPayout(pool())).toBe(true)
    // Priced and tiny: not payable, and below minimum.
    const small = pool({ walletSol: 1e-9 })
    expect(isPoolFundedForPayout(small)).toBe(false)
    expect(isPoolConfirmedBelowMinimum(small)).toBe(true)
  })
})
