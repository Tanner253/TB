/**
 * Holder-behavior event capture — turns overwritten leaderboard state into an
 * append-only history so retention questions ("does the tech make people
 * hold?") become answerable later.
 *
 * Called from the two places CurrentRankings is persisted. STRICTLY
 * failure-isolated: every entry point swallows its own errors — an analytics
 * hiccup must never break a refresh, a timer sync, or a payout.
 */

import type { HolderEventSource, HolderEventType } from '@/lib/db/analyticsModels'

/** Minimal ranking-row shape shared by both persist paths. */
export interface EventRankingRow {
  wallet: string
  balance: number
  isEligible: boolean
  drawdownPct?: number | null
}

export interface HolderEventInput {
  tenantSlug: string
  wallet: string
  type: HolderEventType
  balance: number
  prevBalance: number | null
  delta: number
  tokenPrice: number
  drawdownPct: number | null
  isEligible: boolean
  source: HolderEventSource
}

export interface DiffContext {
  tenantSlug: string
  tokenPrice: number
  source: HolderEventSource
  /** Board capacity — when the next board is full, disappearances are ambiguous. */
  persistMax: number
}

/** Ignore balance jitter below 0.2% of the previous balance. */
const MIN_RELATIVE_DELTA = 0.002

/** Hard cap on events recorded per persist (priority-ordered before cutting). */
const MAX_EVENTS_PER_PERSIST = 400

const TYPE_PRIORITY: Record<HolderEventType, number> = {
  sold_out: 0,
  eligible_enter: 1,
  eligible_exit: 1,
  balance_decrease: 2,
  balance_increase: 3,
  dropped_out: 4,
  first_seen: 5,
}

/**
 * Pure diff of two consecutive leaderboard snapshots into behavior events.
 * Balance events are only derived on chain refreshes (price recomputes reuse
 * stored balances); eligibility transitions are recorded from both sources —
 * price-driven flips are exactly the threshold-discontinuity signal.
 */
export function diffRankingsForEvents(
  prev: EventRankingRow[],
  next: EventRankingRow[],
  ctx: DiffContext
): HolderEventInput[] {
  const events: HolderEventInput[] = []
  const prevByWallet = new Map(prev.map(r => [r.wallet, r]))
  const nextWallets = new Set(next.map(r => r.wallet))
  const chainData = ctx.source === 'chain_refresh'

  const base = {
    tenantSlug: ctx.tenantSlug,
    tokenPrice: ctx.tokenPrice,
    source: ctx.source,
  }

  for (const row of next) {
    const before = prevByWallet.get(row.wallet)
    const drawdownPct = row.drawdownPct ?? null

    if (!before) {
      if (chainData) {
        events.push({
          ...base,
          wallet: row.wallet,
          type: 'first_seen',
          balance: row.balance,
          prevBalance: null,
          delta: row.balance,
          drawdownPct,
          isEligible: row.isEligible,
        })
      }
      continue
    }

    if (chainData) {
      const delta = row.balance - before.balance
      const relative = Math.abs(delta) / Math.max(before.balance, 1)
      if (relative >= MIN_RELATIVE_DELTA) {
        events.push({
          ...base,
          wallet: row.wallet,
          type: delta > 0 ? 'balance_increase' : 'balance_decrease',
          balance: row.balance,
          prevBalance: before.balance,
          delta,
          drawdownPct,
          isEligible: row.isEligible,
        })
      }
    }

    if (row.isEligible !== before.isEligible) {
      events.push({
        ...base,
        wallet: row.wallet,
        type: row.isEligible ? 'eligible_enter' : 'eligible_exit',
        balance: row.balance,
        prevBalance: before.balance,
        delta: 0,
        drawdownPct,
        isEligible: row.isEligible,
      })
    }
  }

  // Disappearances only mean something when fresh chain data was pulled.
  if (chainData) {
    const boardFull = next.length >= ctx.persistMax
    for (const row of prev) {
      if (nextWallets.has(row.wallet)) continue
      events.push({
        ...base,
        wallet: row.wallet,
        // On a board with free space, vanishing means the position closed.
        // On a full board it may just be the top-N cut — keep it, flagged.
        type: boardFull ? 'dropped_out' : 'sold_out',
        balance: 0,
        prevBalance: row.balance,
        delta: -row.balance,
        drawdownPct: row.drawdownPct ?? null,
        isEligible: false,
      })
    }
  }

  if (events.length > MAX_EVENTS_PER_PERSIST) {
    events.sort((a, b) => TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type])
    events.length = MAX_EVENTS_PER_PERSIST
  }

  return events
}

function isEnabled(): boolean {
  return process.env.HOLDER_EVENTS_ENABLED?.trim().toLowerCase() !== 'false'
}

/**
 * Diff + persist, never throws. Call AFTER the rankings write succeeds so a
 * failed refresh never fabricates history.
 */
export async function recordHolderEventsSafe(
  prev: EventRankingRow[] | null | undefined,
  next: EventRankingRow[],
  ctx: DiffContext
): Promise<number> {
  try {
    if (!isEnabled()) return 0
    if (!ctx.tenantSlug) return 0
    const events = diffRankingsForEvents(prev ?? [], next, ctx)
    if (events.length === 0) return 0

    const { HolderEvent } = await import('@/lib/db/analyticsModels')
    await HolderEvent.insertMany(events, { ordered: false })
    return events.length
  } catch (err) {
    console.warn(
      '[HolderEvents] Skipped event capture (analytics only, refresh unaffected):',
      err instanceof Error ? err.message : err
    )
    return 0
  }
}
