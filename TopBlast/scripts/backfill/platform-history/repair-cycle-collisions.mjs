#!/usr/bin/env node
/**
 * Repair platform (_legacy) history after live payouts reused cycle 1/2
 * that the chain backfill already occupied.
 *
 * Moves LIVE colliding rows to cycles after max backfill (13, 14).
 * Sets payout_timer.currentCycle to the new max.
 *
 * Dry-run by default. --execute writes to DB "TB" only.
 *
 * Usage (from TopBlast/):
 *   node scripts/backfill/platform-history/repair-cycle-collisions.mjs
 *   node scripts/backfill/platform-history/repair-cycle-collisions.mjs --execute --allow-db=TB
 */
import dotenv from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..', '..')
dotenv.config({ path: join(root, '.env.local') })
dotenv.config({ path: join(root, '.env') })

const TENANT = '_legacy'
const MINT = 'JAKnM5B8pC7747QqGEGyeJmdAn55mmjb2Eqd2bpSpump'
const TIMER_KEY = 'payout_timer'
/** Live payouts on Aug 11 after backfill landed */
const LIVE_CUTOFF = new Date('2026-08-11T18:00:00.000Z')

function parseArgs(argv) {
  const out = { execute: false, allowDb: 'TB' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--execute') out.execute = true
    else if (a === '--allow-db' && argv[i + 1]) out.allowDb = argv[++i]
    else if (a.startsWith('--allow-db=')) out.allowDb = a.slice('--allow-db='.length)
  }
  return out
}

function fail(msg) {
  console.error(`\n[repair-cycles] FAIL: ${msg}`)
  process.exit(1)
}

function isLivePayout(row) {
  const created = row.createdAt ? new Date(row.createdAt) : null
  if (created && created >= LIVE_CUTOFF) return true
  // Live winners have real drawdown / loss; backfill left these at 0
  if (row.rank > 0 && (Math.abs(row.drawdownPct || 0) > 0.01 || (row.lossUsd || 0) > 0.01)) {
    return true
  }
  return false
}

function isLiveSwap(row) {
  const created = row.createdAt ? new Date(row.createdAt) : null
  return Boolean(created && created >= LIVE_CUTOFF)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!process.env.MONGODB_URI?.trim()) fail('MONGODB_URI not set')

  await mongoose.connect(process.env.MONGODB_URI)
  const dbName = mongoose.connection.name
  console.log(`[repair] connected db=${dbName}`)
  if (args.execute && dbName !== args.allowDb) {
    await mongoose.disconnect()
    fail(`Refusing write: connected to "${dbName}" but --allow-db=${args.allowDb}`)
  }

  const payoutsCol = mongoose.connection.collection('payouts')
  const swapsCol = mongoose.connection.collection('payoutvolumeswaps')
  const timersCol = mongoose.connection.collection('timerstates')

  const payouts = await payoutsCol
    .find({ tenantSlug: TENANT, tokenMint: MINT, cycle: { $in: [1, 2] } })
    .toArray()

  const liveByOldCycle = new Map()
  for (const p of payouts) {
    if (!isLivePayout(p)) continue
    if (!liveByOldCycle.has(p.cycle)) liveByOldCycle.set(p.cycle, [])
    liveByOldCycle.get(p.cycle).push(p)
  }

  const maxExisting = (
    await payoutsCol
      .aggregate([
        { $match: { tenantSlug: TENANT } },
        { $group: { _id: null, max: { $max: '$cycle' } } },
      ])
      .toArray()
  )[0]?.max ?? 0

  // Assign new cycles in order of old cycle number
  const oldCycles = [...liveByOldCycle.keys()].sort((a, b) => a - b)
  const remap = new Map()
  let next = Math.max(maxExisting, 12) + 1
  // If collisions only on 1/2 and max is 12, start at 13.
  // But if we already counted live rows in maxExisting (they're still cycle 1/2),
  // maxExisting is 12 from backfill — good.
  for (const old of oldCycles) {
    remap.set(old, next++)
  }

  const plan = []
  for (const [oldCycle, rows] of liveByOldCycle) {
    plan.push({
      oldCycle,
      newCycle: remap.get(oldCycle),
      payoutIds: rows.map(r => String(r._id)),
      payouts: rows.map(r => ({
        rank: r.rank,
        wallet: r.wallet?.slice(0, 4) + '…',
        usd: r.amount,
        tx: r.txHash?.slice(0, 8),
        createdAt: r.createdAt,
      })),
    })
  }

  const swaps = await swapsCol
    .find({ tenantSlug: TENANT, tokenMint: MINT, cycle: { $in: [1, 2] } })
    .toArray()
  const liveSwaps = swaps.filter(isLiveSwap)
  const swapPlan = liveSwaps.map(s => ({
    id: String(s._id),
    oldCycle: s.cycle,
    newCycle: remap.get(s.cycle),
    tx: s.txHash?.slice(0, 8),
    swapUsd: s.swapUsd,
    createdAt: s.createdAt,
  }))

  const newMaxCycle = Math.max(maxExisting, ...[...remap.values()], 0)
  const timer = await timersCol.findOne({ key: TIMER_KEY })

  console.log('\n=== PLAN ===')
  console.log(
    JSON.stringify(
      {
        maxExistingBefore: maxExisting,
        remap: Object.fromEntries(remap),
        payoutMoves: plan,
        swapMoves: swapPlan,
        timer: {
          key: TIMER_KEY,
          currentCycle: timer?.currentCycle,
          setTo: newMaxCycle,
          tokenMint: timer?.tokenMint,
        },
        execute: args.execute,
      },
      null,
      2
    )
  )

  if (!args.execute) {
    console.log('\nDry-run only. Re-run with --execute --allow-db=TB to apply.')
    await mongoose.disconnect()
    return
  }

  let payoutUpdated = 0
  for (const [oldCycle, rows] of liveByOldCycle) {
    const newCycle = remap.get(oldCycle)
    const ids = rows.map(r => r._id)
    const res = await payoutsCol.updateMany(
      { _id: { $in: ids } },
      { $set: { cycle: newCycle, updatedAt: new Date(), __cycleRepair: 'live-after-backfill' } }
    )
    payoutUpdated += res.modifiedCount
  }

  let swapUpdated = 0
  for (const s of liveSwaps) {
    const newCycle = remap.get(s.cycle)
    if (newCycle == null) continue
    const res = await swapsCol.updateOne(
      { _id: s._id },
      { $set: { cycle: newCycle, updatedAt: new Date(), __cycleRepair: 'live-after-backfill' } }
    )
    swapUpdated += res.modifiedCount
  }

  await timersCol.updateOne(
    { key: TIMER_KEY },
    {
      $set: {
        currentCycle: newMaxCycle,
        tokenMint: MINT,
        updatedAt: new Date(),
      },
    }
  )

  console.log('\n=== WRITE RESULT ===')
  console.log({ payoutUpdated, swapUpdated, timerCurrentCycle: newMaxCycle })

  await mongoose.disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
