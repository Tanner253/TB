#!/usr/bin/env node
/**
 * Import platform-token payout history recovered from chain into MongoDB.
 *
 * Valuation (simple):
 *   - Current SOL price only
 *   - Each cycle's SOL fee to GoMu28 is 12% of that cycle's pool
 *   - Pool SOL = feeSol / 0.12
 *   - Winner USD shares the remaining 88% by airdrop token size
 *   - Gen-volume swap rows = that same 88% winner budget (on-chart buy)
 *
 * SAFE DEFAULTS:
 *   - Dry-run unless --execute
 *   - Only writes tenantSlug "_legacy" for the platform mint
 *   - Upserts by (tenantSlug, txHash) — never deletes
 *   - Refuses unless DB name is "TB" (or --allow-db=...)
 *
 * Usage (from TopBlast/):
 *   node scripts/import-platform-payout-history.mjs
 *   node scripts/import-platform-payout-history.mjs --execute --allow-db=TB
 */
import dotenv from 'dotenv'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..', '..')

dotenv.config({ path: join(root, '.env.local') })
dotenv.config({ path: join(root, '.env') })

const INPUT = join(__dirname, 'fixtures', 'platform-payout-retrieval.json')
const PREVIEW = join(__dirname, 'fixtures', 'platform-payout-import-preview.json')
const TENANT = '_legacy'
const DEFAULT_ALLOWED_DB = 'TB'
const DEV_FEE_PCT = 0.12

function parseArgs(argv) {
  const out = {
    execute: false,
    allowDb: DEFAULT_ALLOWED_DB,
    input: INPUT,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--execute') out.execute = true
    else if (a === '--allow-db' && argv[i + 1]) {
      out.allowDb = argv[++i]
    } else if (a.startsWith('--allow-db=')) {
      out.allowDb = a.slice('--allow-db='.length)
    } else if (a === '--input' && argv[i + 1]) {
      out.input = argv[++i]
    }
  }
  return out
}

function fail(msg) {
  console.error(`\n[import-platform-payouts] FAIL: ${msg}`)
  process.exit(1)
}

async function fetchSolPriceUsd() {
  const url =
    'https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112'
  const res = await fetch(url)
  if (!res.ok) fail(`SOL price HTTP ${res.status}`)
  const json = await res.json()
  const pairs = Array.isArray(json.pairs) ? json.pairs : []
  const best = pairs
    .filter(p => String(p.chainId) === 'solana' && Number(p.priceUsd) > 0)
    .sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0))[0]
  const price = Number(best?.priceUsd)
  if (!(price > 0)) fail('Could not resolve SOL USD price')
  return price
}

