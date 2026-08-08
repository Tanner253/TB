import { buildSessionChecklist } from '@/lib/tenant/sessionChecklist'

describe('buildSessionChecklist', () => {
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
    minLossUsd: 29.7,
    minLossUsdFormatted: '$29.70',
    available: true,
  }

  it('marks holders indexed when DB has trackable wallets (cold serverless tracker)', () => {
    const checklist = buildSessionChecklist({
      pool: basePool,
      timer: { timer_status: 'waiting', seconds_remaining: null, current_cycle: 0, next_cycle: 1 },
      trackedHolders: 3,
      holdersWithVwap: 2,
      eligibleCount: 0,
      upcomingCount: 0,
      totalLosers: 0,
      trackerInitialized: false,
      hasRankings: true,
      minLossUsdFormatted: '$29.70',
    })

    expect(checklist.items.find(i => i.id === 'index')?.status).toBe('met')
    expect(checklist.overall).not.toBe('loading')
  })

  it('marks session loading while indexing', () => {
    const checklist = buildSessionChecklist({
      pool: basePool,
      timer: { timer_status: 'waiting', seconds_remaining: null, current_cycle: 0, next_cycle: 1 },
      trackedHolders: 0,
      holdersWithVwap: 0,
      eligibleCount: 0,
      upcomingCount: 0,
      totalLosers: 0,
      trackerInitialized: false,
      hasRankings: false,
      minLossUsdFormatted: '$29.70',
    })

    expect(checklist.overall).toBe('loading')
    expect(checklist.items.find(i => i.id === 'index')?.status).toBe('pending')
  })

  it('surfaces hold-duration blockers in headline', () => {
    const checklist = buildSessionChecklist({
      pool: basePool,
      timer: { timer_status: 'waiting', seconds_remaining: null, current_cycle: 0, next_cycle: 1 },
      trackedHolders: 3,
      holdersWithVwap: 3,
      eligibleCount: 0,
      upcomingCount: 2,
      totalLosers: 2,
      trackerInitialized: true,
      hasRankings: true,
      ineligibleReasons: { 'Hold duration not met': 2 },
      minLossUsdFormatted: '$29.70',
    })

    expect(checklist.headline.toLowerCase()).toContain('hold duration')
    expect(checklist.blockers).toHaveLength(1)
    expect(checklist.items.find(i => i.id === 'hold')?.status).toBe('blocked')
  })

  it('marks pool blocked when funded below USD minimum', () => {
    const checklist = buildSessionChecklist({
      pool: {
        ...basePool,
        walletSol: 0.01,
        poolSol: 0.009,
        poolUsd: 0.67,
        solPrice: 67,
        poolUsdFormatted: '$0.67',
      },
      timer: { timer_status: 'active', seconds_remaining: 0, current_cycle: 10, next_cycle: 11 },
      trackedHolders: 5,
      holdersWithVwap: 5,
      eligibleCount: 1,
      upcomingCount: 0,
      totalLosers: 1,
      trackerInitialized: true,
      hasRankings: true,
      minLossUsdFormatted: '$0.06',
    })

    expect(checklist.overall).toBe('blocked')
    expect(checklist.items.find(i => i.id === 'pool')?.status).toBe('blocked')
    expect(checklist.items.find(i => i.id === 'timer')?.status).toBe('blocked')
  })

  it('marks winner rules met when eligible holders exist', () => {
    const checklist = buildSessionChecklist({
      pool: basePool,
      timer: { timer_status: 'active', seconds_remaining: 600, current_cycle: 1, next_cycle: 2 },
      trackedHolders: 5,
      holdersWithVwap: 5,
      eligibleCount: 2,
      upcomingCount: 0,
      totalLosers: 3,
      trackerInitialized: true,
      hasRankings: true,
      minLossUsdFormatted: '$29.70',
    })

    expect(checklist.overall).toBe('ready')
    expect(checklist.items.filter(i => i.group === 'winner').every(i => i.status === 'met')).toBe(true)
  })
})
