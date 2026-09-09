/**
 * Catalog market-cap visibility policy: sub-floor listings are hidden from
 * the catalog (not deleted), with fail-open behavior everywhere data is
 * missing, an exemption for the platform token, and a grace window so
 * brand-new launches aren't hidden at birth.
 */

import {
  applyMarketCapVisibility,
  isBelowMarketCapFloor,
} from '@/lib/platform/catalogVisibility'
import type { PublicTenantSummary } from '@/lib/tenant/types'

const HOUR = 60 * 60 * 1000
const NOW = Date.parse('2026-09-09T12:00:00Z')

function tenant(
  slug: string,
  mint: string,
  extra: Partial<PublicTenantSummary> = {}
): PublicTenantSummary {
  return {
    slug,
    symbol: slug.toUpperCase(),
    mint,
    status: 'active',
    createdAt: new Date(NOW - 72 * HOUR).toISOString(), // old enough by default
    payoutWalletAddress: 'wallet',
    ...extra,
  }
}

const OPTS = { minUsd: 5000, graceMs: 24 * HOUR, nowMs: NOW }

describe('applyMarketCapVisibility', () => {
  it('flags (never removes) listings with a known market cap below the floor', () => {
    const tenants = [tenant('up', 'MintUp'), tenant('big', 'MintBig')]
    const mcaps = new Map<string, number | null>([
      ['MintUp', 1900],
      ['MintBig', 250_000],
    ])
    const out = applyMarketCapVisibility(tenants, mcaps, OPTS)
    // Aggregates depend on the full list surviving — nothing may be dropped.
    expect(out).toHaveLength(2)
    expect(out.find(t => t.slug === 'up')?.catalog_hidden).toBe(true)
    expect(out.find(t => t.slug === 'big')?.catalog_hidden).toBeUndefined()
  })

  it('never hides the platform token, regardless of market cap', () => {
    const tenants = [tenant('topblast', 'MintTB', { isPlatformToken: true })]
    const mcaps = new Map<string, number | null>([['MintTB', 100]])
    expect(applyMarketCapVisibility(tenants, mcaps, OPTS)[0].catalog_hidden).toBeUndefined()
  })

  it('fails open when the market cap is unknown', () => {
    const tenants = [tenant('mystery', 'MintX')]
    const mcaps = new Map<string, number | null>([['MintX', null]])
    expect(applyMarketCapVisibility(tenants, mcaps, OPTS)[0].catalog_hidden).toBeUndefined()
    expect(applyMarketCapVisibility(tenants, new Map(), OPTS)[0].catalog_hidden).toBeUndefined()
  })

  it('keeps fresh listings inside the grace window even below the floor', () => {
    const fresh = tenant('newborn', 'MintNew', {
      createdAt: new Date(NOW - 2 * HOUR).toISOString(),
    })
    const mcaps = new Map<string, number | null>([['MintNew', 900]])
    expect(applyMarketCapVisibility([fresh], mcaps, OPTS)[0].catalog_hidden).toBeUndefined()
    // …but flags it once the grace window has passed
    const aged = { ...fresh, createdAt: new Date(NOW - 30 * HOUR).toISOString() }
    expect(applyMarketCapVisibility([aged], mcaps, OPTS)[0].catalog_hidden).toBe(true)
  })

  it('a floor of 0 disables the filter entirely', () => {
    const tenants = [tenant('tiny', 'MintTiny')]
    const mcaps = new Map<string, number | null>([['MintTiny', 1]])
    expect(
      applyMarketCapVisibility(tenants, mcaps, { ...OPTS, minUsd: 0 })[0].catalog_hidden
    ).toBeUndefined()
  })

  it('keeps listings exactly at the floor', () => {
    const tenants = [tenant('edge', 'MintEdge')]
    const mcaps = new Map<string, number | null>([['MintEdge', 5000]])
    expect(applyMarketCapVisibility(tenants, mcaps, OPTS)[0].catalog_hidden).toBeUndefined()
  })
})

describe('isBelowMarketCapFloor (activity / dormancy policy)', () => {
  const BASE = { minUsd: 5000, graceMs: 24 * HOUR, nowMs: NOW }

  it('marks a sub-floor listing dormant so the cycle can skip it', () => {
    expect(
      isBelowMarketCapFloor({ ...BASE, marketCapUsd: 2936, createdAtMs: NOW - 72 * HOUR })
    ).toBe(true)
  })

  it('keeps healthy listings processing', () => {
    expect(
      isBelowMarketCapFloor({ ...BASE, marketCapUsd: 250_000, createdAtMs: NOW - 72 * HOUR })
    ).toBe(false)
  })

  it('never pauses the platform token', () => {
    expect(
      isBelowMarketCapFloor({
        ...BASE,
        isPlatformToken: true,
        marketCapUsd: 100,
        createdAtMs: NOW - 72 * HOUR,
      })
    ).toBe(false)
  })

  it('fails open when market data is unavailable — payouts keep running', () => {
    expect(
      isBelowMarketCapFloor({ ...BASE, marketCapUsd: null, createdAtMs: NOW - 72 * HOUR })
    ).toBe(false)
  })

  it('gives brand-new listings their grace window before pausing', () => {
    expect(
      isBelowMarketCapFloor({ ...BASE, marketCapUsd: 900, createdAtMs: NOW - 2 * HOUR })
    ).toBe(false)
    expect(
      isBelowMarketCapFloor({ ...BASE, marketCapUsd: 900, createdAtMs: NOW - 30 * HOUR })
    ).toBe(true)
  })

  it('env-driven listings with no createdAt still obey the floor', () => {
    expect(isBelowMarketCapFloor({ ...BASE, marketCapUsd: 900, createdAtMs: null })).toBe(true)
  })

  it('a floor of 0 disables dormancy entirely', () => {
    expect(
      isBelowMarketCapFloor({ ...BASE, minUsd: 0, marketCapUsd: 1, createdAtMs: NOW - 72 * HOUR })
    ).toBe(false)
  })

  it('dormancy and catalog hiding always agree (never hidden-but-billing)', () => {
    const cases: Array<{ mcap: number | null; ageHours: number; platform?: boolean }> = [
      { mcap: 2936, ageHours: 72 },
      { mcap: 250_000, ageHours: 72 },
      { mcap: null, ageHours: 72 },
      { mcap: 900, ageHours: 2 },
      { mcap: 100, ageHours: 72, platform: true },
      { mcap: 5000, ageHours: 72 },
    ]
    for (const c of cases) {
      const createdAt = new Date(NOW - c.ageHours * HOUR).toISOString()
      const t = tenant('x', 'MintX', { createdAt, isPlatformToken: c.platform })
      const hidden =
        applyMarketCapVisibility([t], new Map([['MintX', c.mcap]]), BASE)[0].catalog_hidden === true
      const dormant = isBelowMarketCapFloor({
        ...BASE,
        isPlatformToken: c.platform,
        createdAtMs: NOW - c.ageHours * HOUR,
        marketCapUsd: c.mcap,
      })
      expect({ ...c, hidden }).toEqual({ ...c, hidden: dormant })
    }
  })
})
