import 'server-only'

/**
 * Market-cap floor policy for listings (default $5k). Below the floor a token
 * usually can't be routed by Jupiter at all (TOKEN_NOT_TRADABLE), so cycles
 * just fail loudly while burning Birdeye/Helius/Jupiter credits.
 *
 * Two effects, one threshold:
 *  1. VISIBILITY — the listing is flagged `catalog_hidden` so browsing
 *     surfaces skip it. Aggregates (totals, history, Hall of Fame) still
 *     count it: hiding is a browsing concern, never an accounting one.
 *  2. ACTIVITY — the automated cycle skips it entirely (no holder indexing,
 *     no price pulls, no swap attempts), which is where the credits are.
 *
 * Dormant ≠ deleted: the session, its /slug pages and its payout history all
 * stay live, and the moment the token trades back above the floor the next
 * cycle picks it up automatically. Fail-open everywhere: unknown market data
 * never hides or pauses a listing, and fresh listings get a grace window so
 * brand-new launches (which naturally start tiny) aren't stopped at birth.
 */

import axios from 'axios'
import type { PublicTenantSummary } from '@/lib/tenant/types'
import {
  selectBestSolanaPair,
  type DexScreenerPairLike,
} from '@/lib/solana/dexscreenerShared'

const DEXSCREENER_TOKENS = 'https://api.dexscreener.com/latest/dex/tokens'
const DEX_BATCH = 30
const MCAP_CACHE_TTL_MS = 5 * 60 * 1000

/** $0 disables the filter entirely. */
export function minCatalogMarketCapUsd(): number {
  const n = parseFloat(process.env.MIN_CATALOG_MARKET_CAP_USD ?? '')
  return Number.isFinite(n) && n >= 0 ? n : 5000
}

/** Listings younger than this are always shown (new launches start small). */
export function catalogMarketCapGraceHours(): number {
  const n = parseFloat(process.env.CATALOG_MCAP_GRACE_HOURS ?? '')
  return Number.isFinite(n) && n >= 0 ? n : 24
}

const mcapCache = new Map<string, { mcap: number | null; at: number }>()

type PairWithFdv = DexScreenerPairLike & { fdv?: number; marketCap?: number }

/** Market caps for mints (null = unknown). Cached ~5 min per mint. */
export async function getMarketCapsForMints(
  mints: string[]
): Promise<Map<string, number | null>> {
  const now = Date.now()
  const out = new Map<string, number | null>()
  const toFetch: string[] = []

  for (const mint of mints) {
    const hit = mcapCache.get(mint)
    if (hit && now - hit.at < MCAP_CACHE_TTL_MS) {
      out.set(mint, hit.mcap)
    } else {
      toFetch.push(mint)
    }
  }

  for (let i = 0; i < toFetch.length; i += DEX_BATCH) {
    const batch = toFetch.slice(i, i + DEX_BATCH)
    try {
      const res = await axios.get(`${DEXSCREENER_TOKENS}/${batch.join(',')}`, {
        timeout: 10000,
        headers: { Accept: 'application/json' },
      })
      const pairs: PairWithFdv[] = res.data?.pairs ?? []
      for (const mint of batch) {
        const best = selectBestSolanaPair(pairs, mint) as PairWithFdv | null
        const mcap = best?.marketCap ?? best?.fdv ?? null
        const value = Number.isFinite(mcap as number) && (mcap as number) > 0 ? (mcap as number) : null
        mcapCache.set(mint, { mcap: value, at: now })
        out.set(mint, value)
      }
    } catch (err) {
      console.warn(
        '[CatalogVisibility] Market cap fetch failed (fail-open):',
        err instanceof Error ? err.message : err
      )
      for (const mint of batch) out.set(mint, null)
    }
  }

  return out
}

/**
 * Pure policy — exported for tests. ANNOTATES (never drops): every tenant
 * comes back, sub-floor ones flagged `catalog_hidden`. Aggregates built from
 * the full list (homepage totals, history, stats) are therefore unaffected;
 * only browsing surfaces skip flagged rows.
 */
