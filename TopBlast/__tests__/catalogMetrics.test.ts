import { catalogPayoutTenantKey } from '@/lib/platform/catalogMetrics'
import type { PublicTenantSummary } from '@/lib/tenant/types'

describe('catalogMetrics', () => {
  it('maps env platform listing to _legacy payout scope', () => {
    const tenant: PublicTenantSummary = {
      slug: 'topblast',
      symbol: 'TBLAST',
      mint: 'Mint1111111111111111111111111111111111',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      payoutWalletAddress: 'Pool1111111111111111111111111111111111',
      runsFromEnv: true,
    }
    expect(catalogPayoutTenantKey(tenant)).toBe('_legacy')
  })

  it('maps SaaS tenant slug to its own payout scope', () => {
    const tenant: PublicTenantSummary = {
      slug: 'alpha',
      symbol: 'ALPHA',
      mint: 'Mint2222222222222222222222222222222222',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      payoutWalletAddress: 'Pool2222222222222222222222222222222222',
    }
    expect(catalogPayoutTenantKey(tenant)).toBe('alpha')
  })
})

describe('catalogClient formatters', () => {
  it('formats pot and volume when metrics are present', async () => {
    const { formatCatalogPot, formatCatalogVolume } = await import('@/lib/platform/catalogClient')
    const tenant: PublicTenantSummary = {
      slug: 'topblast',
      symbol: 'TBLAST',
      mint: 'Mint1111111111111111111111111111111111',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      payoutWalletAddress: 'Pool1111111111111111111111111111111111',
      pot_sol: 0.0076,
      pot_usd: 0.56,
      pot_usd_formatted: '$0.56',
      total_distributed_sol: 0.094829,
      total_distributed_usd: 6.32,
      total_distributed_usd_formatted: '$6.32',
    }

    expect(formatCatalogPot(tenant)).toContain('$0.56')
    expect(formatCatalogVolume(tenant)).toBe('$6.32')
  })
})

describe('catalogClient payout timer', () => {
  it('detects paused payout timer on live listings', async () => {
    const { isCatalogPayoutPaused, catalogPayoutTimerLabel } = await import('@/lib/platform/catalogClient')
    const paused: PublicTenantSummary = {
      slug: 'topblast',
      symbol: 'TBLAST',
      mint: 'Mint1111111111111111111111111111111111',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      payoutWalletAddress: 'Pool1111111111111111111111111111111111',
      payout_timer_status: 'waiting',
      payout_eligible_count: 0,
      payout_ranked_count: 8,
    }
    const running: PublicTenantSummary = {
      ...paused,
      payout_timer_status: 'active',
      payout_seconds_remaining: 600,
      payout_eligible_count: 2,
    }

    expect(isCatalogPayoutPaused(paused)).toBe(true)
    expect(catalogPayoutTimerLabel(paused)).toBe('Waiting for volume')
    expect(isCatalogPayoutPaused(running)).toBe(false)
    expect(catalogPayoutTimerLabel(running)).toBe('Payouts active')
  })

  it('shows timer starting when eligible but timer waiting', async () => {
    const { catalogPayoutTimerLabel } = await import('@/lib/platform/catalogClient')
    const starting: PublicTenantSummary = {
      slug: 'topblast',
      symbol: 'TBLAST',
      mint: 'Mint1111111111111111111111111111111111',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      payoutWalletAddress: 'Pool1111111111111111111111111111111111',
      payout_timer_status: 'waiting',
      payout_eligible_count: 3,
    }
    expect(catalogPayoutTimerLabel(starting)).toBe('Timer starting')
  })

  it('treats stale active timer as limbo when enrichment zeroes eligibility', async () => {
    const { isCatalogPayoutPaused } = await import('@/lib/platform/catalogClient')
    const staleActive: PublicTenantSummary = {
      slug: 'topblast',
      symbol: 'TBLAST',
      mint: 'Mint1111111111111111111111111111111111',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      payoutWalletAddress: 'Pool1111111111111111111111111111111111',
      payout_timer_status: 'waiting',
      payout_seconds_remaining: null,
      payout_eligible_count: 0,
      payout_ranked_count: 8,
    }
    expect(isCatalogPayoutPaused(staleActive)).toBe(true)
  })
})
