import 'server-only'

/** Minimum accrued Pump creator fees (USD) before auto-collect on leaderboard poll. */
export function minPumpCollectUsd(): number {
  const raw = parseFloat(process.env.PUMP_MIN_COLLECT_USD || '1')
  return Number.isFinite(raw) && raw > 0 ? raw : 1
}

/** Min ms between collect attempts per tenant (leaderboard polls can be frequent). */
export function pumpCollectThrottleMs(): number {
  const raw = parseInt(process.env.PUMP_COLLECT_MIN_INTERVAL_MS || '300000', 10)
  return Number.isFinite(raw) && raw >= 0 ? raw : 300_000
}

export function isPumpAutoCollectEnabled(): boolean {
  const raw = process.env.PUMP_AUTO_COLLECT_ENABLED?.trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return true
}
