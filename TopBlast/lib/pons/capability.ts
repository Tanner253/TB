import 'server-only'

/**
 * What a Pons launch can still do, in one place.
 *
 * A launch moves through phases and each one takes something away, so the
 * question is never "is this healthy" but "how much of the cycle still works".
 * Answering that centrally is what lets a listing keep paying through
 * graduation instead of stopping at the first thing that broke.
 *
 *   phase 0  NotGraduated  full service — index, buy on the curve, airdrop
 *   phase 1  Swept         transient: the curve closed, the pool isn't up yet
 *   phase 2  PoolCreated   graduated — trades in a Uniswap v4 pool
 *   phase 3  Rescued       terminal
 *
 * Graduation is the interesting one. Two separate things break, and they are
 * worth keeping apart:
 *
 *   - BUYING needs a v4-aware router, which this chain has no confirmed
 *     canonical deployment of yet (set PONS_V4_ROUTER once it does). Without
 *     it we cannot do the on-chart buyback — but we can still pay winners ETH
 *     straight from the pool, which is an existing, fully supported payout
 *     mode. So the cycle degrades instead of stopping.
 *
 *   - COST BASIS for wallets that bought *after* graduation comes from v4
 *     swap events we do not index yet. Balances are unaffected (they are
 *     plain ERC-20 Transfers), and everyone who bought on the curve keeps the
 *     exact VWAP we already recorded. Holders with no known basis fall out of
 *     the rankings on their own — `hasTransferIn` already excludes them —
 *     which is the right failure: never pay someone on a guessed entry price.
 *
 * Net effect: a graduated listing keeps running, keeps paying its curve-era
 * holders, and pays in ETH until the router lands. Nothing silently changes
 * meaning; `degradedReason` says exactly what is reduced and why.
 */

import { config } from '@/lib/config'
import { LaunchPhase, isTestnet } from './contracts'
import { getPonsLaunch, type PonsLaunch } from './launch'

export interface PonsCapability {
  /** Nothing at all can run this cycle. */
  halted: boolean
  /** Holder balances and rankings can be rebuilt. */
  canIndex: boolean
  /** An on-chart buy of the session token is possible. */
  canBuyback: boolean
  /**
   * True when new entries can no longer be priced (post-graduation buyers).
   * Existing curve-era holders keep their exact basis.
   */
  costBasisPartial: boolean
  venue: 'curve' | 'uniswap-v4' | 'transitional' | 'none'
  /** Why service is reduced — surfaced in logs and on the listing page. */
  degradedReason: string | null
  /** Set when the cycle should stop outright. */
  haltReason: string | null
  launch: PonsLaunch | null
}

function halt(reason: string, launch: PonsLaunch | null = null): PonsCapability {
  return {
    halted: true,
    canIndex: false,
    canBuyback: false,
    costBasisPartial: false,
    venue: 'none',
    degradedReason: null,
    haltReason: reason,
    launch,
  }
}

/** A v4-aware router, once one is configured for this chain. */
export function v4RouterConfigured(): boolean {
  return Boolean(process.env.PONS_V4_ROUTER?.trim())
}

export async function resolvePonsCapability(
  tokenAddress: string = config.tokenMint
): Promise<PonsCapability> {
  if (isTestnet()) {
    return halt('Pons is only deployed on Robinhood Chain mainnet')
  }

  const launch = await getPonsLaunch(tokenAddress)
  if (!launch) {
    return halt('Not a Pons v2 launch')
  }

  // Rankings price cost basis in ETH, so a launch quoted in some other token
  // would rank against the wrong denominator. Refuse rather than mis-rank.
  if (!launch.nativeQuote) {
    return halt('Launch is quoted in a custom pair token, not ETH', launch)
  }

  switch (launch.phase) {
    case LaunchPhase.NotGraduated:
      return {
        halted: false,
        canIndex: true,
        canBuyback: true,
        costBasisPartial: false,
        venue: 'curve',
        degradedReason: null,
        haltReason: null,
        launch,
      }

    case LaunchPhase.Swept:
      // Minutes at most: the curve has closed and the pool is being created.
      return halt('Launch is mid-graduation — the next cycle picks it up', launch)

    case LaunchPhase.PoolCreated: {
      const canBuyback = v4RouterConfigured()
      return {
        halted: false,
        canIndex: true,
        canBuyback,
        costBasisPartial: true,
        venue: 'uniswap-v4',
        degradedReason: canBuyback
          ? 'Graduated to Uniswap v4 — wallets that bought after graduation are not ranked yet'
          : 'Graduated to Uniswap v4 — paying winners in ETH until a v4 router is configured, ' +
            'and wallets that bought after graduation are not ranked yet',
        haltReason: null,
        launch,
      }
    }

    case LaunchPhase.Rescued:
    default:
      return halt('Launch is in the rescued state', launch)
  }
}
