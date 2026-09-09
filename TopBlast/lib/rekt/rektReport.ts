import 'server-only'

/**
 * Rekt Report Card — public wallet drawdown report (ecosystem tool, Phase B).
 *
 * Reuses the exact cost-basis engine the payout eligibility system runs on
 * (calculateWalletVwap → Helius buy history), pointed at an arbitrary wallet:
 *   holdings (Helius RPC) → prices/symbols (DexScreener batch) → per-bag VWAP
 *   → drawdowns, unrealized PnL, and a Rekt Score with Blasty commentary.
 *
 * Purely additive: nothing in the app imports this except the /api/rekt route.
 */

import axios from 'axios'
import { PublicKey } from '@solana/web3.js'
import { calculateWalletVwap } from '@/lib/tracker/vwap'
import { getSolPrice } from '@/lib/solana/price'
import { getHeliusRpcUrl } from '@/lib/solana/rpcUrl'
import {
  NATIVE_SOL_MINT,
  selectBestSolanaPair,
  parseUsd,
  type DexScreenerPairLike,
} from '@/lib/solana/dexscreenerShared'

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
const DEXSCREENER_TOKENS = 'https://api.dexscreener.com/latest/dex/tokens'
/** DexScreener token endpoint accepts up to ~30 comma-separated mints. */
const DEX_BATCH = 30

/** How many bags get the full VWAP treatment (each costs Helius credits). */
export function rektMaxTokens(): number {
  const n = parseInt(process.env.REKT_MAX_TOKENS ?? '', 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 6
}

/** Ignore bags below this current USD value when picking what to analyze. */
function minBagUsd(): number {
  const n = parseFloat(process.env.REKT_MIN_BAG_USD ?? '')
  return Number.isFinite(n) && n >= 0 ? n : 0.25
}

export interface RektBag {
  mint: string
  symbol: string
  balance: number
  priceUsd: number
  valueUsd: number
  /** Average entry price from on-chain buys (null = no buy history found). */
  vwap: number | null
  /** % vs average entry; negative = underwater. Null when no vwap. */
  drawdownPct: number | null
  /** Unrealized PnL on the held amount (valueUsd - vwap*balance). */
  pnlUsd: number | null
  buyCount: number
  firstBuyAt: string | null
  hasSold: boolean
}

/** TopBlast payout wins for this wallet — the flex section of the card. */
export interface RektWins {
  cyclesWon: number
  totalUsd: number
  /** Per-token breakdown, biggest first. */
  tokens: Array<{ symbol: string; cycles: number; usd: number }>
}

export interface RektReportData {
  wallet: string
  computedAt: string
  solPrice: number
  totalValueUsd: number
  /** Cost basis of the analyzed held bags (where vwap known). */
  totalCostUsd: number
  totalPnlUsd: number
  /** 0 (untouched) … 100 (beyond rescue). */
  rektScore: number
  grade: string
  quip: string
  bags: RektBag[]
  /** Fungible holdings found vs analyzed (we only VWAP the top bags). */
  holdingsFound: number
  analyzedCount: number
  wins: RektWins
}

interface Holding {
  mint: string
  uiAmount: number
}

interface DexInfo {
  priceUsd: number
  symbol: string
}

export function isValidWalletAddress(raw: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(raw.trim())
    return true
  } catch {
    return false
  }
}

/** All fungible SPL holdings of a wallet (both token programs). */
async function getWalletHoldings(wallet: string): Promise<Holding[]> {
  const url = getHeliusRpcUrl()
  const byMint = new Map<string, number>()

  for (const programId of [TOKEN_PROGRAM, TOKEN_2022_PROGRAM]) {
    try {
      const res = await axios.post(
        url,
        {
          jsonrpc: '2.0',
          id: 'rekt-holdings',
          method: 'getTokenAccountsByOwner',
          params: [wallet, { programId }, { encoding: 'jsonParsed' }],
        },
        { timeout: 15000 }
      )
      const accounts: Array<{
        account?: {
          data?: {
            parsed?: {
              info?: {
                mint?: string
                tokenAmount?: { uiAmount?: number | null; decimals?: number }
              }
            }
          }
        }
      }> = res.data?.result?.value ?? []

      for (const acc of accounts) {
        const info = acc.account?.data?.parsed?.info
        const mint = info?.mint
        const uiAmount = info?.tokenAmount?.uiAmount ?? 0
        const decimals = info?.tokenAmount?.decimals ?? 0
        if (!mint || !uiAmount || uiAmount <= 0) continue
        // Skip obvious NFTs; keep everything fungible.
        if (decimals === 0 && uiAmount === 1) continue
        byMint.set(mint, (byMint.get(mint) ?? 0) + uiAmount)
      }
    } catch (err) {
      console.warn(
        `[Rekt] Holdings fetch failed for program ${programId.slice(0, 8)}…:`,
        err instanceof Error ? err.message : err
      )
    }
  }

  return Array.from(byMint.entries()).map(([mint, uiAmount]) => ({ mint, uiAmount }))
}

