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
