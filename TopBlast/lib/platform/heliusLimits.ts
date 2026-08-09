/** Shared Helius Enhanced API limits — keep holderService and vwap in sync. */

export function heliusWalletTxMaxPages(): number {
  const raw = parseInt(process.env.HELIUS_WALLET_TX_MAX_PAGES || '12', 10)
  if (!Number.isFinite(raw) || raw < 1) return 12
  return Math.min(raw, 30)
}

export function leaderboardVwapHydrateMaxPerRequest(): number {
  const raw = parseInt(process.env.LEADERBOARD_VWAP_HYDRATE_MAX || '3', 10)
  if (!Number.isFinite(raw) || raw < 0) return 3
  return Math.min(raw, 24)
}

/** Wallets to hydrate buy history per background worker tick (cron). */
export function workerVwapHydrateMaxPerCycle(): number {
  const raw = parseInt(process.env.WORKER_VWAP_HYDRATE_MAX || '24', 10)
  if (!Number.isFinite(raw) || raw < 1) return 24
  return Math.min(raw, 50)
}

/** Parallel Helius wallet fetches during worker hydration (cron only). */
export function workerVwapHydrateConcurrency(): number {
  const raw = parseInt(process.env.WORKER_VWAP_HYDRATE_CONCURRENCY || '10', 10)
  if (!Number.isFinite(raw) || raw < 1) return 10
  return Math.min(raw, 15)
}

/** Inner hydration batches per cron tick (clears backlog faster). */
export function workerVwapHydrateBatchesPerCycle(): number {
  const raw = parseInt(process.env.WORKER_VWAP_HYDRATE_BATCHES || '3', 10)
  if (!Number.isFinite(raw) || raw < 1) return 3
  return Math.min(raw, 5)
}
