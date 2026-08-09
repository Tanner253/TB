import mongoose from 'mongoose'
import connectDB from '@/lib/db'

export const TEST_FIXTURE_SLUGS = ['bonk', 'pepe'] as const
export const TEST_MINT_SUFFIX = 'Mint1111111111111111111111111111111111'

export function isJestTestFixtureTenant(doc: {
  slug?: string
  mint?: string
  encryptedPayoutKey?: string
}) {
  if (!doc) return false
  if (doc.slug && (TEST_FIXTURE_SLUGS as readonly string[]).includes(doc.slug)) return true
  if (doc.mint?.endsWith(TEST_MINT_SUFFIX)) return true
  if (doc.encryptedPayoutKey === 'enc') return true
  return false
}

export type PurgeTenantSummary = {
  slug: string
  tenants: number
  holders: number
  snapshots: number
  payouts: number
  payoutVolumeSwaps: number
  disqualifications: number
  poolBalances: number
  timerStates: number
  currentRankings: number
}

export async function purgeJestFixtureTenant(slug: string): Promise<PurgeTenantSummary> {
  const db = mongoose.connection.db
  if (!db) throw new Error('Database unavailable')

  const filter = { tenantSlug: slug }
  const timerKey = `${slug}:payout_timer`
  const rankingsKey = `${slug}:current_rankings`

  return {
    slug,
    tenants: (await db.collection('tenants').deleteMany({ slug })).deletedCount ?? 0,
    holders: (await db.collection('holders').deleteMany(filter)).deletedCount ?? 0,
    snapshots: (await db.collection('snapshots').deleteMany(filter)).deletedCount ?? 0,
    payouts: (await db.collection('payouts').deleteMany(filter)).deletedCount ?? 0,
    payoutVolumeSwaps:
      (await db.collection('payoutvolumeswaps').deleteMany(filter)).deletedCount ?? 0,
    disqualifications:
      (await db.collection('disqualifications').deleteMany(filter)).deletedCount ?? 0,
    poolBalances: (await db.collection('poolbalances').deleteMany(filter)).deletedCount ?? 0,
    timerStates:
      (
        await db.collection('timerstates').deleteMany({
          key: { $in: [timerKey, 'payout_timer'] },
        })
      ).deletedCount ?? 0,
    currentRankings:
      (
        await db.collection('currentrankings').deleteMany({
          key: { $in: [rankingsKey, 'current_rankings'] },
        })
      ).deletedCount ?? 0,
  }
}

export async function purgeAllJestFixtureTenants(): Promise<PurgeTenantSummary[]> {
  await connectDB()
  const db = mongoose.connection.db
  if (!db) throw new Error('Database unavailable')

  const candidates = await db.collection('tenants').find({}).toArray()
  const fixtures = candidates.filter(isJestTestFixtureTenant)

  const purged: PurgeTenantSummary[] = []
  for (const tenant of fixtures) {
    purged.push(await purgeJestFixtureTenant(tenant.slug as string))
  }
  return purged
}
