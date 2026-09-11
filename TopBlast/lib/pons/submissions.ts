import 'server-only'
import mongoose from 'mongoose'
import type { Hash } from 'viem'
import connectDB from '@/lib/db'
import { config } from '@/lib/config'
import { getTenantSlug } from '@/lib/tenant/context'
import { getChainId } from './contracts'
type Submission = { _id: string; fingerprint: string; hash?: Hash; createdAt: Date }
/** A crash after broadcast must never cause an automatic second payment. */
export async function submitOnce(action: string, fingerprint: string, send: () => Promise<Hash>): Promise<Hash> {
  await connectDB()
  const db = mongoose.connection.db
  if (!db) throw new Error('Payout journal requires a database')
  const { getCurrentPayoutCycle } = await import('@/lib/payout/executor')
  const id = [getChainId(), getTenantSlug(), config.tokenMint.toLowerCase(), getCurrentPayoutCycle() + 1, action].join(':')
  const journal = db.collection<Submission>('pons_payout_submissions')
  const existing = await journal.findOne({ _id: id })
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new Error('Payout terms changed; reconcile previous submission')
    if (existing.hash) return existing.hash
    throw new Error('Previous submission has unknown status; operator reconciliation required')
  }
  // Unique _id arbitrates concurrent requests before any signing occurs.
  await journal.insertOne({ _id: id, fingerprint, createdAt: new Date() })
  const hash = await send()
  await journal.updateOne({ _id: id }, { $set: { hash } })
  return hash
}
