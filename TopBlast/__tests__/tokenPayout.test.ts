import { allocateTokenAmountsBySolShare } from '@/lib/solana/tokenTransfer'
import {
  isNativeTokenPayoutEnabled,
  getPayoutSwapSlippageBps,
  getPayoutSwapSlippageSteps,
} from '@/lib/solana/jupiterSwap'

describe('Native token payouts', () => {
  it('allocates token amounts proportional to SOL winner shares', () => {
    const map = allocateTokenAmountsBySolShare(
      [
        { rank: 1, amountSol: 0.06 },
        { rank: 2, amountSol: 0.025 },
        { rank: 3, amountSol: 0.015 },
      ],
      1000
    )

    expect(map.get(1)).toBeCloseTo(600, 0)
    expect(map.get(2)).toBeCloseTo(250, 0)
    expect(map.get(3)).toBeCloseTo(150, 0)
    expect((map.get(1) ?? 0) + (map.get(2) ?? 0) + (map.get(3) ?? 0)).toBeCloseTo(1000, 0)
  })

  it('gives a single pending winner the full swap total on retry', () => {
    const map = allocateTokenAmountsBySolShare([{ rank: 2, amountSol: 0.013 }], 424_479.91)
    expect(map.get(2)).toBeCloseTo(424_479.91, 2)
  })

  it('does not zero out top ranks when total is small but transferable', () => {
    const map = allocateTokenAmountsBySolShare(
      [
        { rank: 1, amountSol: 0.032 },
        { rank: 2, amountSol: 0.013 },
        { rank: 3, amountSol: 0.008 },
      ],
      3
    )
    expect((map.get(1) ?? 0)).toBeGreaterThan(0)
    expect((map.get(2) ?? 0)).toBeGreaterThan(0)
    expect((map.get(3) ?? 0)).toBeGreaterThan(0)
    expect((map.get(1) ?? 0) + (map.get(2) ?? 0) + (map.get(3) ?? 0)).toBeCloseTo(3, 6)
  })

  it('defaults native token payouts to enabled', () => {
    delete process.env.PAYOUT_AS_NATIVE_TOKEN
    expect(isNativeTokenPayoutEnabled()).toBe(true)
  })

  it('allows disabling native token payouts via env', () => {
    process.env.PAYOUT_AS_NATIVE_TOKEN = 'false'
    expect(isNativeTokenPayoutEnabled()).toBe(false)
    delete process.env.PAYOUT_AS_NATIVE_TOKEN
  })

  it('defaults swap slippage to 150 bps', () => {
    delete process.env.PAYOUT_SWAP_SLIPPAGE_BPS
    expect(getPayoutSwapSlippageBps()).toBe(150)
  })

  it('builds escalating slippage steps for swap retries', () => {
    delete process.env.PAYOUT_SWAP_SLIPPAGE_BPS
    delete process.env.PAYOUT_SWAP_MAX_RETRIES
    expect(getPayoutSwapSlippageSteps()).toEqual([150, 300, 450])
  })
})
