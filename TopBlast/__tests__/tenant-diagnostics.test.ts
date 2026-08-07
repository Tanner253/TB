import { buildTenantDiagnostics } from '@/lib/tenant/diagnostics'

describe('tenant diagnostics', () => {
  const basePool = {
    payoutWalletAddress: 'DevWallet1111111111111111111111111111111',
    walletSol: 0,
    poolSol: 0,
    poolUsd: 0,
    solPrice: 150,
    poolUsdFormatted: '$0.00',
    poolSolFormatted: '0.0000',
    walletEth: 0,
    poolEth: 0,
    ethPrice: 150,
    poolEthFormatted: '0.0000',
    minLossUsd: 0,
    minLossUsdFormatted: '$0.00',
    available: true,
  }

  it('flags empty payout wallet as blocked', () => {
    const result = buildTenantDiagnostics({
      pool: { ...basePool, walletSol: 0, poolSol: 0, available: true },
      timer: { timer_status: 'waiting', seconds_remaining: null, current_cycle: 0, next_cycle: 1 },
      trackedHolders: 0,
      holdersWithVwap: 0,
      eligibleCount: 0,
      upcomingCount: 0,
      totalLosers: 0,
      trackerInitialized: false,
      hasRankings: false,
    })

    expect(result.overall).toBe('blocked')
    expect(result.items.some(i => i.id === 'pool_empty')).toBe(true)
  })

  it('explains waiting timer when no eligible holders', () => {
    const result = buildTenantDiagnostics({
      pool: { ...basePool, walletSol: 2, poolSol: 1.98, poolUsd: 297, poolUsdFormatted: '$297.00' },
      timer: { timer_status: 'waiting', seconds_remaining: null, current_cycle: 0, next_cycle: 1 },
      trackedHolders: 5,
      holdersWithVwap: 5,
      eligibleCount: 0,
      upcomingCount: 2,
      totalLosers: 3,
      trackerInitialized: true,
      hasRankings: true,
      ineligibleReasons: { 'Hold duration not met': 2, 'In profit': 1 },
    })

    expect(result.items.some(i => i.id === 'timer_waiting')).toBe(true)
    expect(result.items.some(i => i.id === 'ineligible_breakdown')).toBe(true)
  })

  it('reports healthy when funded with eligible holders', () => {
    const result = buildTenantDiagnostics({
      pool: { ...basePool, walletSol: 5, poolSol: 4.95, poolUsd: 742, poolUsdFormatted: '$742.50' },
      timer: { timer_status: 'active', seconds_remaining: 600, current_cycle: 1, next_cycle: 2 },
      trackedHolders: 10,
      holdersWithVwap: 8,
      eligibleCount: 2,
      upcomingCount: 1,
      totalLosers: 4,
      trackerInitialized: true,
      hasRankings: true,
    })

    expect(result.overall).toBe('healthy')
    expect(result.items.some(i => i.id === 'eligible_ready')).toBe(true)
  })
})
