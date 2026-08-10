import 'server-only'

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Top wallets by balance fetched from Birdeye per refresh (default 150). */
export function birdeyeHolderFetchMax(): number {
  return parsePositiveInt(process.env.BIRDEYE_HOLDER_FETCH_MAX, 150)
}

/** Winner-ranked rows persisted to Mongo + shown on leaderboard (default 50). */
export function leaderboardPersistMax(): number {
  return parsePositiveInt(process.env.LEADERBOARD_PERSIST_MAX, 50)
}
