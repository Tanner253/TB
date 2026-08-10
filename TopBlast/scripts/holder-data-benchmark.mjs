#!/usr/bin/env node
/**
 * Empirical comparison: how many API calls + what fields each source returns
 * for the same token CA. Run from TopBlast/:
 *
 *   node scripts/holder-data-benchmark.mjs
 *   node scripts/holder-data-benchmark.mjs <mint> [--wallet <sampleWallet>]
 *
 * Requires HELIUS_API_KEY and BIRDEYE_API_KEY in .env.local
 */
import dotenv from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
dotenv.config({ path: join(root, '.env.local') })
dotenv.config({ path: join(root, '.env') })

const DEFAULT_MINT = 'EvEPfQmH2BEe9XbiV8fghaafRWbG7n5oBEiLy5KNpump'
const HELIUS_PAGE = 100
const WALLET_MAX_PAGES = parseInt(process.env.HELIUS_WALLET_TX_MAX_PAGES || '4', 10)

function parseArgs(argv) {
  const positional = []
  let sampleWallet = null
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--wallet' && argv[i + 1]) {
      sampleWallet = argv[++i]
    } else if (!argv[i].startsWith('--')) {
      positional.push(argv[i])
    }
  }
  return { mint: positional[0] || DEFAULT_MINT, sampleWallet }
}

function req(key) {
  const v = process.env[key]?.trim()
  if (!v) throw new Error(`Missing ${key} in .env.local`)
  return v
}

function txInvolvesMint(tx, mint) {
  const transfers = tx.tokenTransfers || []
  return transfers.some(t => String(t.mint || '') === mint)
}

function summarizeHeliusRow(wallet, mint, txs) {
  let buys = 0
  let sells = 0
  let firstBuy = null
  let totalBought = 0
  for (const tx of txs) {
    for (const t of tx.tokenTransfers || []) {
      if (String(t.mint || '') !== mint) continue
      const amt = Number(t.tokenAmount || 0)
      if (amt <= 0) continue
      const to = String(t.toUserAccount || '')
      const from = String(t.fromUserAccount || '')
      if (to === wallet) {
        buys++
        totalBought += amt
        const ts = Number(tx.timestamp || 0) * 1000
        if (!firstBuy || ts < firstBuy) firstBuy = ts
      }
      if (from === wallet) sells++
    }
  }
  return { buys, sells, firstBuy, totalBought }
}

async function benchmarkHeliusGetTransactionsForAddress(mint, wallet, heliusKey) {
  const rpc =
    process.env.HELIUS_RPC_URL?.trim() ||
    `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`

  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransactionsForAddress',
      params: [
        wallet,
        {
          transactionDetails: 'full',
          sortOrder: 'desc',
          limit: 100,
          filters: { tokenAccounts: 'balanceChanged', status: 'succeeded' },
        },
      ],
    }),
  })

  const json = await res.json()
  const txs = json.result?.data ?? []
  let mintMatched = 0
  let buys = 0
  let sells = 0

  for (const tx of txs) {
    const transfers = tx.tokenTransfers || []
    if (transfers.some(t => String(t.mint || '') === mint)) mintMatched++
    for (const t of transfers) {
      if (String(t.mint || '') !== mint) continue
      if (String(t.toUserAccount || '') === wallet) buys++
      if (String(t.fromUserAccount || '') === wallet) sells++
    }
  }

  return {
    apiCalls: 1,
    rawTxs: txs.length,
    mintMatchedTxs: mintMatched,
    buys,
    sells,
    responseFormat: txs[0]?.tokenTransfers ? 'enhanced-like' : 'raw-rpc-meta',
    note: 'RPC getTransactionsForAddress — 1 call, up to 1000 txs; returns raw unless parsed',
  }
}
async function benchmarkHeliusEnhancedPerWallet(mint, wallet, heliusKey) {
  const stats = { apiCalls: 0, rawTxs: 0, mintMatchedTxs: 0, pages: 0 }
  const all = []
  let before

  for (let page = 0; page < WALLET_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      'api-key': heliusKey,
      limit: String(HELIUS_PAGE),
      'token-accounts': 'balanceChanged',
    })
    if (before) params.set('before-signature', before)

    const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?${params}`
    const res = await fetch(url)
    stats.apiCalls++
    stats.pages++

    if (!res.ok) {
      return {
        ...stats,
        error: `HTTP ${res.status}`,
        summary: null,
        note: 'mint NOT sent to API — client-side filter only',
      }
    }

    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break

    all.push(...batch)
    stats.rawTxs += batch.length
    stats.mintMatchedTxs += batch.filter(tx => txInvolvesMint(tx, mint)).length

    before = String(batch[batch.length - 1]?.signature || '')
    if (!before || batch.length < HELIUS_PAGE) break
  }

  const summary = summarizeHeliusRow(wallet, mint, all)
  return { ...stats, summary, note: 'mint NOT sent to API — client-side filter only' }
}

async function benchmarkHeliusTokenTxs(mint, heliusKey, maxPages = 3) {
  const stats = { apiCalls: 0, rawTxs: 0, walletsSeen: new Set() }
  let before

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      'api-key': heliusKey,
      limit: String(HELIUS_PAGE),
    })
    if (before) params.set('before-signature', before)

    const url = `https://api.helius.xyz/v0/tokens/${mint}/transactions?${params}`
    const res = await fetch(url)
    stats.apiCalls++

    if (!res.ok) {
      return { ...stats, error: `HTTP ${res.status}`, walletCount: 0 }
    }

    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break

    stats.rawTxs += batch.length
    for (const tx of batch) {
      for (const t of tx.tokenTransfers || []) {
        if (String(t.mint || '') !== mint) continue
        const to = String(t.toUserAccount || '')
        const from = String(t.fromUserAccount || '')
        if (to) stats.walletsSeen.add(to)
        if (from) stats.walletsSeen.add(from)
      }
    }

    before = String(batch[batch.length - 1]?.signature || '')
    if (!before || batch.length < HELIUS_PAGE) break
  }

  return {
    apiCalls: stats.apiCalls,
    rawTxs: stats.rawTxs,
    walletCount: stats.walletsSeen.size,
    note: 'GET /v0/tokens/{mint}/transactions — filtered by CA at API',
  }
}