type PairWithMeta = DexScreenerPairLike & {
  baseToken: { address: string; symbol?: string; name?: string }
}

/** Batch price + symbol lookup for arbitrary mints via DexScreener. */
async function fetchDexInfo(mints: string[]): Promise<Map<string, DexInfo>> {
  const out = new Map<string, DexInfo>()
  for (let i = 0; i < mints.length; i += DEX_BATCH) {
    const batch = mints.slice(i, i + DEX_BATCH)
    try {
      const res = await axios.get(`${DEXSCREENER_TOKENS}/${batch.join(',')}`, {
        timeout: 12000,
        headers: { Accept: 'application/json' },
      })
      const pairs: PairWithMeta[] = res.data?.pairs ?? []
      for (const mint of batch) {
        const best = selectBestSolanaPair(pairs, mint) as PairWithMeta | null
        if (!best) continue
        const price = parseUsd(best.priceUsd)
        if (!price || price <= 0) continue
        out.set(mint, {
          priceUsd: price,
          symbol: best.baseToken?.symbol || `${mint.slice(0, 4)}…`,
        })
      }
    } catch (err) {
      console.warn('[Rekt] DexScreener batch failed:', err instanceof Error ? err.message : err)
    }
  }
  return out
}

const GRADES: Array<{ min: number; grade: string; quips: string[] }> = [
  {
    min: 85,
    grade: 'BEYOND RESCUE',
    quips: [
      'I’ve seen shipwrecks in better shape. Respect.',
      'This isn’t a portfolio, it’s a memorial site.',
    ],
  },
  {
    min: 65,
    grade: 'DEEP SEA DIVER',
    quips: [
      'You live at depths science hasn’t named yet.',
      'Down here the pressure builds character. And losses.',
    ],
  },
  {
    min: 40,
    grade: 'CERTIFIED REKT',
    quips: [
      'Officially rekt. Certificate’s in the mail.',
      'You bought the top so consistently it’s almost a strategy.',
    ],
  },
  {
    min: 15,
    grade: 'DOWN BAD',
    quips: [
      'Underwater, but you can still see the surface. Barely.',
      'A little wet. It happens to the best pods.',
    ],
  },
  {
    min: 0,
    grade: 'BARELY SCRATCHED',
    quips: [
      'Suspiciously fine. Are you even trying?',
      'Almost no damage. The trenches will fix that.',
    ],
  },
]

export function scoreToGrade(score: number): { grade: string; quip: string } {
  const tier = GRADES.find(g => score >= g.min) ?? GRADES[GRADES.length - 1]
  return { grade: tier.grade, quip: tier.quips[Math.floor(Math.random() * tier.quips.length)] }
}

/**
 * Cost-weighted rekt score: how much of the money put into the held bags is
 * gone. 0 = whole stack intact, 100 = everything vaporized.
 */
export function computeRektScore(
  bags: Array<{ vwap: number | null; balance: number; priceUsd: number }>
): number {
  let cost = 0
  let lost = 0
  for (const bag of bags) {
    if (!bag.vwap || bag.vwap <= 0 || bag.balance <= 0) continue
    const bagCost = bag.vwap * bag.balance
    cost += bagCost
    lost += Math.max(0, (bag.vwap - bag.priceUsd) * bag.balance)
  }
  if (cost <= 0) return 0
  return Math.round(Math.min(100, (lost / cost) * 100))
}

