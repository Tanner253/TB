import 'server-only'

/**
 * Holder balances + cost basis for a Pons v2 launch — the Robinhood Chain
 * replacement for Birdeye holder snapshots AND Helius VWAP hydration.
 *
 * Both come from on-chain logs, indexed forward from the launch block:
 *
 *  - **Balances** from ERC-20 `Transfer` logs on the token.
 *  - **Cost basis** from `CurveBuy` / `CurveSell` logs on the launch's curve.
 *    These carry `quoteIn` and `tokensOut` per recipient, so VWAP is exact
 *    rather than inferred from swap heuristics the way the Solana path had
 *    to be. Post-graduation trades happen in the Uniswap v4 pool and are
 *    picked up as plain transfers (see `hasPoolActivity`).
 *
 * State is checkpointed in Mongo so each cycle only scans new blocks.
 */

import { formatUnits, getAddress, parseAbiItem, type Address, type Log } from 'viem'
import connectDB from '@/lib/db'
import { scanLogs, latestBlock } from '@/lib/evm/logReader'
import { CURVE_ABI, ERC20_ABI, NATIVE_ADDRESS } from './contracts'
import { getPonsLaunch, type PonsLaunch } from './launch'

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
)
const CURVE_BUY_EVENT = parseAbiItem(
  'event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)'
)
const CURVE_SELL_EVENT = parseAbiItem(
  'event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)'
)

/** Per-cycle scan budget so one huge backlog can't stall the whole cron. */
function maxBlocksPerCycle(): bigint {
  const n = parseInt(process.env.PONS_INDEX_MAX_BLOCKS_PER_CYCLE ?? '', 10)
  return BigInt(Number.isFinite(n) && n > 0 ? n : 2_000_000) // ~2.3h of chain
}

export interface IndexedHolder {
  wallet: string
  /** Human units. */
  balance: number
  /** Volume-weighted average entry price in quote-asset units, null if unknown. */
  vwap: number | null
  totalTokensBought: number
  totalQuoteSpent: number
  firstBuyAt: Date | null
  hasSold: boolean
  /** Received tokens without a recorded buy (airdrop / wallet transfer in). */
  hasTransferIn: boolean
}

interface RawHolder {
  balanceRaw: bigint
  boughtRaw: bigint
  quoteSpentRaw: bigint
  firstBuyMs: number | null
  hasSold: boolean
  hasTransferIn: boolean
}

function blank(): RawHolder {
  return {
    balanceRaw: 0n,
    boughtRaw: 0n,
    quoteSpentRaw: 0n,
    firstBuyMs: null,
    hasSold: false,
    hasTransferIn: false,
  }
}

/** Addresses that are protocol plumbing, never real holders. */
function isSystemAddress(addr: string, launch: PonsLaunch): boolean {
  const a = addr.toLowerCase()
  return (
    a === NATIVE_ADDRESS ||
    a === launch.curve.toLowerCase() ||
    a === launch.token.toLowerCase()
  )
}

export interface IndexResult {
  holders: IndexedHolder[]
  lastIndexedBlock: number
  /** True when we hit the per-cycle budget and more blocks remain. */
  incomplete: boolean
  quoteDecimals: number
  quoteIsNative: boolean
}

/**
 * Builds the full holder set for a launch by replaying its logs.
 *
 * `fromBlock` should be the persisted cursor; pass the launch block on first
 * run. Returns holders plus the new cursor to persist.
 */
