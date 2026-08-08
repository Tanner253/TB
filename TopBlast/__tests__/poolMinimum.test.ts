import { isPoolFundedForPayout, minPoolForPayoutUsd } from '@/lib/payout/poolMinimum'
import type { LivePoolBalance } from '@/lib/payout/poolBalance'

jest.mock('@/lib/config', () => ({
  config: {
    minPoolForPayout: 5,
  },
}))

function pool(partial: Partial<LivePoolBalance>): LivePoolBalance {
  return {
    payoutWalletAddress: 'Pool1111111111111111111111111111111111',
    walletSol: 0.1,
    poolSol: 0.09,
    poolUsd: 10,
    solPrice: 100,
    poolUsdFormatted: '$10.00',
    poolSolFormatted: '0.0900',
    walletEth: 0.1,
    poolEth: 0.09,
    ethPrice: 100,
    poolEthFormatted: '0.0900',
    minLossUsd: 1,
    minLossUsdFormatted: '$1.00',
    available: true,
    ...partial,
  }
}

describe('poolMinimum', () => {
  it('requires payout wallet SOL valued at live USD minimum', () => {
    expect(minPoolForPayoutUsd()).toBe(5)
    expect(isPoolFundedForPayout(pool({ walletSol: 0.01, solPrice: 66, poolUsd: 0.66 }))).toBe(false)
    expect(isPoolFundedForPayout(pool({ walletSol: 0.08, solPrice: 75, poolUsd: 6 }))).toBe(true)
    expect(isPoolFundedForPayout(pool({ walletSol: 0, poolUsd: 0 }))).toBe(false)
  })
})