/** Successful TopBlast winner payouts for this wallet, across every session. */
async function fetchWalletWins(wallet: string): Promise<RektWins> {
  try {
    const { default: connectDB } = await import('@/lib/db')
    const { Payout } = await import('@/lib/db/models')
    await connectDB()
    const rows = await Payout.find({
      wallet,
      status: 'success',
      rank: { $gte: 1 },
    })
      .select('amount tokenSymbol')
      .lean()

    const byToken = new Map<string, { cycles: number; usd: number }>()
    let totalUsd = 0
    for (const row of rows) {
      const symbol = row.tokenSymbol || 'TOKEN'
      const usd = Number.isFinite(row.amount) ? row.amount : 0
      totalUsd += usd
      const agg = byToken.get(symbol) ?? { cycles: 0, usd: 0 }
      agg.cycles += 1
      agg.usd += usd
      byToken.set(symbol, agg)
    }

    return {
      cyclesWon: rows.length,
      totalUsd,
      tokens: Array.from(byToken.entries())
        .map(([symbol, agg]) => ({ symbol, ...agg }))
        .sort((a, b) => b.usd - a.usd),
    }
  } catch (err) {
    console.warn('[Rekt] Wins lookup failed:', err instanceof Error ? err.message : err)
    return { cyclesWon: 0, totalUsd: 0, tokens: [] }
  }
}

export async function buildRektReport(walletRaw: string): Promise<RektReportData> {
  const wallet = walletRaw.trim()
  const holdings = await getWalletHoldings(wallet)

  const dexInfo = await fetchDexInfo(
    holdings
      .filter(h => h.mint !== NATIVE_SOL_MINT)
      .map(h => h.mint)
      .slice(0, DEX_BATCH * 2)
  )

  // Rank priced bags by current value, analyze the top few.
  const priced = holdings
    .map(h => ({ ...h, info: dexInfo.get(h.mint) }))
    .filter((h): h is Holding & { info: DexInfo } => {
      return !!h.info && h.uiAmount * h.info.priceUsd >= minBagUsd()
    })
    .sort((a, b) => b.uiAmount * b.info.priceUsd - a.uiAmount * a.info.priceUsd)

  const toAnalyze = priced.slice(0, rektMaxTokens())
  const solPrice = (await getSolPrice()) || 0

  const bags: RektBag[] = []
  for (const bag of toAnalyze) {
    let vwap: number | null = null
    let buyCount = 0
    let firstBuyAt: string | null = null
    let hasSold = false
    try {
      // bypassSourcePolicy: Birdeye owning HOLDER indexing must not disable
      // this on-demand scan — Rekt budgets its own Helius spend via the
      // report cache + daily compute cap.
      const data = await calculateWalletVwap(wallet, bag.mint, bag.info.priceUsd, solPrice || undefined, {
        bypassSourcePolicy: true,
      })
      if (data.vwap && data.vwap > 0 && data.totalTokensBought > 0) {
        vwap = data.vwap
      }
      buyCount = data.buyCount
      firstBuyAt = data.firstBuyTimestamp ? new Date(data.firstBuyTimestamp).toISOString() : null
      hasSold = data.hasSold
    } catch (err) {
      console.warn(`[Rekt] VWAP failed for ${bag.mint.slice(0, 8)}…:`, err instanceof Error ? err.message : err)
    }

    const valueUsd = bag.uiAmount * bag.info.priceUsd
    const drawdownPct = vwap ? ((bag.info.priceUsd - vwap) / vwap) * 100 : null
    const pnlUsd = vwap ? (bag.info.priceUsd - vwap) * bag.uiAmount : null

    bags.push({
      mint: bag.mint,
      symbol: bag.info.symbol,
      balance: bag.uiAmount,
      priceUsd: bag.info.priceUsd,
      valueUsd,
      vwap,
      drawdownPct,
      pnlUsd,
      buyCount,
      firstBuyAt,
      hasSold,
    })
  }

  // Deepest drawdowns first — this is a rekt card, lead with the wounds.
  bags.sort((a, b) => (a.drawdownPct ?? 1) - (b.drawdownPct ?? 1))

  const totalValueUsd = bags.reduce((s, b) => s + b.valueUsd, 0)
  const totalCostUsd = bags.reduce((s, b) => s + (b.vwap ? b.vwap * b.balance : 0), 0)
  const totalPnlUsd = bags.reduce((s, b) => s + (b.pnlUsd ?? 0), 0)
  const rektScore = computeRektScore(
    bags.map(b => ({ vwap: b.vwap, balance: b.balance, priceUsd: b.priceUsd }))
  )
  const { grade, quip } = scoreToGrade(rektScore)
  const wins = await fetchWalletWins(wallet)

  return {
    wallet,
    computedAt: new Date().toISOString(),
    solPrice,
    totalValueUsd,
    totalCostUsd,
    totalPnlUsd,
    rektScore,
    grade,
    quip,
    bags,
    holdingsFound: holdings.length,
    analyzedCount: bags.length,
    wins,
  }
}
