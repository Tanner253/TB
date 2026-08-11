/**
 * Read-only audit of platform (_legacy) payout cycles for TOPBLAST mint.
 * Does not write. Usage: node --import tsx scripts/audit-platform-payout-cycles.mjs
 * Or: npx tsx -e ... with mongoose from env
 */
import dotenv from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
dotenv.config({ path: join(root, '.env.local') })
dotenv.config({ path: join(root, '.env') })

const MINT = 'JAKnM5B8pC7747QqGEGyeJmdAn55mmjb2Eqd2bpSpump'
const TENANT = '_legacy'

function short(s, n = 8) {
  if (!s) return null
  return s.length <= n * 2 ? s : `${s.slice(0, n)}…${s.slice(-n)}`
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }

  await mongoose.connect(uri)
  const db = mongoose.connection.name
  console.log(JSON.stringify({ db, mint: MINT, tenant: TENANT }, null, 2))

  const payouts = mongoose.connection.collection('payouts')
  const swaps = mongoose.connection.collection('payoutvolumeswaps')
  const timers = mongoose.connection.collection('timerstates')
  const tenants = mongoose.connection.collection('tenants')

  const timerDocs = await timers.find({}).project({ tenantSlug: 1, currentCycle: 1, timerStatus: 1, lastPayoutTime: 1, updatedAt: 1 }).toArray()
  console.log('\n=== TimerState ===')
  console.log(JSON.stringify(timerDocs.map(t => ({
    tenantSlug: t.tenantSlug,
    currentCycle: t.currentCycle,
    timerStatus: t.timerStatus,
    lastPayoutTime: t.lastPayoutTime,
    updatedAt: t.updatedAt,
  })), null, 2))

  const tenantDocs = await tenants.find({
    $or: [{ mint: MINT }, { slug: { $in: ['topblast', '_legacy'] } }],
  }).project({ slug: 1, mint: 1, symbol: 1, status: 1 }).toArray()
  console.log('\n=== Tenants matching mint/slug ===')
  console.log(JSON.stringify(tenantDocs, null, 2))

  const filter = {
    $or: [
      { tenantSlug: TENANT },
      { tokenMint: MINT },
    ],
  }

  const all = await payouts.find(filter).sort({ cycle: 1, createdAt: 1 }).toArray()
  console.log(`\n=== Payouts count: ${all.length} ===`)

  const byCycle = new Map()
  for (const p of all) {
    const key = `${p.tenantSlug || '?'}#${p.cycle}`
    if (!byCycle.has(key)) byCycle.set(key, [])
    byCycle.get(key).push(p)
  }

  const cycleSummary = []
  for (const [key, rows] of [...byCycle.entries()].sort((a, b) => {
    const ca = Number(String(a[0]).split('#')[1]) || 0
    const cb = Number(String(b[0]).split('#')[1]) || 0
    return ca - cb
  })) {
    const ranks = rows.map(r => r.rank)
    const wallets = rows.map(r => short(r.wallet, 4))
    const txHashes = rows.map(r => short(r.txHash, 6))
    const usd = rows.reduce((s, r) => s + (r.amount || 0), 0)
    const rank1Count = ranks.filter(r => r === 1).length
    const feeCount = ranks.filter(r => r === 0).length
    const dupRank1 = rank1Count > 1
    const dupFee = feeCount > 1
    cycleSummary.push({
      key,
      n: rows.length,
      usd: Number(usd.toFixed(4)),
      ranks,
      rank1Count,
      feeCount,
      dupRank1,
      dupFee,
      wallets,
      txHashes,
      createdAts: rows.map(r => r.createdAt),
      amounts: rows.map(r => ({
        rank: r.rank,
        usd: r.amount,
        tokens: r.amountTokens,
        wallet: short(r.wallet, 4),
        tx: short(r.txHash, 6),
        lossUsd: r.lossUsd,
        drawdownPct: r.drawdownPct,
      })),
    })
  }

  console.log('\n=== Cycle summary ===')
  console.log(JSON.stringify(cycleSummary, null, 2))

  const cycles = [...new Set(all.map(p => p.cycle))].sort((a, b) => a - b)
  console.log('\n=== Cycle numbers present ===', cycles)
  console.log('maxCycle', cycles.length ? Math.max(...cycles) : null)

  // Duplicate txHashes
  const txMap = new Map()
  for (const p of all) {
    if (!p.txHash) continue
    if (!txMap.has(p.txHash)) txMap.set(p.txHash, [])
    txMap.get(p.txHash).push({ cycle: p.cycle, rank: p.rank, wallet: short(p.wallet, 4) })
  }
  const dupTx = [...txMap.entries()].filter(([, v]) => v.length > 1)
  console.log('\n=== Duplicate txHash rows ===', dupTx.length)
  if (dupTx.length) console.log(JSON.stringify(dupTx.slice(0, 20), null, 2))

  // Same cycle+rank collisions
  const collisions = cycleSummary.filter(c => c.dupRank1 || c.dupFee)
  console.log('\n=== Cycles with duplicate rank1 or fees ===', collisions.map(c => c.key))

  const swapRows = await swaps.find({ tenantSlug: TENANT }).sort({ cycle: 1 }).toArray()
  console.log(`\n=== Swap rows: ${swapRows.length} ===`)
  console.log(JSON.stringify(swapRows.map(s => ({
    cycle: s.cycle,
    swapSol: s.swapSol,
    swapUsd: s.swapUsd,
    tokens: s.outputTokensHuman,
    tx: short(s.txHash, 6),
    mint: short(s.tokenMint, 4),
  })), null, 2))

  await mongoose.disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
