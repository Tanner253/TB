import { mergeLiveHolderBalances } from '@/lib/leaderboard/mergeLiveHolderBalances'

jest.mock('@/lib/config', () => ({
  config: {
    tokenDecimals: 6,
    minTokenHolding: 1000,
  },
}))

jest.mock('@/lib/eligibility/excludedWallets', () => ({
  isExcludedParticipantWallet: () => false,
}))

jest.mock('@/lib/eligibility/liquidityPools', () => ({
  isLiquidityPoolWallet: () => false,
}))

describe('mergeLiveHolderBalances', () => {
  const mint = 'So11111111111111111111111111111111111111112'

  it('updates stale DB balances from live chain data', () => {
    const map = new Map([
      [
        'walletA',
        {
          wallet: 'walletA',
          balance: 73_499_640,
          vwap: 0.001,
          drawdownPct: -46,
          lossUsd: 100,
          isEligible: false,
          ineligibleReason: null,
        },
      ],
    ])

    const stats = mergeLiveHolderBalances(
      map,
      [{ wallet: 'walletA', balance: 30_200_000 * 1_000_000, isContract: false }],
      mint
    )

    expect(map.get('walletA')?.balance).toBe(30_200_000)
    expect(stats.qualifying).toBe(1)
  })

  it('removes wallets that no longer hold the token', () => {
    const map = new Map([
      [
        'soldOut',
        {
          wallet: 'soldOut',
          balance: 5_000_000,
          vwap: 0.001,
          drawdownPct: -10,
          lossUsd: 10,
          isEligible: false,
          ineligibleReason: null,
        },
      ],
      [
        'stillIn',
        {
          wallet: 'stillIn',
          balance: 1_000_000,
          vwap: 0.001,
          drawdownPct: -5,
          lossUsd: 5,
          isEligible: false,
          ineligibleReason: null,
        },
      ],
    ])

    mergeLiveHolderBalances(
      map,
      [{ wallet: 'stillIn', balance: 2_000_000 * 1_000_000, isContract: false }],
      mint
    )

    expect(map.has('soldOut')).toBe(false)
    expect(map.get('stillIn')?.balance).toBe(2_000_000)
    expect(map.size).toBe(1)
  })

  it('adds newly qualifying on-chain holders', () => {
    const map = new Map<string, any>()

    mergeLiveHolderBalances(
      map,
      [{ wallet: 'newGuy', balance: 5_000_000 * 1_000_000, isContract: false }],
      mint
    )

    expect(map.get('newGuy')?.balance).toBe(5_000_000)
    expect(map.get('newGuy')?.ineligibleReason).toBe('Loading buy history...')
  })
})
