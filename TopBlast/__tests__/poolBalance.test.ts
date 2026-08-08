jest.mock('@/lib/config', () => ({
  config: {
    poolPercentage: 0.99,
    minLossThresholdPct: 10,
  },
}))

jest.mock('@/lib/payout/payoutSecurity', () => ({
  maxDistributableSol: (walletSol: number) => Math.max(0, walletSol - 0.01),
}))

jest.mock('@/lib/tenant/context', () => ({
  getTenantSlug: jest.fn(),
}))

jest.mock('@/lib/solana/transfer', () => ({
  getPayoutWalletAddressFromKey: jest.fn(),
  getPayoutWalletBalance: jest.fn(),
}))

jest.mock('@/lib/solana/price', () => ({
  getSolPrice: jest.fn(async () => 100),
  formatUsd: (n: number) => `$${n.toFixed(2)}`,
}))

import {
  buildLivePoolBalance,
  getLivePoolBalance,
  invalidateLivePoolBalanceCache,
} from '@/lib/payout/poolBalance'
import { getTenantSlug } from '@/lib/tenant/context'
import { getPayoutWalletAddressFromKey, getPayoutWalletBalance } from '@/lib/solana/transfer'

describe('poolBalance cache', () => {
  beforeEach(() => {
    invalidateLivePoolBalanceCache()
    jest.clearAllMocks()
  })

  it('caches pool balance per tenant and wallet address', async () => {
    ;(getTenantSlug as jest.Mock).mockReturnValue('_legacy')
    ;(getPayoutWalletAddressFromKey as jest.Mock).mockReturnValue(
      'PlatformWallet111111111111111111111111111'
    )
    ;(getPayoutWalletBalance as jest.Mock).mockResolvedValue({
      sol: 0.02,
      address: 'PlatformWallet111111111111111111111111111',
    })

    const first = await getLivePoolBalance()
    expect(first.poolSol).toBeCloseTo(0.01, 5)

    ;(getTenantSlug as jest.Mock).mockReturnValue('wagmi')
    ;(getPayoutWalletAddressFromKey as jest.Mock).mockReturnValue(
      'TenantWallet222222222222222222222222222222'
    )
    ;(getPayoutWalletBalance as jest.Mock).mockResolvedValue({
      sol: 0.2,
      address: 'TenantWallet222222222222222222222222222222',
    })

    const second = await getLivePoolBalance()
    expect(second.payoutWalletAddress).toBe('TenantWallet222222222222222222222222222222')
    expect(second.poolSol).toBeCloseTo(0.19, 5)

    ;(getTenantSlug as jest.Mock).mockReturnValue('_legacy')
    ;(getPayoutWalletAddressFromKey as jest.Mock).mockReturnValue(
      'PlatformWallet111111111111111111111111111'
    )
    ;(getPayoutWalletBalance as jest.Mock).mockResolvedValue({
      sol: 999,
      address: 'PlatformWallet111111111111111111111111111',
    })

    const third = await getLivePoolBalance()
    expect(third.poolSol).toBeCloseTo(0.01, 5)
    expect(getPayoutWalletBalance).toHaveBeenCalledTimes(2)
  })
})

describe('buildLivePoolBalance', () => {
  it('matches distributable pot math used on leaderboard and catalog', () => {
    const pool = buildLivePoolBalance(0.01858, 'Wallet1111111111111111111111111111111111', 73.88)
    expect(pool.poolSol).toBeCloseTo(0.00858, 5)
    expect(pool.poolUsdFormatted).toBe('$0.63')
  })
})
