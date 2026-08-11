#!/usr/bin/env node
/**
 * READ-ONLY: Reconstruct platform-token payout activity from chain.
 *
 * Does NOT connect to MongoDB. Does NOT write to any database.
 * Writes a JSON report under fixtures/ for review before any future import.
 *
 *   --wallet          distributor (token creator that sends airdrops + fees)
 *   --fee-recipient   wallet that receives 12% SOL platform fees (GoMu28…)
 *
 * Defaults:
 *   distributor   8XgArZoCpLXGzmbhkcWoQ4KWoDoGXm6gPmP9TTznM7AJ
 *   fee recipient GoMu28MvRPUwrefHcsrKHsbXJCidQXavXThXBug5iu2R
 *   mint          JAKnM5B8pC7747QqGEGyeJmdAn55mmjb2Eqd2bpSpump
 */
import dotenv from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..', '..')

dotenv.config({ path: join(root, '.env.local') })
dotenv.config({ path: join(root, '.env') })

/** Platform token creator / payout distributor (sends winner airdrops + fees). */
const DEFAULT_DISTRIBUTOR_WALLET = '8XgArZoCpLXGzmbhkcWoQ4KWoDoGXm6gPmP9TTznM7AJ'
/** Platform fee recipient (receives 12% SOL dev fee from distributor). */
const DEFAULT_FEE_RECIPIENT = 'GoMu28MvRPUwrefHcsrKHsbXJCidQXavXThXBug5iu2R'
const DEFAULT_MINT = 'JAKnM5B8pC7747QqGEGyeJmdAn55mmjb2Eqd2bpSpump'
const DEFAULT_SYMBOL = 'TOPBLAST'
const DEFAULT_DECIMALS = 6
const ENHANCED_PAGE_SIZE = 100
/** Group txs into the same inferred cycle if within this window (ms). */
const CYCLE_CLUSTER_MS = 8 * 60 * 1000
const LAMPORTS_PER_SOL = 1e9

function parseArgs(argv) {
  const out = {
    wallet: DEFAULT_DISTRIBUTOR_WALLET,
    mint: DEFAULT_MINT,
    symbol: process.env.TOKEN_SYMBOL?.trim() || DEFAULT_SYMBOL,
    decimals: parseInt(process.env.TOKEN_DECIMALS || String(DEFAULT_DECIMALS), 10) || DEFAULT_DECIMALS,
    // Prefer explicit platform fee recipient — do not default to unrelated DEV_WALLET_ADDRESS.
    feeRecipient: DEFAULT_FEE_RECIPIENT,
    maxPages: 40,
    outPath: join(__dirname, 'fixtures', 'platform-payout-retrieval.json'),
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--wallet' && next) {
      out.wallet = next
      i++
    } else if (a === '--mint' && next) {
      out.mint = next
      i++
    } else if (a === '--symbol' && next) {
      out.symbol = next
      i++
    } else if (a === '--fee-recipient' && next) {
      out.feeRecipient = next
      i++
    } else if (a === '--max-pages' && next) {
      out.maxPages = Math.min(200, Math.max(1, parseInt(next, 10) || 40))
      i++
    } else if (a === '--out' && next) {
      out.outPath = next
      i++
    } else if (a === '--decimals' && next) {
      out.decimals = parseInt(next, 10) || DEFAULT_DECIMALS
      i++
    }
  }
  return out
}

function fail(message) {
  console.error(`\n[retrieve-platform-payouts] FAIL: ${message}`)
  process.exit(1)
}

function getApiKey() {
  const key = process.env.HELIUS_API_KEY?.trim()
  if (!key) fail('Missing HELIUS_API_KEY in .env.local / .env')
  return key
}

