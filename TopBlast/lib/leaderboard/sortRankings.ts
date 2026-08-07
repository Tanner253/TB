/** Sort leaderboard rows: eligible losers first, then ineligible underwater, then the rest. */

export interface SortableLeaderboardEntry {
  holder: { balance: number; vwap?: number | null }
  live: { isEligible: boolean; drawdownPct: number; lossUsd: number }
}

export function sortLeaderboardEntries<T extends SortableLeaderboardEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.live.isEligible !== b.live.isEligible) {
      return a.live.isEligible ? -1 : 1
    }

    const aHasVwap = (a.holder.vwap ?? 0) > 0
    const bHasVwap = (b.holder.vwap ?? 0) > 0
    const aUnderwater = aHasVwap && a.live.drawdownPct < 0
    const bUnderwater = bHasVwap && b.live.drawdownPct < 0

    if (aUnderwater !== bUnderwater) {
      return aUnderwater ? -1 : 1
    }

    if (aHasVwap && bHasVwap && a.live.drawdownPct !== b.live.drawdownPct) {
      return a.live.drawdownPct - b.live.drawdownPct
    }

    if (a.live.lossUsd !== b.live.lossUsd) {
      return b.live.lossUsd - a.live.lossUsd
    }

    return b.holder.balance - a.holder.balance
  })
}
