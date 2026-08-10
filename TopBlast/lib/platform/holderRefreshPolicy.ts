import 'server-only'

/** Active sessions — timer running, eligible holders, or funded pool. */
export interface HolderRefreshSession {
  timerStatus: 'waiting' | 'active'
  eligibleCount: number
  poolFunded: boolean
}

function parseMs(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Minimum gap between holder work on idle tenants (default 15 min). */
export function holderIdleRefreshIntervalMs(): number {
  return parseMs(process.env.HOLDER_IDLE_REFRESH_INTERVAL_MS, 15 * 60 * 1000)
}

/** Max age of a Birdeye snapshot before idle tenants refresh balances anyway (default 30 min). */
export function holderIdleSnapshotMaxAgeMs(): number {
  return parseMs(process.env.HOLDER_IDLE_SNAPSHOT_MAX_AGE_MS, 30 * 60 * 1000)
}

/** Max age before active tenants re-fetch Birdeye even if price is flat (default 5 min). */
export function holderActiveSnapshotMaxAgeMs(): number {
  return parseMs(process.env.HOLDER_ACTIVE_SNAPSHOT_MAX_AGE_MS, 5 * 60 * 1000)
}

/** Relative price move that triggers eligibility recompute (default 0.5%). */
export function holderPriceChangeThresholdPct(): number {
  const n = parseFloat(process.env.HOLDER_PRICE_CHANGE_THRESHOLD_PCT ?? '')
  return Number.isFinite(n) && n > 0 ? n : 0.5
}

/** Paused / dead listing — no timer, no winners, pool below minimum. */
export function isIdleTenantSession(session: HolderRefreshSession): boolean {
  return (
    session.timerStatus === 'waiting' &&
    session.eligibleCount <= 0 &&
    !session.poolFunded
  )
}

export function resolveHolderRefreshIntervalMs(session: HolderRefreshSession): number {
  return isIdleTenantSession(session)
    ? holderIdleRefreshIntervalMs()
    : parseMs(process.env.HOLDER_REFRESH_INTERVAL_MS, 60 * 1000)
}

export function hasMaterialPriceChange(
  previousPrice: number,
  nextPrice: number,
  thresholdPct = holderPriceChangeThresholdPct()
): boolean {
  if (!Number.isFinite(previousPrice) || previousPrice <= 0) return true
  if (!Number.isFinite(nextPrice) || nextPrice <= 0) return false
  const deltaPct = (Math.abs(nextPrice - previousPrice) / previousPrice) * 100
  return deltaPct >= thresholdPct
}