function explorerTx(sig) {
  return `https://solscan.io/tx/${sig}`
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchEnhancedPages(wallet, apiKey, maxPages) {
  const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions`
  const all = []
  let beforeSignature

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      'api-key': apiKey,
      limit: String(ENHANCED_PAGE_SIZE),
      'token-accounts': 'balanceChanged',
    })
    if (beforeSignature) params.set('before-signature', beforeSignature)

    const res = await fetch(`${url}?${params}`)
    if (res.status === 429) {
      console.warn(`[helius] rate limited on page ${page + 1}, waiting 2s…`)
      await sleep(2000)
      page--
      continue
    }
    if (!res.ok) {
      const body = await res.text()
      fail(`Helius HTTP ${res.status}: ${body.slice(0, 300)}`)
    }

    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) {
      console.log(`[helius] page ${page + 1}: empty — done`)
      break
    }

    all.push(...batch)
    beforeSignature = String(batch[batch.length - 1]?.signature || '')
    console.log(
      `[helius] page ${page + 1}: +${batch.length} (total ${all.length}) last=${beforeSignature.slice(0, 8)}…`
    )

    if (!beforeSignature || batch.length < ENHANCED_PAGE_SIZE) break
    await sleep(120)
  }

  return all
}

function asNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function tokenAmountHuman(rawAmount, decimals) {
  // Helius tokenTransfers.tokenAmount is often already human-readable.
  // If value looks like raw integer >> 1e6, treat as raw.
  const n = asNum(rawAmount)
  if (!Number.isFinite(n)) return 0
  if (Math.abs(n) >= 1e9) return n / 10 ** decimals
  return n
}

/**
 * Classify a Helius enhanced tx relative to the payout wallet + platform mint.
 */
function classifyTx(tx, ctx) {
  const { wallet, mint, feeRecipient, decimals } = ctx
  const signature = String(tx.signature || '')
  const timestamp = tx.timestamp ? new Date(Number(tx.timestamp) * 1000).toISOString() : null
  const tsMs = tx.timestamp ? Number(tx.timestamp) * 1000 : 0
  const description = String(tx.description || '')
  const type = String(tx.type || '')
  const source = String(tx.source || '')
  const fee = asNum(tx.fee)

  const nativeTransfers = Array.isArray(tx.nativeTransfers) ? tx.nativeTransfers : []
  const tokenTransfers = Array.isArray(tx.tokenTransfers) ? tx.tokenTransfers : []
  const events = tx.events && typeof tx.events === 'object' ? tx.events : {}

  const solOut = []
  for (const t of nativeTransfers) {
    const from = String(t.fromUserAccount || '')
    const to = String(t.toUserAccount || '')
    const amountLamports = asNum(t.amount)
    if (from !== wallet || amountLamports <= 0) continue
    const sol = amountLamports / LAMPORTS_PER_SOL
    // Skip tiny rent / ATA create dust
    if (sol < 0.00005) continue
    solOut.push({
      to,
      sol,
      isLikelyDevFee: feeRecipient ? to === feeRecipient : false,
    })
  }

  const tokenOut = []
  const tokenIn = []
  for (const t of tokenTransfers) {
    if (String(t.mint || '') !== mint) continue
    const from = String(t.fromUserAccount || '')
    const to = String(t.toUserAccount || '')
    const amount = tokenAmountHuman(t.tokenAmount ?? t.amount, decimals)
    if (amount <= 0) continue
    if (from === wallet) {
      tokenOut.push({ to, amount })
    }
    if (to === wallet) {
      tokenIn.push({ from, amount })
    }
  }

  const swap = events.swap
    ? {
        nativeInput: events.swap.nativeInput || null,
        nativeOutput: events.swap.nativeOutput || null,
        tokenInputs: events.swap.tokenInputs || [],
        tokenOutputs: events.swap.tokenOutputs || [],
      }
    : null

  const involvesMint =
    tokenOut.length > 0 ||
    tokenIn.length > 0 ||
    (swap &&
      [...(swap.tokenInputs || []), ...(swap.tokenOutputs || [])].some(
        x => String(x?.mint || '') === mint
      ))

  const tokensReceived = tokenIn.reduce((a, t) => a + t.amount, 0)
  const feeSolOut = solOut.filter(s => s.isLikelyDevFee).reduce((a, s) => a + s.sol, 0)
  const nonFeeSolOut = solOut.filter(s => !s.isLikelyDevFee).reduce((a, s) => a + s.sol, 0)

  // Jupiter / aggregator buy: distributor spends SOL and receives platform mint.
  const swapNativeIn =
    swap?.nativeInput && String(swap.nativeInput.account || '') === wallet
      ? asNum(swap.nativeInput.amount) / LAMPORTS_PER_SOL
      : 0
  const isVolumeBuyback = tokensReceived > 0 && (swapNativeIn > 0 || (nonFeeSolOut > 0 && tokenOut.length === 0))
  const solSpentOnSwap = isVolumeBuyback ? (swapNativeIn > 0 ? swapNativeIn : nonFeeSolOut) : 0

  /** Roles we care about for protocol history */
  const roles = []
  if (tokenOut.length > 0) roles.push('winner_airdrop')
  if (solOut.some(s => s.isLikelyDevFee)) {
    roles.push('dev_fee_sol')
  } else if (solOut.length > 0 && tokenOut.length === 0 && !isVolumeBuyback) {
    roles.push('sol_outflow')
  }
  if (isVolumeBuyback) roles.push('volume_buyback_swap')
  if (roles.length === 0 && involvesMint) roles.push('mint_related_other')
  if (roles.length === 0) return null

  return {
    signature,
    explorerUrl: explorerTx(signature),
    timestamp,
    tsMs,
    type,
    source,
    description,
    feeSol: fee / LAMPORTS_PER_SOL,
    roles,
    solOutflows: solOut,
    tokenAirdrops: tokenOut,
    tokenReceived: tokenIn,
    swapSummary: isVolumeBuyback
      ? {
          solSpent: solSpentOnSwap,
          tokensReceived,
          feeSolExcluded: feeSolOut,
        }
      : null,
    rawType: type,
  }
}

function clusterIntoCycles(events) {
  const sorted = [...events].sort((a, b) => a.tsMs - b.tsMs)
  const cycles = []
  let current = null

  for (const ev of sorted) {
    if (!current || ev.tsMs - current.endMs > CYCLE_CLUSTER_MS) {
      current = {
        inferredCycleIndex: cycles.length + 1,
        startMs: ev.tsMs,
        endMs: ev.tsMs,
        events: [ev],
      }
      cycles.push(current)
    } else {
      current.events.push(ev)
      current.endMs = ev.tsMs
    }
  }

  return cycles.map((c, i) => {
    const airdrops = c.events.flatMap(e =>
      e.tokenAirdrops.map(a => ({
        ...a,
        signature: e.signature,
        explorerUrl: e.explorerUrl,
        timestamp: e.timestamp,
      }))
    )
    // Rank winners by airdrop size descending (best-effort; not original loss rank)
    const rankedAirdrops = [...airdrops].sort((a, b) => b.amount - a.amount)

    // Only count SOL sent to the known fee recipient as protocol dev fees.
    const feeTransfers = c.events.flatMap(e =>
      e.solOutflows
        .filter(s => s.isLikelyDevFee)
        .map(s => ({
          ...s,
          signature: e.signature,
          explorerUrl: e.explorerUrl,
          timestamp: e.timestamp,
          role: 'dev_fee',
        }))
    )

    const swaps = c.events
      .filter(e => e.roles.includes('volume_buyback_swap'))
      .map(e => ({
        signature: e.signature,
        explorerUrl: e.explorerUrl,
        timestamp: e.timestamp,
        swapSol: e.swapSummary?.solSpent ?? 0,
        outputTokensHuman: e.swapSummary?.tokensReceived ?? 0,
      }))

    /** Draft rows shaped like future Payout imports (NOT written to DB). */
    const draftPayoutRows = []

    for (const fee of feeTransfers) {
      draftPayoutRows.push({
        tenantSlug: '_legacy',
        tokenMint: null, // filled by caller
        tokenSymbol: null,
        cycle: i + 1,
        rank: 0,
        wallet: fee.to,
        amount: null,
        amountTokens: fee.sol,
        amountAsset: 'SOL',
        drawdownPct: null,
        lossUsd: null,
        txHash: fee.signature,
        status: 'success',
        errorMessage: null,
        createdAt: fee.timestamp,
        explorerUrl: fee.explorerUrl,
        _source: 'chain_native_transfer',
        _recoverable: {
          drawdownPct: false,
          lossUsd: false,
          amountUsd: 'needs_historical_sol_price',
          cycleNumber: 'inferred_by_time_cluster',
        },
      })
    }

    rankedAirdrops.forEach((a, idx) => {
      draftPayoutRows.push({
        tenantSlug: '_legacy',
        tokenMint: null,
        tokenSymbol: null,
        cycle: i + 1,
        rank: idx + 1,
        wallet: a.to,
        amount: null,
        amountTokens: a.amount,
        amountAsset: 'TOKEN',
        drawdownPct: null,
        lossUsd: null,
        txHash: a.signature,
        status: 'success',
        errorMessage: null,
        createdAt: a.timestamp,
        explorerUrl: a.explorerUrl,
        _source: 'chain_token_transfer',
        _recoverable: {
          drawdownPct: false,
          lossUsd: false,
          amountUsd: 'needs_historical_token_price',
          originalRank: 'inferred_by_airdrop_size_not_drawdown',
          cycleNumber: 'inferred_by_time_cluster',
        },
      })
    })

    const draftVolumeSwaps = swaps.map(s => ({
      tenantSlug: '_legacy',
      tokenMint: null,
      tokenSymbol: null,
      cycle: i + 1,
      swapSol: s.swapSol,
      swapUsd: null,
      outputTokensHuman: s.outputTokensHuman,
      txHash: s.signature,
      createdAt: s.timestamp,
      explorerUrl: s.explorerUrl,
      _source: 'chain_swap',
      _recoverable: {
        swapUsd: 'needs_historical_sol_price',
        cycleNumber: 'inferred_by_time_cluster',
      },
    }))

    return {
      inferredCycleIndex: i + 1,
      start: c.events[0]?.timestamp ?? null,
      end: c.events[c.events.length - 1]?.timestamp ?? null,
      eventCount: c.events.length,
      signatures: c.events.map(e => e.signature),
      roles: [...new Set(c.events.flatMap(e => e.roles))],
      totalTokenAirdropped: airdrops.reduce((sum, a) => sum + a.amount, 0),
      totalDevFeeSol: feeTransfers.reduce((sum, f) => sum + f.sol, 0),
      totalSwapSol: swaps.reduce((sum, s) => sum + s.swapSol, 0),
      draftPayoutRows,
      draftVolumeSwaps,
      events: c.events,
    }
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const apiKey = getApiKey()

  console.log('[retrieve-platform-payouts] READ-ONLY — no database writes')
  console.log(`  distributor   : ${args.wallet}  (token creator / sends payouts)`)
  console.log(`  fee recipient : ${args.feeRecipient || '(not set — pass --fee-recipient)'}  (receives 12% SOL)`)
  console.log(`  platform mint : ${args.mint}`)
  console.log(`  symbol        : ${args.symbol}`)
  console.log(`  max pages     : ${args.maxPages}`)
  console.log(`  output        : ${args.outPath}`)

  const raw = await fetchEnhancedPages(args.wallet, apiKey, args.maxPages)
  console.log(`[retrieve-platform-payouts] fetched ${raw.length} enhanced txs`)

  const ctx = {
    wallet: args.wallet,
    mint: args.mint,
    feeRecipient: args.feeRecipient,
    decimals: args.decimals,
  }

  const classified = []
  let skippedUnrelated = 0
  for (const tx of raw) {
    const c = classifyTx(tx, ctx)
    if (!c) {
      skippedUnrelated++
      continue
    }
    classified.push(c)
  }

  const cycles = clusterIntoCycles(classified)
  for (const cycle of cycles) {
    for (const row of cycle.draftPayoutRows) {
      row.tokenMint = args.mint
      row.tokenSymbol = args.symbol
    }
    for (const row of cycle.draftVolumeSwaps) {
      row.tokenMint = args.mint
      row.tokenSymbol = args.symbol
    }
  }

  const allDraftPayouts = cycles.flatMap(c => c.draftPayoutRows)
  const allDraftSwaps = cycles.flatMap(c => c.draftVolumeSwaps)
  const uniqueRecipients = [...new Set(allDraftPayouts.map(p => p.wallet))]
  const uniqueTx = [...new Set([...allDraftPayouts, ...allDraftSwaps].map(r => r.txHash).filter(Boolean))]

  const coverage = {
    canRecover: [
      'txHash + solscan explorer links',
      'createdAt timestamps',
      'winner recipient wallets + token amounts (SPL transfers out)',
      'dev fee recipient + SOL amounts (when fee recipient known)',
      'volume buyback swaps (SOL spent + tokens received)',
      'inferred cycle grouping by time proximity',
    ],
    cannotRecoverFromChainAlone: [
      'drawdownPct at payout time',
      'lossUsd at payout time',
      'exact original cycle numbers (only time-clustered)',
      'exact winner ranks by drawdown (we rank by airdrop size as a proxy)',
      'failed payouts that never produced a transaction',
      'USD notionals without historical price oracle lookups',
    ],
    nextStepsBeforeImport: [
      'Review tmp JSON — confirm fee recipient matches expected DEV_WALLET',
      'Optionally enrich amount USD via historical SOL/token price at createdAt',
      'Decide cycle numbering (re-number from 1 vs align to known UI cycles)',
      'Only then write a separate import script (not this one)',
    ],
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read_only_retrieval',
    databaseTouched: false,
    params: {
      wallet: args.wallet,
      mint: args.mint,
      symbol: args.symbol,
      decimals: args.decimals,
      feeRecipient: args.feeRecipient || null,
      maxPages: args.maxPages,
      cycleClusterMs: CYCLE_CLUSTER_MS,
    },
    summary: {
      rawTxFetched: raw.length,
      classifiedProtocolTx: classified.length,
      skippedUnrelatedTx: skippedUnrelated,
      inferredCycles: cycles.length,
      draftPayoutRows: allDraftPayouts.length,
      draftVolumeSwapRows: allDraftSwaps.length,
      uniqueRecipients: uniqueRecipients.length,
      uniqueTxHashes: uniqueTx.length,
      totalTokenAirdropped: cycles.reduce((s, c) => s + c.totalTokenAirdropped, 0),
      totalDevFeeSol: cycles.reduce((s, c) => s + c.totalDevFeeSol, 0),
      totalSwapSol: cycles.reduce((s, c) => s + c.totalSwapSol, 0),
    },
    coverage,
    cycles,
    flatDraftPayouts: allDraftPayouts,
    flatDraftVolumeSwaps: allDraftSwaps,
  }

  mkdirSync(dirname(args.outPath), { recursive: true })
  writeFileSync(args.outPath, JSON.stringify(report, null, 2), 'utf8')

  console.log('\n=== SUMMARY (no DB writes) ===')
  console.log(JSON.stringify(report.summary, null, 2))
  console.log('\nCoverage gaps:')
  for (const line of coverage.cannotRecoverFromChainAlone) {
    console.log(`  - ${line}`)
  }
  console.log(`\nWrote ${args.outPath}`)
  console.log('Review that file before any import. This script does not touch MongoDB.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
