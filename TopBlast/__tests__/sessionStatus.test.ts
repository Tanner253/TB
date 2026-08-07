import { deriveSessionStatus } from '@/lib/tenant/sessionStatus'

describe('deriveSessionStatus', () => {
  const basePool = {
    payoutWalletAddress: 'DevWallet1111111111111111111111111111111',
    walletSol: 2,
    poolSol: 1.98,
    poolUsd: 297,
    solPrice: 150,
    poolUsdFormatted: '$297.00',
    poolSolFormatted: '1.9800',
    walletEth: 2,
    poolEth: 1.98,
    ethPrice: 150,
    poolEthFormatted: '1.9800',
    minLossUsd: 0,
    minLossUsdFormatted: '$0.00',
    available: true,
  }

  const baseTimer = {
    timer_status: 'active' as const,
    seconds_remaining: 600,
    current_cycle: 1,
    next_cycle: 2,
  }

  it('returns null when session is healthy with active timer', () => {
    const status = deriveSessionStatus({
      pool: basePool,
      timer: baseTimer,
      trackedHolders: 10,
      holdersWithVwap: 8,
      eligibleCount: 2,
      upcomingCount: 0,
      totalLosers: 3,
      trackerInitialized: true,
      hasRankings: true,
    })
    expect(status).toBeNull()
  })

  it('surfaces empty pool as persistent error', () => {
    const status = deriveSessionStatus({
      pool: { ...basePool, walletSol: 0, poolSol: 0 },
      timer: { timer_status: 'waiting', seconds_remaining: null, current_cycle: 0, next_cycle: 1 },
      trackedHolders: 0,
      holdersWithVwap: 0,
      eligibleCount: 0,
      upcomingCount: 0,
      totalLosers: 0,
      trackerInitialized: false,
      hasRankings: false,
    })
    expect(status?.tone).toBe('error')
    expect(status?.persistent).toBe(true)
  })

  it('shows loading while indexing', () => {
    const status = deriveSessionStatus({
      pool: basePool,
      timer: { timer_status: 'waiting', seconds_remaining: null, current_cycle: 0, next_cycle: 1 },
      trackedHolders: 0,
      holdersWithVwap: 0,
      eligibleCount: 0,
      upcomingCount: 0,
      totalLosers: 0,
      trackerInitialized: false,
      hasRankings: false,
    })
    expect(status?.tone).toBe('loading')
    expect(status?.message).toMatch(/indexing/i)
  })
})
