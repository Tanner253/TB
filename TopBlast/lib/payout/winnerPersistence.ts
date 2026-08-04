/**
 * Persist winner cooldown + VWAP reset to MongoDB (serverless-safe).
 */

import connectDB from '@/lib/db'
import { Holder, CurrentRankings, Payout } from '@/lib/db/models'

const RANKINGS_KEY = 'current_rankings'

export async function persistWinnerAfterPayout(
  wallet: string,
  cycle: number,
  tokenPrice: number
): Promise<void> {
  if (!wallet || !tokenPrice) return

  await connectDB()
  const walletLower = wallet.toLowerCase()

  await Holder.findOneAndUpdate(
    { wallet: walletLower },
    {
      $set: {
        lastWinCycle: cycle,
        vwap: tokenPrice,
        isEligible: false,
        ineligibleReason: 'Winner cooldown',
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  )

  const doc = await CurrentRankings.findOne({ key: RANKINGS_KEY })
  if (!doc?.rankings?.length) return

  let changed = false
  for (const row of doc.rankings) {
    if (row.wallet?.toLowerCase() === walletLower) {
      row.lastWinCycle = cycle
      row.vwap = tokenPrice
      row.drawdownPct = 0
      row.lossUsd = 0
      row.isEligible = false
      row.ineligibleReason = 'Winner cooldown'
      changed = true
    }
  }

  if (changed) {
    doc.eligibleCount = doc.rankings.filter(r => r.isEligible).length
    doc.lastCalculated = new Date()
    doc.markModified('rankings')
    await doc.save()
  }
}

/** Latest successful winner cycle from Payout records (source of truth after pay). */
async function loadLastWinCycleFromPayouts(
  walletsLower: string[]
): Promise<Map<string, number>> {
  const wanted = new Set(walletsLower)
  const result = new Map<string, number>()
  if (wanted.size === 0) return result

  const payouts = await Payout.find({
    status: 'success',
    rank: { $gte: 1 },
  })
    .select('wallet cycle')
    .sort({ cycle: -1 })
    .lean()

  for (const p of payouts) {
    const w = p.wallet?.toLowerCase()
    if (!w || !wanted.has(w) || result.has(w)) continue
    result.set(w, p.cycle)
  }

  return result
}

/**
 * Merge lastWinCycle from Holder + successful Payout rows.
 * Payout fallback covers serverless cases where Holder was not updated.
 */
export async function loadLastWinCycleByWallet(
  wallets: string[]
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>()
  if (wallets.length === 0) return result

  await connectDB()
  const normalized = [...new Set(wallets.map(w => w.toLowerCase()))]

  const holderDocs = await Holder.find({
    $or: normalized.map(w => ({
      wallet: new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })),
  })
    .select('wallet lastWinCycle')
    .lean()

  for (const doc of holderDocs) {
    result.set(doc.wallet.toLowerCase(), doc.lastWinCycle ?? null)
  }

  const fromPayouts = await loadLastWinCycleFromPayouts(normalized)

  for (const w of normalized) {
    const holderCycle = result.get(w) ?? null
    const payoutCycle = fromPayouts.get(w) ?? null
    const cycles = [holderCycle, payoutCycle].filter((c): c is number => c != null)
    result.set(w, cycles.length > 0 ? Math.max(...cycles) : null)
  }

  return result
}
