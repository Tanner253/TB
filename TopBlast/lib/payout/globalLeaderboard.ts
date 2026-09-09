import 'server-only'

/**
 * Hall of Fame — cross-session winner rankings.
 *
 * Aggregates the append-only Payout collection over EVERY listing (including
 * catalog-hidden ones — hiding is a browsing concern, never an accounting
 * one), producing all-time top winners and the biggest single payouts.
 *
 * Read-only: nothing here touches the payout engine.
 */

import connectDB from '@/lib/db'
import { Payout, Tenant } from '@/lib/db/models'
import { formatUsd } from '@/lib/solana/price'
import {
  getPlatformTenantSlug,
  getPlatformTokenSymbol,
} from '@/lib/platform/config'

export interface GlobalWinnerRow {
  rank: number
  wallet: string
  walletDisplay: string
  totalUsd: number
  totalUsdFormatted: string
  cyclesWon: number
  sessionsPlayed: number
  /** Session the wallet has earned the most from. */
  topSymbol: string
  topSessionSlug: string
  lastWinAt: string
}

export interface BiggestPayoutRow {
  rank: number
  wallet: string
  walletDisplay: string
  usd: number
  usdFormatted: string
  symbol: string
  sessionSlug: string
  cycle: number
  txHash: string | null
  at: string
}

export interface GlobalLeaderboardData {
  stats: {
    totalDistributedUsd: number
    totalDistributedUsdFormatted: string
    totalPayouts: number
    uniqueWinners: number
    sessions: number
  }
  topWinners: GlobalWinnerRow[]
  biggestPayouts: BiggestPayoutRow[]
  generatedAt: string
}

function shortWallet(w: string): string {
  return w.length > 12 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w
}

/** tenantSlug → { sessionSlug, symbol } for display. */
async function buildSessionLabels(): Promise<Map<string, { slug: string; symbol: string }>> {
  const map = new Map<string, { slug: string; symbol: string }>()
  map.set('_legacy', {
    slug: getPlatformTenantSlug(),
    symbol: getPlatformTokenSymbol(),
  })
  const rows = await Tenant.find().select('slug symbol').lean()
  for (const row of rows) {
    map.set(row.slug, { slug: row.slug, symbol: row.symbol })
  }
  return map
}

function labelFor(
  tenantSlug: string,
  labels: Map<string, { slug: string; symbol: string }>
): { slug: string; symbol: string } {
  return (
    labels.get(tenantSlug || '_legacy') ?? {
      slug: tenantSlug,
      symbol: (tenantSlug || 'TOKEN').toUpperCase(),
    }
  )
}

/** Winner payouts only — rank 0 is the platform dev fee, never a "winner". */
const WINNER_MATCH = { status: 'success', rank: { $gte: 1 } } as const

export async function fetchGlobalLeaderboard(limit = 25): Promise<GlobalLeaderboardData> {
  await connectDB()
  const labels = await buildSessionLabels()

  const [winnerAgg, biggestAgg, totalsAgg] = await Promise.all([
    // Top winners by lifetime USD won.
    Payout.aggregate<{
      _id: string
      totalUsd: number
      cyclesWon: number
      sessions: string[]
      lastWinAt: Date
      perSession: Array<{ tenantSlug: string; usd: number }>
    }>([
      { $match: WINNER_MATCH },
      {
        $group: {
          _id: { wallet: '$wallet', tenantSlug: '$tenantSlug' },
          sessionUsd: { $sum: '$amount' },
          sessionCycles: { $sum: 1 },
          lastWinAt: { $max: '$createdAt' },
        },
      },
      {
        $group: {
          _id: '$_id.wallet',
          totalUsd: { $sum: '$sessionUsd' },
          cyclesWon: { $sum: '$sessionCycles' },
          sessions: { $addToSet: '$_id.tenantSlug' },
          lastWinAt: { $max: '$lastWinAt' },
          perSession: {
            $push: { tenantSlug: '$_id.tenantSlug', usd: '$sessionUsd' },
          },
        },
      },
      { $sort: { totalUsd: -1 } },
      { $limit: limit },
    ]),

    // Biggest single winner payouts.
    Payout.aggregate<{
      wallet: string
      amount: number
      tenantSlug: string
      tokenSymbol: string | null
      cycle: number
      txHash: string | null
      createdAt: Date
    }>([
      { $match: WINNER_MATCH },
      { $sort: { amount: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          wallet: 1,
          amount: 1,
          tenantSlug: 1,
          tokenSymbol: 1,
          cycle: 1,
          txHash: 1,
          createdAt: 1,
        },
      },
    ]),

    // Global totals.
    Payout.aggregate<{
      _id: null
      totalUsd: number
      totalPayouts: number
      wallets: string[]
      sessions: string[]
    }>([
      { $match: WINNER_MATCH },
      {
        $group: {
          _id: null,
          totalUsd: { $sum: '$amount' },
          totalPayouts: { $sum: 1 },
          wallets: { $addToSet: '$wallet' },
          sessions: { $addToSet: '$tenantSlug' },
        },
      },
    ]),
  ])

  const topWinners: GlobalWinnerRow[] = winnerAgg.map((row, i) => {
    const best = [...(row.perSession ?? [])].sort((a, b) => b.usd - a.usd)[0]
    const label = labelFor(best?.tenantSlug ?? '_legacy', labels)
    return {
      rank: i + 1,
      wallet: row._id,
      walletDisplay: shortWallet(row._id),
      totalUsd: row.totalUsd,
      totalUsdFormatted: formatUsd(row.totalUsd),
      cyclesWon: row.cyclesWon,
      sessionsPlayed: (row.sessions ?? []).length,
      topSymbol: label.symbol,
      topSessionSlug: label.slug,
      lastWinAt: new Date(row.lastWinAt).toISOString(),
    }
  })

  const biggestPayouts: BiggestPayoutRow[] = biggestAgg.map((row, i) => {
    const label = labelFor(row.tenantSlug, labels)
    return {
      rank: i + 1,
      wallet: row.wallet,
      walletDisplay: shortWallet(row.wallet),
      usd: row.amount,
      usdFormatted: formatUsd(row.amount),
      symbol: row.tokenSymbol?.trim() || label.symbol,
      sessionSlug: label.slug,
      cycle: row.cycle,
      txHash: row.txHash ?? null,
      at: new Date(row.createdAt).toISOString(),
    }
  })

  const totals = totalsAgg[0]

  return {
    stats: {
      totalDistributedUsd: totals?.totalUsd ?? 0,
      totalDistributedUsdFormatted: formatUsd(totals?.totalUsd ?? 0),
      totalPayouts: totals?.totalPayouts ?? 0,
      uniqueWinners: (totals?.wallets ?? []).length,
      sessions: (totals?.sessions ?? []).length,
    },
    topWinners,
    biggestPayouts,
    generatedAt: new Date().toISOString(),
  }
}
