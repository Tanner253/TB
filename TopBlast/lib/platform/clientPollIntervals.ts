/** Client poll intervals — increase these to cut serverless traffic at scale. */

export const DEFAULT_LEADERBOARD_POLL_MS = parseClientPollMs(
  process.env.NEXT_PUBLIC_LEADERBOARD_POLL_MS,
  60_000
)

export const DEFAULT_CATALOG_POLL_MS = parseClientPollMs(
  process.env.NEXT_PUBLIC_CATALOG_POLL_MS,
  60_000
)

export const DEFAULT_STATS_POLL_MS = parseClientPollMs(
  process.env.NEXT_PUBLIC_STATS_POLL_MS,
  60_000
)

export const DEFAULT_HISTORY_POLL_MS = parseClientPollMs(
  process.env.NEXT_PUBLIC_HISTORY_POLL_MS,
  60_000
)

function parseClientPollMs(raw: string | undefined, fallback: number): number {
  const n = raw ? parseInt(raw, 10) : fallback
  if (!Number.isFinite(n) || n < 5_000) return fallback
  return Math.min(n, 300_000)
}
