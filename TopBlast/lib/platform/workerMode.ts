import 'server-only'

/**
 * When true, Helius indexing / VWAP / payouts / Pump collect run only on the background
 * worker (POST /api/cron/tenants). Public API polls read MongoDB only.
 *
 * Set WORKER_OWNS_INDEXING=true on Vercel. Run a cron (Render, GitHub Actions, etc.)
 * that POSTs /api/cron/tenants every 1–2 minutes with CRON_SECRET.
 */
export function workerOwnsIndexing(): boolean {
  return process.env.WORKER_OWNS_INDEXING === 'true'
}

/** Leaderboard + catalog GET handlers must not trigger Helius or payout side effects. */
export function apiPollsAreReadOnly(): boolean {
  return workerOwnsIndexing()
}

/** Allow explicit ?refresh=1 to hit Helius even in worker mode (ops/debug only). */
export function allowManualHeliusRefreshOnPoll(): boolean {
  return process.env.ALLOW_MANUAL_HELIUS_REFRESH === 'true'
}

export function shouldRunHeliusOnLeaderboardPoll(forceRefresh: boolean): boolean {
  if (!apiPollsAreReadOnly()) return true
  return forceRefresh && allowManualHeliusRefreshOnPoll()
}
