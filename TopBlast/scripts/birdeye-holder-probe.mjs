#!/usr/bin/env node
/**
 * Local probe: fetch holder + PnL fields from Birdeye for a token mint.
 *
 * Usage (from TopBlast/):
 *   npm run birdeye:probe
 *   npm run birdeye:probe -- EvEPfQmH2BEe9XbiV8fghaafRWbG7n5oBEiLy5KNpump
 *   npm run birdeye:probe -- <mint> --limit 20
 *
 * Requires BIRDEYE_API_KEY in TopBlast/.env.local (or .env).
 */
import dotenv from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

dotenv.config({ path: join(root, '.env.local') })
dotenv.config({ path: join(root, '.env') })

const DEFAULT_MINT = 'EvEPfQmH2BEe9XbiV8fghaafRWbG7n5oBEiLy5KNpump'
const BASE_URL = 'https://public-api.birdeye.so'

function parseArgs(argv) {
  const positional = []
  let limit = 10
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit' && argv[i + 1]) {
      limit = Math.min(100, Math.max(1, parseInt(argv[i + 1], 10) || 10))
      i++
    } else if (!argv[i].startsWith('--')) {
      positional.push(argv[i])
    }
  }
  return {
    mint: positional[0] || DEFAULT_MINT,
    limit,
  }
}

function fail(message) {
  console.error(`\n[birdeye-probe] FAIL: ${message}`)
  process.exit(1)
}

function getApiKey() {
  const key = process.env.BIRDEYE_API_KEY?.trim()
  if (!key) {
    fail(
      'Missing BIRDEYE_API_KEY.\n' +
        'Add it to TopBlast/.env.local:\n\n' +
        '  BIRDEYE_API_KEY=your_key_here\n\n' +
        'Get a key at https://bds.birdeye.so (Security tab).'
    )
  }
  return key
}

async function birdeyeGet(path, params, apiKey) {
  const url = new URL(path, BASE_URL)
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v))
  }

  const res = await fetch(url, {
    headers: {
      'X-API-KEY': apiKey,
      'x-chain': 'solana',
      Accept: 'application/json',
    },
  })

  let body
  try {
    body = await res.json()
  } catch {
    body = null
  }

  return { res, body }
}

function shortWallet(w) {
  if (!w || w.length < 12) return w || '—'
  return `${w.slice(0, 6)}…${w.slice(-4)}`
}

function fmtUsd(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  const sign = v < 0 ? '-' : ''
  return `${sign}$${Math.abs(v).toFixed(2)}`
}

function fmtPrice(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `$${Number(n).toPrecision(4)}`
}

/** Map Birdeye wallet-mode holder row → fields TopBlast needs. */
function mapWalletHolderRow(row, tokenPrice = null) {
  const decimals = row.decimals ?? 6
  const balance =
    row.ui_amount ??
    row.amount ??
    (row.amountRaw != null ? Number(row.amountRaw) / 10 ** decimals : 0)
  const vwap =
    row.avgBuyPrice ??
    row.avg_buy_price ??
    row.holdAvgPrice ??
    row.hold_avg_price ??
    null
  const firstUnix = row.firstTradeUnixTime ?? row.first_trade_unix_time
  const firstBuyMs = firstUnix ? firstUnix * 1000 : null
  const avgSell = row.avgSellPrice ?? row.avg_sell_price ?? 0
  const hasSold = avgSell > 0

  let drawdownPct = null
  let lossUsd = null
  if (vwap && vwap > 0 && tokenPrice && tokenPrice > 0) {
    drawdownPct = ((tokenPrice - vwap) / vwap) * 100
    if (tokenPrice < vwap) {
      lossUsd = (vwap - tokenPrice) * balance
    } else {
      lossUsd = 0
    }
  }

  return {
    wallet: row.owner,
    balance,
    vwap: vwap && vwap > 0 ? vwap : null,
    firstBuyAt: firstBuyMs ? new Date(firstBuyMs).toISOString() : null,
    hasSold,
    drawdownPct: drawdownPct != null ? Math.round(drawdownPct * 100) / 100 : null,
    lossUsd: lossUsd != null ? Math.round(lossUsd * 100) / 100 : null,
  }
}

/** Map Birdeye holder-positions row → TopBlast fields. */
function mapPositionRow(row, tokenPrice = null) {
  const balance = Number(row.hold_amount)
  const vwap = row.avg_buy_price != null ? Number(row.avg_buy_price) : null
  const firstBuyMs = row.first_trade_at ? Date.parse(row.first_trade_at) : null
  const hasSold = (row.sell_count ?? 0) > 0
  const pnlUsd = row.pnl != null ? Number(row.pnl) : null

  let drawdownPct = null
  if (vwap && tokenPrice && tokenPrice > 0) {
    drawdownPct = ((tokenPrice - vwap) / vwap) * 100
  }

  return {
    wallet: row.wallet_address,
    balance,
    vwap,
    pnlUsd,
    buyCount: row.buy_count ?? 0,
    sellCount: row.sell_count ?? 0,
    firstBuyAt: firstBuyMs ? new Date(firstBuyMs).toISOString() : null,
    hasSold,
    labels: row.labels ?? [],
    drawdownPct: drawdownPct != null ? Math.round(drawdownPct * 100) / 100 : null,
  }
}