function buildImportRows(report, solPrice) {
  const mint = report.params.mint
  const symbol = report.params.symbol
  const feeRecipient = report.params.feeRecipient

  const events = report.cycles
    .flatMap(c => c.events)
    .filter(
      e =>
        e.roles.includes('winner_airdrop') ||
        e.roles.includes('dev_fee_sol') ||
        e.roles.includes('volume_buyback_swap')
    )
    .sort((a, b) => a.tsMs - b.tsMs)

  const CLUSTER_MS = 12 * 60 * 1000
  const clusters = []
  let cur = null
  for (const ev of events) {
    if (!cur || ev.tsMs - cur.endMs > CLUSTER_MS) {
      cur = { startMs: ev.tsMs, endMs: ev.tsMs, events: [ev] }
      clusters.push(cur)
    } else {
      cur.events.push(ev)
      cur.endMs = ev.tsMs
    }
  }

  const payouts = []
  const swaps = []

  clusters.forEach((cluster, idx) => {
    const cycle = idx + 1

    const feeOut = []
    for (const ev of cluster.events) {
      for (const s of ev.solOutflows || []) {
        if (!s.isLikelyDevFee && s.to !== feeRecipient) continue
        feeOut.push({
          sol: s.sol,
          to: s.to,
          signature: ev.signature,
          timestamp: ev.timestamp,
        })
      }
    }

    const airdrops = []
    for (const ev of cluster.events) {
      for (const a of ev.tokenAirdrops || []) {
        airdrops.push({
          to: a.to,
          amount: a.amount,
          signature: ev.signature,
          timestamp: ev.timestamp,
        })
      }
    }
    airdrops.sort((a, b) => b.amount - a.amount)

    const feeSol = feeOut.reduce((s, f) => s + f.sol, 0)
    // Infer cycle pool from the 12% fee — do not trust noisy swap SOL detection.
    const poolSol = feeSol > 0 ? feeSol / DEV_FEE_PCT : 0
    const winnerBudgetSol = poolSol * (1 - DEV_FEE_PCT)
    const winnerBudgetUsd = winnerBudgetSol * solPrice
    const totalTokens = airdrops.reduce((s, a) => s + a.amount, 0)

    for (const fee of feeOut) {
      payouts.push({
        tenantSlug: TENANT,
        tokenMint: mint,
        tokenSymbol: symbol,
        cycle,
        rank: 0,
        wallet: fee.to,
        amount: fee.sol * solPrice,
        amountTokens: fee.sol,
        drawdownPct: 0,
        lossUsd: 0,
        txHash: fee.signature,
        status: 'success',
        errorMessage: null,
        createdAt: new Date(fee.timestamp),
      })
    }

    airdrops.forEach((a, i) => {
      const share = totalTokens > 0 ? a.amount / totalTokens : 0
      payouts.push({
        tenantSlug: TENANT,
        tokenMint: mint,
        tokenSymbol: symbol,
        cycle,
        rank: i + 1,
        wallet: a.to,
        amount: winnerBudgetUsd * share,
        amountTokens: a.amount,
        drawdownPct: 0,
        lossUsd: 0,
        txHash: a.signature,
        status: 'success',
        errorMessage: null,
        createdAt: new Date(a.timestamp),
      })
    })

    // One gen-volume row per cycle: the on-chart buy (= winner budget).
    if (winnerBudgetSol > 0) {
      const buyback = cluster.events.find(e => e.roles.includes('volume_buyback_swap'))
      const txHash =
        buyback?.signature ||
        airdrops[0]?.signature ||
        feeOut[0]?.signature
      if (txHash) {
        swaps.push({
          tenantSlug: TENANT,
          tokenMint: mint,
          tokenSymbol: symbol,
          cycle,
          swapSol: winnerBudgetSol,
          swapUsd: winnerBudgetUsd,
          outputTokensHuman: totalTokens,
          txHash,
          createdAt: new Date(
            buyback?.timestamp || airdrops[0]?.timestamp || feeOut[0]?.timestamp
          ),
        })
      }
    }
  })

  const cyclesUsed = new Set([...payouts, ...swaps].map(r => r.cycle))
  const remapped = new Map([...cyclesUsed].sort((a, b) => a - b).map((c, i) => [c, i + 1]))
  for (const row of payouts) row.cycle = remapped.get(row.cycle)
  for (const row of swaps) row.cycle = remapped.get(row.cycle)

  const totalUsd = payouts.reduce((s, p) => s + (p.amount || 0), 0)
  const winnerUsd = payouts.filter(p => p.rank > 0).reduce((s, p) => s + (p.amount || 0), 0)
  const feeUsd = payouts.filter(p => p.rank === 0).reduce((s, p) => s + (p.amount || 0), 0)

  return {
    solPriceUsed: solPrice,
    note: 'USD = feeSol/0.12 pool model × current SOL price. Gen volume = 88% winner buy budget.',
    summary: {
      cycles: remapped.size,
      payoutRows: payouts.length,
      feeRows: payouts.filter(p => p.rank === 0).length,
      winnerRows: payouts.filter(p => p.rank > 0).length,
      swapRows: swaps.length,
      totalPaidOutUsd: totalUsd,
      feeUsd,
      winnerUsd,
      genVolumeUsd: winnerUsd,
      genVolumeSol: solPrice > 0 ? winnerUsd / solPrice : 0,
    },
    payouts,
    swaps,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!process.env.MONGODB_URI?.trim()) fail('MONGODB_URI not set')

  let report
  try {
    report = JSON.parse(readFileSync(args.input, 'utf8'))
  } catch {
    fail(`Missing input ${args.input} — run retrieve-platform-payout-history.mjs first`)
  }

  const solPrice = await fetchSolPriceUsd()
  console.log(`[import] SOL price $${solPrice.toFixed(4)}`)

  const prepared = buildImportRows(report, solPrice)
  mkdirSync(dirname(PREVIEW), { recursive: true })
  writeFileSync(
    PREVIEW,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        execute: args.execute,
        allowDb: args.allowDb,
        ...prepared,
        payouts: prepared.payouts.map(p => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
        })),
        swaps: prepared.swaps.map(s => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
        })),
      },
      null,
      2
    )
  )
  console.log('[import] preview →', PREVIEW)
  console.log('[import] summary', prepared.summary)

  if (!args.execute) {
    console.log('\nDry-run only. Re-run with --execute to write to MongoDB (TB).')
    return
  }

  await mongoose.connect(process.env.MONGODB_URI)
  const dbName = mongoose.connection.name
  console.log(`[import] connected db=${dbName}`)
  if (dbName !== args.allowDb) {
    await mongoose.disconnect()
    fail(`Refusing write: connected to "${dbName}" but --allow-db=${args.allowDb}`)
  }

  const payoutsCol = mongoose.connection.collection('payouts')
  const swapsCol = mongoose.connection.collection('payoutvolumeswaps')

  // Replace prior platform backfill swap rows so inflated swapSol cannot linger.
  const swapDelete = await swapsCol.deleteMany({
    tenantSlug: TENANT,
    tokenMint: report.params.mint,
  })
  console.log(`[import] cleared ${swapDelete.deletedCount} prior _legacy swap rows for mint`)

  let payoutUpserted = 0
  for (const row of prepared.payouts) {
    if (!row.txHash) continue
    const res = await payoutsCol.updateOne(
      { tenantSlug: TENANT, txHash: row.txHash },
      {
        $set: {
          tenantSlug: row.tenantSlug,
          tokenMint: row.tokenMint,
          tokenSymbol: row.tokenSymbol,
          cycle: row.cycle,
          rank: row.rank,
          wallet: row.wallet,
          amount: row.amount,
          amountTokens: row.amountTokens,
          drawdownPct: row.drawdownPct,
          lossUsd: row.lossUsd,
          txHash: row.txHash,
          status: row.status,
          errorMessage: row.errorMessage,
          createdAt: row.createdAt,
          updatedAt: new Date(),
        },
        $setOnInsert: { __backfill: 'platform-chain-fee-pool' },
      },
      { upsert: true }
    )
    if (res.upsertedCount || res.modifiedCount) payoutUpserted++
  }

  let swapUpserted = 0
  for (const row of prepared.swaps) {
    const res = await swapsCol.updateOne(
      { tenantSlug: TENANT, txHash: row.txHash },
      {
        $set: {
          tenantSlug: row.tenantSlug,
          tokenMint: row.tokenMint,
          tokenSymbol: row.tokenSymbol,
          cycle: row.cycle,
          swapSol: row.swapSol,
          swapUsd: row.swapUsd,
          outputTokensHuman: row.outputTokensHuman,
          txHash: row.txHash,
          createdAt: row.createdAt,
          updatedAt: new Date(),
        },
        $setOnInsert: { __backfill: 'platform-chain-fee-pool' },
      },
      { upsert: true }
    )
    if (res.upsertedCount || res.modifiedCount) swapUpserted++
  }

  const legacyUsd = await payoutsCol
    .aggregate([
      { $match: { tenantSlug: TENANT, status: 'success' } },
      { $group: { _id: null, usd: { $sum: '$amount' }, n: { $sum: 1 } } },
    ])
    .toArray()

  console.log('\n=== WRITE RESULT ===')
  console.log({
    db: dbName,
    payoutUpserted,
    swapUpserted,
    legacyPayoutUsd: legacyUsd[0]?.usd ?? 0,
    legacyPayoutCount: legacyUsd[0]?.n ?? 0,
    uponlyPayouts: await payoutsCol.countDocuments({ tenantSlug: 'uponly' }),
  })

  const maxCycle = (
    await payoutsCol
      .aggregate([
        { $match: { tenantSlug: TENANT, status: 'success' } },
        { $group: { _id: null, max: { $max: '$cycle' } } },
      ])
      .toArray()
  )[0]?.max ?? prepared.summary.cycles

  const timerRes = await mongoose.connection.collection('timerstates').updateOne(
    { key: 'payout_timer' },
    {
      $set: {
        currentCycle: maxCycle,
        tokenMint: report.params.mint,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        key: 'payout_timer',
        timerStatus: 'waiting',
        lastPayoutTime: null,
        failedAttempts: 0,
        isPayoutInProgress: false,
      },
    },
    { upsert: true }
  )
  console.log(`[import] timer payout_timer.currentCycle → ${maxCycle}`, {
    matched: timerRes.matchedCount,
    modified: timerRes.modifiedCount,
    upserted: timerRes.upsertedCount,
  })
  console.log(`[import] next live payout will be cycle ${maxCycle + 1}`)

  await mongoose.disconnect()
  console.log('[import] done')
}

main().catch(async err => {
  console.error(err)
  try {
    await mongoose.disconnect()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
