import connectDB from '@/lib/db'
import { Holder } from '@/lib/db/models'
import { tenantFilter, tenantFields } from '@/lib/tenant/scope'

/**
 * Update an existing holder row or create one without upserting on tenantSlug+wallet
 * when a legacy row already exists under the same wallet (avoids wallet_1 dup key).
 */
export async function upsertTenantHolder(
  wallet: string,
  updates: Record<string, unknown>
): Promise<void> {
  await connectDB()

  const set = {
    ...updates,
    ...tenantFields(),
    updatedAt: new Date(),
  }

  const scoped = await Holder.findOne(tenantFilter({ wallet }))
  if (scoped) {
    await Holder.updateOne({ _id: scoped._id }, { $set: set })
    return
  }

  const legacy = await Holder.findOne({ wallet })
  if (legacy) {
    await Holder.updateOne({ _id: legacy._id }, { $set: set })
    return
  }

  await Holder.create({
    wallet,
    balance: 0,
    totalBought: 0,
    totalCostBasis: 0,
    ...set,
  })
}