export function applyMarketCapVisibility(
  tenants: PublicTenantSummary[],
  mcaps: Map<string, number | null>,
  opts: { minUsd: number; graceMs: number; nowMs?: number }
): PublicTenantSummary[] {
  if (opts.minUsd <= 0) return tenants
  const now = opts.nowMs ?? Date.now()

  return tenants.map(t => {
    const below = isBelowMarketCapFloor({
      isPlatformToken: t.isPlatformToken,
      createdAtMs: t.createdAt ? new Date(t.createdAt).getTime() : null,
      marketCapUsd: t.mint ? (mcaps.get(t.mint.trim()) ?? null) : null,
      minUsd: opts.minUsd,
      graceMs: opts.graceMs,
      nowMs: now,
    })
    return below ? { ...t, catalog_hidden: true } : t
  })
}

/**
 * Pure activity policy — exported for tests. Mirrors the visibility rule so a
 * listing is never hidden-but-still-billing (or dormant-but-still-advertised).
 */
export function isBelowMarketCapFloor(input: {
  isPlatformToken?: boolean
  createdAtMs?: number | null
  marketCapUsd: number | null
  minUsd: number
  graceMs: number
  nowMs?: number
}): boolean {
  if (input.minUsd <= 0) return false
  if (input.isPlatformToken) return false
  const now = input.nowMs ?? Date.now()
  const created = input.createdAtMs ?? 0
  if (Number.isFinite(created) && created > 0 && now - created < input.graceMs) return false
  if (input.marketCapUsd == null) return false // unknown → fail open
  return input.marketCapUsd < input.minUsd
}

/**
 * Should the automated cycle skip this listing entirely?
 * Called once per tenant per cycle; the market-cap lookup is cached ~5 min and
 * costs one free DexScreener call, replacing a full Birdeye + Helius + Jupiter
 * round trip for dead tokens. Never throws — on any error we process as usual.
 */
export async function isTenantDormantByMarketCap(input: {
  tenantSlug: string
  mint: string
  isPlatformToken?: boolean
  createdAtMs?: number | null
}): Promise<{ dormant: boolean; marketCapUsd: number | null; minUsd: number }> {
  const minUsd = minCatalogMarketCapUsd()
  try {
    if (minUsd <= 0 || input.isPlatformToken || !input.mint) {
      return { dormant: false, marketCapUsd: null, minUsd }
    }
    const mcaps = await getMarketCapsForMints([input.mint.trim()])
    const marketCapUsd = mcaps.get(input.mint.trim()) ?? null
    const dormant = isBelowMarketCapFloor({
      isPlatformToken: input.isPlatformToken,
      createdAtMs: input.createdAtMs,
      marketCapUsd,
      minUsd,
      graceMs: catalogMarketCapGraceHours() * 60 * 60 * 1000,
    })
    return { dormant, marketCapUsd, minUsd }
  } catch (err) {
    console.warn(
      `[CatalogVisibility] Dormancy check failed for ${input.tenantSlug} (processing anyway):`,
      err instanceof Error ? err.message : err
    )
    return { dormant: false, marketCapUsd: null, minUsd }
  }
}

/** Annotates a catalog list with the policy — never throws, fail-open. */
export async function annotateCatalogTenantsByMarketCap(
  tenants: PublicTenantSummary[]
): Promise<PublicTenantSummary[]> {
  try {
    const minUsd = minCatalogMarketCapUsd()
    if (minUsd <= 0 || tenants.length === 0) return tenants

    const mints = Array.from(
      new Set(
        tenants
          .filter(t => !t.isPlatformToken && t.mint)
          .map(t => t.mint.trim())
      )
    )
    if (mints.length === 0) return tenants

    const mcaps = await getMarketCapsForMints(mints)
    const annotated = applyMarketCapVisibility(tenants, mcaps, {
      minUsd,
      graceMs: catalogMarketCapGraceHours() * 60 * 60 * 1000,
    })

    const hidden = annotated.filter(t => t.catalog_hidden).length
    if (hidden > 0) {
      console.log(
        `[CatalogVisibility] ${hidden} listing(s) under $${minUsd.toLocaleString()} market cap hidden from browsing (sessions + stats unaffected)`
      )
    }
    return annotated
  } catch (err) {
    console.warn(
      '[CatalogVisibility] Annotation skipped (fail-open):',
      err instanceof Error ? err.message : err
    )
    return tenants
  }
}
