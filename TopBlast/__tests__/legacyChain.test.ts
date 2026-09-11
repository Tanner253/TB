/**
 * Retirement policy for pre-migration Solana listings. The load-bearing rule
 * is that retiring is a presentation decision, never an accounting one: the
 * payout totals a listing carries must survive it untouched.
 */

import {
  annotateLegacyChainTenants,
  isLegacyChainListing,
} from '@/lib/platform/legacyChain'
import { isEvmAddressShape } from '@/lib/platform/chainShape'
import type { PublicTenantSummary } from '@/lib/tenant/types'

const PUMP_MINT = 'JAKnM5B8pC7747QqGEGyeJmdAn55mmjb2Eqd2bpSpump'
const PONS_TOKEN = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e'

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
    createdAt: new Date('2026-09-01T00:00:00Z').toISOString(),
    payoutWalletAddress: 'wallet',
    ...extra,
  }
}

describe('isEvmAddressShape', () => {
  it('accepts a 20-byte hex address in any case', () => {
    expect(isEvmAddressShape(PONS_TOKEN)).toBe(true)
    expect(isEvmAddressShape(PONS_TOKEN.toLowerCase())).toBe(true)
  })

  it('rejects the zero address, wrong lengths, and non-hex', () => {
    expect(isEvmAddressShape(`0x${'0'.repeat(40)}`)).toBe(false)
    expect(isEvmAddressShape('0x1234')).toBe(false)
    expect(isEvmAddressShape(`0x${'z'.repeat(40)}`)).toBe(false)
  })
})

describe('isLegacyChainListing', () => {
  it('retires base58 Solana mints', () => {
    expect(isLegacyChainListing(PUMP_MINT)).toBe(true)
  })

  it('keeps Pons tokens live, ignoring surrounding whitespace', () => {
    expect(isLegacyChainListing(PONS_TOKEN)).toBe(false)
    expect(isLegacyChainListing(`  ${PONS_TOKEN}  `)).toBe(false)
  })

  it('fails open on a missing mint rather than retiring on a guess', () => {
    expect(isLegacyChainListing('')).toBe(false)
    expect(isLegacyChainListing('   ')).toBe(false)
    expect(isLegacyChainListing(null)).toBe(false)
    expect(isLegacyChainListing(undefined)).toBe(false)
  })
})

describe('annotateLegacyChainTenants', () => {
  it('hides and deactivates Solana listings', () => {
    const [row] = annotateLegacyChainTenants([tenant('uponly', PUMP_MINT)])
    expect(row.catalog_hidden).toBe(true)
    expect(row.legacy_chain).toBe(true)
    expect(row.status).toBe('paused')
  })

  it('leaves Pons listings exactly as they were', () => {
    const input = tenant('blast', PONS_TOKEN)
    const [row] = annotateLegacyChainTenants([input])
    expect(row).toBe(input)
  })

  it('retires the platform token too — a stale platform mint is still stale', () => {
    const [row] = annotateLegacyChainTenants([
      tenant('topblast', PUMP_MINT, { isPlatformToken: true }),
    ])
    expect(row.catalog_hidden).toBe(true)
    expect(row.status).toBe('paused')
  })

  it('preserves payout accounting on retired rows', () => {
    const [row] = annotateLegacyChainTenants([
      tenant('uponly', PUMP_MINT, {
        total_distributed_usd: 2702.5,
        total_generated_volume_usd: 56,
        payout_count: 127,
      } as Partial<PublicTenantSummary>),
    ])
    expect(row.total_distributed_usd).toBe(2702.5)
    expect(row.total_generated_volume_usd).toBe(56)
  })

  it('annotates rather than drops, so aggregates still see every listing', () => {
    const rows = annotateLegacyChainTenants([
      tenant('uponly', PUMP_MINT, { total_distributed_usd: 100 }),
      tenant('blast', PONS_TOKEN, { total_distributed_usd: 50 }),
    ])
    expect(rows).toHaveLength(2)
    const paidToHolders = rows.reduce((sum, t) => sum + (t.total_distributed_usd ?? 0), 0)
    expect(paidToHolders).toBe(150)
    expect(rows.filter(t => t.status === 'active')).toHaveLength(1)
  })
})