async function fetchTokenPrice(mint, apiKey) {
  const { res, body } = await birdeyeGet(
    '/defi/price',
    { address: mint },
    apiKey
  )
  if (!res.ok) return null
  return body?.data?.value ?? null
}

async function main() {
  const { mint, limit } = parseArgs(process.argv.slice(2))
  const apiKey = getApiKey()

  console.log('[birdeye-probe] mint:', mint)
  console.log('[birdeye-probe] limit:', limit)
  console.log('[birdeye-probe] key:', `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`)

  const tokenPrice = await fetchTokenPrice(mint, apiKey)
  if (tokenPrice) {
    console.log('[birdeye-probe] Birdeye price:', fmtPrice(tokenPrice))
  } else {
    console.log('[birdeye-probe] Birdeye price: unavailable (drawdown columns skipped)')
  }

  // Small delay — free tier is 60 rpm total across keys
  await new Promise(r => setTimeout(r, 1100))

  console.log('\n=== 1) GET /defi/v3/token/holder (mode=wallet) ===')
  console.log('One call returns balance + avgBuyPrice + firstTradeUnixTime for many holders.\n')

  const holders = await birdeyeGet(
    '/defi/v3/token/holder',
    {
      address: mint,
      mode: 'wallet',
      offset: 0,
      limit,
      ui_amount_mode: 'scaled',
    },
    apiKey
  )

  if (!holders.res.ok) {
    console.error('HTTP', holders.res.status, holders.body?.message || holders.body)
    fail('token/holder request failed — check API key tier and mint address')
  }

  const holderData = holders.body?.data
  const items = holderData?.items ?? []
  console.log(`Total holders (reported): ${holderData?.holder ?? '?'}`)
  console.log(`Top10 hold %: ${holderData?.top10_hold_percent ?? holderData?.top10HoldPercent ?? '?'}`)
  console.log(`Returned rows: ${items.length}\n`)

  const mappedHolders = items.map(row => mapWalletHolderRow(row, tokenPrice))
  console.table(
    mappedHolders.map(h => ({
      wallet: shortWallet(h.wallet),
      balance: h.balance?.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      vwap: h.vwap != null ? fmtPrice(h.vwap) : '—',
      drawdown: h.drawdownPct != null ? `${h.drawdownPct}%` : '—',
      lossUsd: h.lossUsd != null ? fmtUsd(h.lossUsd) : '—',
      firstBuy: h.firstBuyAt ? h.firstBuyAt.slice(0, 19) : '—',
      sold: h.hasSold ? 'yes' : 'no',
    }))
  )

  console.log('\n=== 2) GET /token/v1/holder-positions (all tags) ===')
  console.log('Adds explicit PnL USD + buy/sell counts per wallet.\n')

  await new Promise(r => setTimeout(r, 1100))

  const positions = await birdeyeGet(
    '/token/v1/holder-positions',
    {
      token_address: mint,
      labels: 'bundler,sniper,insider,dev,smart_trader',
      sort_by: 'amount',
      order_type: 'desc',
      limit: Math.min(limit, 50),
      offset: 0,
      include_zero_balance: false,
      ui_amount_mode: 'scaled',
    },
    apiKey
  )

  if (!positions.res.ok) {
    console.warn(
      'holder-positions HTTP',
      positions.res.status,
      positions.body?.message || '(may require higher Birdeye tier)'
    )
  } else {
    const posRows = positions.body?.data ?? []
    console.log(`Returned rows: ${posRows.length}\n`)

    if (posRows.length === 0) {
      console.log('No tagged holder-positions rows (normal for tokens without bundler/sniper tags).')
    } else {
      const mappedPos = posRows.map(row => mapPositionRow(row, tokenPrice))
      console.table(
        mappedPos.map(h => ({
          wallet: shortWallet(h.wallet),
          balance: h.balance?.toLocaleString(undefined, { maximumFractionDigits: 0 }),
          vwap: h.vwap != null ? fmtPrice(h.vwap) : '—',
          pnl: h.pnlUsd != null ? fmtUsd(h.pnlUsd) : '—',
          drawdown: h.drawdownPct != null ? `${h.drawdownPct}%` : '—',
          buys: h.buyCount,
          sells: h.sellCount,
          labels: (h.labels || []).join(',') || '—',
        }))
      )
    }
  }

  console.log('\n=== TopBlast field mapping ===')
  console.log('  balance          ← ui_amount (wallet holder) / hold_amount (positions)')
  console.log('  vwap             ← avgBuyPrice / avg_buy_price')
  console.log('  firstBuyTimestamp← firstTradeUnixTime / first_trade_at')
  console.log('  hasSold          ← avgSellPrice > 0 / sell_count > 0')
  console.log('  drawdownPct      ← (livePrice - vwap) / vwap  (DexScreener or Birdeye price)')
  console.log('  lossUsd          ← (vwap - price) * balance when underwater')
  console.log('\n[birdeye-probe] OK — Birdeye returns the data we need without per-wallet Helius pagination.')
}

main().catch(err => {
  console.error('[birdeye-probe] error:', err.message || err)
  process.exit(1)
})
