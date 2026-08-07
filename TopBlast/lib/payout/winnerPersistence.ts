/**
 * Persist winner cooldown + VWAP reset to MongoDB (serverless-safe).
 */

import connectDB from '@/lib/db'
import { Holder, CurrentRankings, Payout } from '@/lib/db/models'
import { getRankingsKey } from '@/lib/tenant/keys'
import { tenantFilter, tenantFields } from '@/lib/tenant/scope'

export async function persistWinnerAfterPayout(
  wallet: string,
  cycle: number,
  tokenPrice: number
): Promise<void> {
  if (!wallet || !tokenPrice) return

  await connectDB()

  await Holder.findOneAndUpdate(
    tenantFilter({ wallet }),
    {
      $set: {
        lastWinCycle: cycle,
        vwap: tokenPrice,
        isEligible: false,
        ineligibleReason: 'Winner cooldown',
        updatedAt: new Date(),
        ...tenantFields(),
      },
    },
    { upsert: true }
  )

  const doc = await CurrentRankings.findOne({ key: getRankingsKey() })
  if (!doc?.rankings?.length) return

  let changed = false
  for (const row of doc.rankings) {
    if (row.wallet === wallet) {
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

async function loadLastWinCycleFromPayouts(
  wallets: string[]
): Promise<Map<string, number>> {
  const wanted = new Set(wallets)
  const result = new Map<string, number>()
  if (wanted.size === 0) return result

  const payouts = await Payout.find({
    ...tenantFilter(),
    status: 'success',
    rank: { $gte: 1 },
    wallet: { $in: [...wanted] },
  })
    .select('wallet cycle')
    .sort({ cycle: -1 })
    .lean()

  for (const p of payouts) {
    const w = p.wallet
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
  const normalized = [...new Set(wallets.filter(Boolean))]
  const result = new Map<string, number | null>()
  if (normalized.length === 0) return result

  await connectDB()

  for (const w of normalized) {
    result.set(w, null)
  }

  const holderDocs = await Holder.find(tenantFilter({ wallet: { $in: normalized } }))
    .select('wallet lastWinCycle')
    .lean()

  for (const doc of holderDocs) {
    if (normalized.includes(doc.wallet)) {
      result.set(doc.wallet, doc.lastWinCycle ?? null)
    }
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
