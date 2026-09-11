import 'server-only'

/**
 * Retirement policy for the pre-migration Solana listings.
 *
 * TopBlast runs on Robinhood Chain now. The old base58 listings can't be
 * indexed, priced, or paid on this chain, so leaving them "live" would show
 * phantom countdowns and burn Solana API credits on sessions that will never
 * pay again.
 *
 * Same shape as the market-cap floor in `catalogVisibility.ts`, and for the
 * same reason — retiring a listing is a *presentation and activity* decision,
 * never an accounting one:
 *
 *  1. VISIBILITY — flagged `catalog_hidden`, so browsing surfaces skip it.
 *  2. ACTIVITY   — reported as `paused`, so "live sessions" counts it out, and
 *                  the automated cycle returns before spending anything.
 *  3. ACCOUNTING — untouched. Every historical payout still counts toward
 *                  "paid to holders", the history pages and the Hall of Fame.
 *                  Those numbers are a record of what happened; a chain
 *                  migration doesn't unhappen them.
 *
 * The rule is the address shape itself, so nothing has to be maintained: a
 * listing is current exactly when its token is an EVM address. The moment a
 * Pons (`0x…`) token is configured — platform or self-serve — it is live, and
 * the retired Solana rows stay retired without a flag day or a migration.
 */

import { isLegacyChainMint } from '@/lib/platform/chainShape'
import type { PublicTenantSummary } from '@/lib/tenant/types'

/** True for a listing whose token lives on the chain we left behind. */
export const isLegacyChainListing = isLegacyChainMint

/**
 * Annotates (never drops) a catalog list. Retired rows keep every field they
 * had — including their payout totals — and only gain the two flags that hide
 * them from browsing and stop them counting as live.
 */
export function annotateLegacyChainTenants(
  tenants: PublicTenantSummary[]
): PublicTenantSummary[] {
  let retired = 0
  const annotated = tenants.map(tenant => {
    if (!isLegacyChainListing(tenant.mint)) return tenant
    retired++
    return {
      ...tenant,
      catalog_hidden: true,
      legacy_chain: true,
      status: 'paused' as const,
      // Live-only signals are zeroed: a session that will never run another
      // cycle must not advertise a countdown or holders who are "eligible
      // right now". Cumulative fields (total_distributed_usd, payout_count,
      // generated volume) are deliberately left alone — see the note above.
      payout_timer_status: 'waiting' as const,
      payout_seconds_remaining: null,
      payout_eligible_count: 0,
    }
  })

  if (retired > 0) {
    console.log(
      `[LegacyChain] ${retired} Solana listing(s) retired from browsing and marked inactive ` +
        '(payout history and totals unaffected)'
    )
  }
  return annotated
}
