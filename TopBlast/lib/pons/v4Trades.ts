import 'server-only'

/**
 * Cost basis for wallets that buy AFTER a launch graduates.
 *
 * Before graduation the bonding curve emits `CurveBuy` with the exact ETH in
 * and tokens out per recipient, so basis is exact and free. After graduation
 * trading moves to a Uniswap v4 pool, and the PoolManager's `Swap` event
 * names the *router* as sender, not the trader — recovering who actually
 * bought means pairing every swap with the ERC-20 transfers in the same
 * transaction, and giving up whenever a transaction is ambiguous.
 *
 * Birdeye already does that work and supports this chain (`x-chain:
 * robinhood`), returning the resolved `owner` per trade along with both legs.
 * So this reads rather than re-derives. Two consequences worth knowing:
 *
 *   - Amounts arrive as JSON numbers, so post-graduation basis carries float
 *     precision where curve basis is exact to the wei. For a VWAP — a ratio
 *     of two quantities — ~15 significant digits is far more than the price
 *     is ever used to.
 *   - If Birdeye is unavailable, post-graduation buyers simply have no known
 *     basis and drop out of the rankings, which is the same safe failure as
 *     before this existed. It degrades; it does not mis-rank.
 */

import axios from 'axios'

const BASE_URL = 'https://public-api.birdeye.so'
const PAGE_SIZE = 50

/**
 * Offset paging ceiling per refresh.
 *
 * This sets a real semantic, so it is worth stating plainly: trades are read
 * newest-first and the cursor advances to the newest one folded in, which
 * means cost-basis coverage for a graduated pool BEGINS WHEN TOPBLAST STARTS
 * WATCHING IT. A wallet whose only buys predate that has no known basis and
 * sits out of the rankings — the same safe failure as before this existed,
 * not a wrong number. Going forward every trade is captured, because each
 * refresh only has to cover the gap since the last one.
 */
const MAX_PAGES = 20

export interface V4Trade {
  owner: string
  /** Token base units gained (buy) or lost (sell). */
  tokenDelta: bigint
  /** Quote base units spent (buy) or received (sell). */
  quoteDelta: bigint
  isBuy: boolean
  unixTime: number
}

interface Leg {
  address?: string
  decimals?: number
  uiAmount?: number
}

interface TradeRow {
  owner?: string
  source?: string
  txType?: string
  blockUnixTime?: number
  from?: Leg
  to?: Leg
}

function apiKey(): string | null {
  return process.env.BIRDEYE_API_KEY?.trim() || null
}

/**
 * `amount` comes back in scientific notation and has already lost precision
 * by the time it is JSON, so base units are reconstructed from `uiAmount`
 * instead of trusted from `amount`.
 */
function toBaseUnits(leg: Leg | undefined): bigint {
  const ui = leg?.uiAmount
  const decimals = leg?.decimals
  if (typeof ui !== 'number' || !Number.isFinite(ui) || ui <= 0) return 0n
  if (typeof decimals !== 'number' || decimals < 0 || decimals > 36) return 0n
  // BigInt() truncates; the residual is sub-wei against an 18-decimal token.
  return BigInt(Math.round(ui * 10 ** Math.min(decimals, 15))) * 10n ** BigInt(Math.max(0, decimals - 15))
}

/**
 * Uniswap v4 trades for a token, newest first, stopping once we reach trades
 * already accounted for. Returns null (not an empty list) when Birdeye can't
 * answer, so callers can tell "no new trades" from "no data source".
 */
export async function fetchV4Trades(input: {
  token: string
  /** Stop at trades at or before this timestamp — the persisted cursor. */
  sinceUnix: number
  quoteAddress: string
}): Promise<V4Trade[] | null> {
  const key = apiKey()
  if (!key) return null

  const out: V4Trade[] = []
  const token = input.token.toLowerCase()
  const quote = input.quoteAddress.toLowerCase()

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await axios.get(`${BASE_URL}/defi/txs/token`, {
        params: { address: input.token, tx_type: 'swap', limit: PAGE_SIZE, offset: page * PAGE_SIZE },
        headers: { accept: 'application/json', 'x-chain': 'robinhood', 'X-API-KEY': key },
        timeout: 15_000,
      })

      const rows: TradeRow[] = res.data?.data?.items ?? []
      if (rows.length === 0) return out

      let reachedCursor = false
      for (const row of rows) {
        const time = row.blockUnixTime ?? 0
        if (time <= input.sinceUnix) {
          reachedCursor = true
          break
        }
        if (row.txType !== 'swap' || !row.owner) continue
        // Only v4 — curve trades are already indexed exactly from logs, and
        // counting them twice would halve every affected wallet's VWAP.
        if (row.source !== 'uniswapV4') continue

        const fromAddr = row.from?.address?.toLowerCase()
        const toAddr = row.to?.address?.toLowerCase()
        const isBuy = toAddr === token && fromAddr === quote
        const isSell = fromAddr === token && toAddr === quote
        if (!isBuy && !isSell) continue

        const tokenLeg = isBuy ? row.to : row.from
        const quoteLeg = isBuy ? row.from : row.to
        const tokenDelta = toBaseUnits(tokenLeg)
        const quoteDelta = toBaseUnits(quoteLeg)
        if (tokenDelta <= 0n || quoteDelta <= 0n) continue

        out.push({ owner: row.owner.toLowerCase(), tokenDelta, quoteDelta, isBuy, unixTime: time })
      }

      if (reachedCursor || !res.data?.data?.hasNext) return out
    }

    console.warn(
      `[PonsV4Trades] ${input.token}: hit the ${MAX_PAGES}-page ceiling; trades older than ` +
        `${new Date((out[out.length - 1]?.unixTime ?? 0) * 1000).toISOString()} are not covered for cost basis`
    )
    return out
  } catch (err) {
    console.warn('[PonsV4Trades] Birdeye trade fetch failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/** Newest timestamp in a batch — the value to persist as the next cursor. */
export function newestTradeTime(trades: V4Trade[], fallback: number): number {
  return trades.reduce((max, t) => (t.unixTime > max ? t.unixTime : max), fallback)
}