export async function indexLaunchHolders(input: {
  tokenAddress: string
  launchBlock: bigint
  fromBlock?: bigint
  /** Carry forward previously indexed state so scans stay incremental. */
  priorState?: Map<string, RawHolder>
}): Promise<IndexResult | null> {
  const launch = await getPonsLaunch(input.tokenAddress)
  if (!launch) return null

  await connectDB()

  const tokenDecimals = await getTokenDecimals(launch.token)
  const quoteDecimals = launch.nativeQuote ? 18 : await getTokenDecimals(launch.pairToken)

  const holders = input.priorState ?? new Map<string, RawHolder>()
  const get = (addr: string): RawHolder => {
    const key = addr.toLowerCase()
    let h = holders.get(key)
    if (!h) {
      h = blank()
      holders.set(key, h)
    }
    return h
  }

  const head = await latestBlock()
  const start = input.fromBlock ?? input.launchBlock
  if (start > head) {
    return {
      holders: [],
      lastIndexedBlock: Number(head),
      incomplete: false,
      quoteDecimals,
      quoteIsNative: launch.nativeQuote,
    }
  }

  // --- balances from token Transfer logs ---
  const transferScan = await scanLogs({
    address: launch.token,
    events: [TRANSFER_EVENT],
    fromBlock: start,
    toBlock: head,
    maxBlocks: maxBlocksPerCycle(),
    onLogs: logs => {
      for (const log of logs) {
        const a = log as Log<bigint, number, false, typeof TRANSFER_EVENT>
        const from = a.args?.from as string | undefined
        const to = a.args?.to as string | undefined
        const value = (a.args?.value as bigint | undefined) ?? 0n
        if (!from || !to || value <= 0n) continue

        if (!isSystemAddress(from, launch)) {
          const h = get(from)
          h.balanceRaw -= value
          // Sending tokens out of a tracked wallet counts as disposal.
          h.hasSold = true
        }
        if (!isSystemAddress(to, launch)) {
          const h = get(to)
          h.balanceRaw += value
          // A transfer whose source is not the curve had no recorded buy.
          if (from.toLowerCase() !== launch.curve.toLowerCase()) h.hasTransferIn = true
        }
      }
    },
  })

  // --- cost basis from curve trades (exact, not inferred) ---
  await scanLogs({
    address: launch.curve,
    events: [CURVE_BUY_EVENT, CURVE_SELL_EVENT],
    fromBlock: start,
    toBlock: transferScan.lastBlock,
    onLogs: async logs => {
      for (const log of logs) {
        const name = (log as { eventName?: string }).eventName
        const args = (log as { args?: Record<string, unknown> }).args ?? {}
        const recipient = args.recipient as string | undefined
        if (!recipient) continue
        const h = get(recipient)

        if (name === 'CurveBuy') {
          const quoteIn = (args.quoteIn as bigint) ?? 0n
          const tokensOut = (args.tokensOut as bigint) ?? 0n
          h.boughtRaw += tokensOut
          h.quoteSpentRaw += quoteIn
          if (h.firstBuyMs == null) {
            h.firstBuyMs = await blockTimeMs(log as { blockNumber?: bigint })
          }
          // A curve buy is a genuine entry, not an unexplained transfer in.
          h.hasTransferIn = false
        } else if (name === 'CurveSell') {
          h.hasSold = true
        }
      }
    },
  })

  const out: IndexedHolder[] = []
  for (const [wallet, h] of holders) {
    if (h.balanceRaw <= 0n) continue
    const balance = Number(formatUnits(h.balanceRaw, tokenDecimals))
    const bought = Number(formatUnits(h.boughtRaw, tokenDecimals))
    const spent = Number(formatUnits(h.quoteSpentRaw, quoteDecimals))
    out.push({
      wallet: getAddress(wallet),
      balance,
      vwap: bought > 0 && spent > 0 ? spent / bought : null,
      totalTokensBought: bought,
      totalQuoteSpent: spent,
      firstBuyAt: h.firstBuyMs ? new Date(h.firstBuyMs) : null,
      hasSold: h.hasSold,
      hasTransferIn: h.hasTransferIn,
    })
  }

  out.sort((a, b) => b.balance - a.balance)

  return {
    holders: out,
    lastIndexedBlock: Number(transferScan.lastBlock),
    incomplete: transferScan.truncated,
    quoteDecimals,
    quoteIsNative: launch.nativeQuote,
  }
}

const decimalsCache = new Map<string, number>()

async function getTokenDecimals(token: Address): Promise<number> {
  const key = token.toLowerCase()
  const hit = decimalsCache.get(key)
  if (hit != null) return hit
  try {
    const { publicClient } = await import('./contracts')
    const d = await publicClient().readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'decimals',
    })
    const n = Number(d)
    decimalsCache.set(key, n)
    return n
  } catch {
    return 18
  }
}

const blockTimeCache = new Map<string, number>()

async function blockTimeMs(log: { blockNumber?: bigint }): Promise<number | null> {
  const bn = log.blockNumber
  if (bn == null) return null
  const key = bn.toString()
  const hit = blockTimeCache.get(key)
  if (hit != null) return hit
  try {
    const { publicClient } = await import('./contracts')
    const block = await publicClient().getBlock({ blockNumber: bn })
    const ms = Number(block.timestamp) * 1000
    if (blockTimeCache.size > 5_000) blockTimeCache.clear()
    blockTimeCache.set(key, ms)
    return ms
  } catch {
    return null
  }
}

/** Curve ABI re-export so callers can subscribe to trades without re-importing. */
export { CURVE_ABI }