async function benchmarkHeliusDasHolders(mint, heliusKey, limit = 1000) {
  const rpc = process.env.HELIUS_RPC_URL?.trim() ||
    `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`

  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccounts',
      params: { mint, page: 1, limit: Math.min(limit, 1000) },
    }),
  })

  const json = await res.json()
  const accounts = json.result?.token_accounts ?? []
  const byOwner = new Map()
  for (const a of accounts) {
    const owner = a.owner
    const amt = Number(a.amount)
    if (!owner || !Number.isFinite(amt) || amt <= 0) continue
    byOwner.set(owner, (byOwner.get(owner) ?? 0) + amt)
  }

  return {
    apiCalls: 1,
    holderCount: byOwner.size,
    hasVwap: false,
    hasFirstBuy: false,
    hasSoldFlag: false,
    note: 'DAS getTokenAccounts — balance only',
  }
}

async function benchmarkBirdeyeHolders(mint, birdeyeKey, maxHolders = 500) {
  const stats = { apiCalls: 0, rows: [] }
  let offset = 0
  const limit = 100

  while (stats.rows.length < maxHolders) {
    const params = new URLSearchParams({
      address: mint,
      mode: 'wallet',
      offset: String(offset),
      limit: String(limit),
      ui_amount_mode: 'scaled',
    })

    const res = await fetch(
      `https://public-api.birdeye.so/defi/v3/token/holder?${params}`,
      {
        headers: {
          'X-API-KEY': birdeyeKey,
          'x-chain': 'solana',
        },
      }
    )
    stats.apiCalls++

    if (!res.ok) {
      return { ...stats, error: `HTTP ${res.status}`, holderCount: stats.rows.length }
    }

    const body = await res.json()
    const items = body.data?.items ?? []
    if (items.length === 0) break

    for (const row of items) {
      stats.rows.push({
        wallet: row.owner,
        balance: row.amount,
        avgBuyPrice: row.avg_buy_price ?? row.avgBuyPrice ?? null,
        avgSellPrice: row.avg_sell_price ?? row.avgSellPrice ?? 0,
        firstTradeUnix: row.first_trade_unix_time ?? row.firstTradeUnixTime ?? null,
      })
    }

    offset += items.length
    if (items.length < limit) break
    await new Promise(r => setTimeout(r, 1100))
  }

  const withVwap = stats.rows.filter(r => r.avgBuyPrice && r.avgBuyPrice > 0).length
  const withSell = stats.rows.filter(r => r.avgSellPrice > 0).length

  return {
    apiCalls: stats.apiCalls,
    holderCount: stats.rows.length,
    withVwap,
    withSell,
    hasVwap: true,
    hasFirstBuy: true,
    hasSoldFlag: true,
    sample: stats.rows.slice(0, 3),
    note: 'GET /defi/v3/token/holder?mode=wallet',
  }
}

