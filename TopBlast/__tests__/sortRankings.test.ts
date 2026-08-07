import { sortLeaderboardEntries } from '@/lib/leaderboard/sortRankings'

describe('sortLeaderboardEntries', () => {
  const entry = (
    wallet: string,
    balance: number,
    vwap: number | null,
    isEligible: boolean,
    drawdownPct: number,
    lossUsd: number
  ) => ({
    holder: { wallet, balance, vwap },
    live: { isEligible, drawdownPct, lossUsd },
  })

  it('puts eligible holders first, then deepest drawdown', () => {
    const sorted = sortLeaderboardEntries([
      entry('c', 100, 0.002, false, 0, 0),
      entry('a', 100, 0.002, true, -20, 50),
      entry('b', 100, 0.002, false, -10, 20),
    ])

    expect(sorted.map(e => e.holder.wallet)).toEqual(['a', 'b', 'c'])
  })

  it('includes in-profit holders after underwater', () => {
    const sorted = sortLeaderboardEntries([
      entry('profit', 100, 0.002, false, 5, 0),
      entry('loss', 100, 0.002, false, -8, 12),
    ])

    expect(sorted[0].holder.wallet).toBe('loss')
    expect(sorted[1].holder.wallet).toBe('profit')
  })
})
