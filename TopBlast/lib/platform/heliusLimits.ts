/** Shared Helius Enhanced API limits — keep holderService and vwap in sync. */

export function heliusWalletTxMaxPages(): number {
  const raw = parseInt(process.env.HELIUS_WALLET_TX_MAX_PAGES || '4', 10)
  if (!Number.isFinite(raw) || raw < 1) return 4
  return Math.min(raw, 12)
}

export function leaderboardVwapHydrateMaxPerRequest(): number {
  const raw = parseInt(process.env.LEADERBOARD_VWAP_HYDRATE_MAX || '3', 10)
  if (!Number.isFinite(raw) || raw < 0) return 3
  return Math.min(raw, 24)
}

/** Wallets to hydrate buy history per background worker tick (cron). */
export function workerVwapHydrateMaxPerCycle(): number {
  const raw = parseInt(process.env.WORKER_VWAP_HYDRATE_MAX || '6', 10)
  if (!Number.isFinite(raw) || raw < 1) return 6
  return Math.min(raw, 20)
}

/** Parallel Helius wallet fetches during worker hydration (cron only). */
export function workerVwapHydrateConcurrency(): number {
  const raw = parseInt(process.env.WORKER_VWAP_HYDRATE_CONCURRENCY || '3', 10)
  if (!Number.isFinite(raw) || raw < 1) return 3
  return Math.min(raw, 8)
}

/** Inner hydration batches per cron tick — keep at 1 unless clearing a large backlog. */
export function workerVwapHydrateBatchesPerCycle(): number {
  const raw = parseInt(process.env.WORKER_VWAP_HYDRATE_BATCHES || '1', 10)
  if (!Number.isFinite(raw) || raw < 1) return 1
  return Math.min(raw, 3)
}