function projectWorkerCost(holderCount, perWalletPages = WALLET_MAX_PAGES) {
  const heliusWalletCalls = holderCount * perWalletPages
  const birdeyeCalls = Math.ceil(holderCount / 100)
  return { heliusWalletCalls, birdeyeCalls, ratio: (heliusWalletCalls / birdeyeCalls).toFixed(1) }
}

async function main() {
  const { mint, sampleWallet } = parseArgs(process.argv.slice(2))
  const heliusKey = req('HELIUS_API_KEY')
  const birdeyeKey = req('BIRDEYE_API_KEY')

  console.log('='.repeat(72))
  console.log('HOLDER DATA BENCHMARK')
  console.log('mint:', mint)
  console.log('HELIUS_WALLET_TX_MAX_PAGES:', WALLET_MAX_PAGES)
  console.log('='.repeat(72))

  console.log('\n--- A) Helius DAS (current holder list) ---')
  const das = await benchmarkHeliusDasHolders(mint, heliusKey)
  console.log(JSON.stringify(das, null, 2))

  console.log('\n--- B) Birdeye token/holder?mode=wallet ---')
  const birdeye = await benchmarkBirdeyeHolders(mint, birdeyeKey)
  console.log(JSON.stringify({ ...birdeye, sample: birdeye.sample }, null, 2))

  const wallet =
    sampleWallet ||
    birdeye.sample?.[1]?.wallet ||
    birdeye.sample?.[0]?.wallet

  if (!wallet) {
    console.log('\nNo sample wallet — skip C/D')
    return
  }

  console.log('\n--- C) Helius Enhanced per-WALLET (current VWAP path in helius.ts) ---')
  console.log('sample wallet:', wallet)
  const perWallet = await benchmarkHeliusEnhancedPerWallet(mint, wallet, heliusKey)
  console.log(JSON.stringify(perWallet, null, 2))

  console.log('\n--- C2) Helius getTransactionsForAddress RPC (1 call / wallet) ---')
  const gtx = await benchmarkHeliusGetTransactionsForAddress(mint, wallet, heliusKey)
  console.log(JSON.stringify(gtx, null, 2))

  console.log('\n--- D) Helius token-level txs (dead code in repo) ---')
  const tokenTxs = await benchmarkHeliusTokenTxs(mint, heliusKey, 2)
  console.log(JSON.stringify(tokenTxs, null, 2))

  const birdeyeRow = birdeye.sample?.find(r => r.wallet === wallet) || birdeye.sample?.[1]

  console.log('\n--- E) Same wallet: Birdeye row vs Helius parsed ---')
  console.log(
    JSON.stringify(
      {
        wallet: wallet.slice(0, 8) + '…',
        birdeye: birdeyeRow
          ? {
              balance: birdeyeRow.balance,
              avgBuyPrice: birdeyeRow.avgBuyPrice,
              avgSellPrice: birdeyeRow.avgSellPrice,
              firstTradeUnix: birdeyeRow.firstTradeUnix,
            }
          : null,
        heliusEnhanced: perWallet.summary,
        heliusEfficiency: {
          apiCalls: perWallet.apiCalls,
          rawTxsFetched: perWallet.rawTxs,
          txsMatchingMint: perWallet.mintMatchedTxs,
          wastedTxs: perWallet.rawTxs - perWallet.mintMatchedTxs,
          pctWasted:
            perWallet.rawTxs > 0
              ? Math.round(((perWallet.rawTxs - perWallet.mintMatchedTxs) / perWallet.rawTxs) * 100)
              : 0,
        },
      },
      null,
      2
    )
  )

  const n = birdeye.holderCount || das.holderCount || 20
  console.log('\n--- F) Projected API calls to hydrate ALL holders (this token) ---')
  console.log(JSON.stringify({ holderCount: n, ...projectWorkerCost(n) }, null, 2))

  console.log('\n' + '='.repeat(72))
  console.log('DONE')
}

main().catch(err => {
  console.error('benchmark failed:', err.message || err)
  process.exit(1)
})
