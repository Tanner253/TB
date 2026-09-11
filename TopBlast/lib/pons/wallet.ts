import 'server-only'

/**
 * Arbitrary-wallet inspection on Robinhood Chain — what the Rekt Report Card
 * needs and EVM does not give you for free.
 *
 * Solana has `getTokenAccountsByOwner`: one call, every bag. EVM has no such
 * thing, because balances live inside each token contract rather than in
 * accounts owned by the wallet. So it takes two steps, both measured against
 * the live chain before being built on:
 *
 *   1. DISCOVER — `Transfer` logs topic-filtered on the wallet as recipient.
 *      Topics are indexed, so this is fast: 2,000,000 blocks came back in
 *      ~240ms. It is bounded, though — 10M blocks times out, and a busy
 *      wallet blows the 10,000-log cap over a wide range — so the shared
 *      windowed reader walks it and `PONS_WALLET_SCAN_BLOCKS` sets how far
 *      back we look. That bound is the honest limitation of this feature:
 *      bags first received before the window are invisible to it.
 *
 *   2. WEIGH — one Multicall3 `aggregate3` of `balanceOf` across every
 *      candidate. Multicall3 is deployed at its canonical address here
 *      (verified on-chain), which matters: the public RPC starts returning
 *      403s after a few dozen sequential `eth_call`s, so batching isn't an
 *      optimisation, it's the difference between working and not.
 *
 * Cost basis reuses the same exact source as payout eligibility — `CurveBuy`
 * carries `quoteIn` and `tokensOut` per recipient — so a wallet's VWAP here
 * and its VWAP in the rankings are the same number, not two estimates.
 */

import { formatUnits, getAddress, parseAbi, parseAbiItem, type Address } from 'viem'
import { scanLogs, latestBlock } from '@/lib/evm/logReader'
import { ERC20_ABI, publicClient } from './contracts'
import { getPonsLaunch } from './launch'

/** Canonical across most EVM chains; confirmed deployed on Robinhood Chain. */
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address

const MULTICALL3_ABI = parseAbi([
  'struct Call3 { address target; bool allowFailure; bytes callData; }',
  'struct Result { bool success; bytes returnData; }',
  'function aggregate3(Call3[] calls) payable returns (Result[] returnData)',
])

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
)
const CURVE_BUY_EVENT = parseAbiItem(
  'event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)'
)
const CURVE_SELL_EVENT = parseAbiItem(
  'event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)'
)

/** How far back a wallet scan reaches. ~2.3 days of chain per 2M blocks. */
export function walletScanBlocks(): bigint {
  const n = parseInt(process.env.PONS_WALLET_SCAN_BLOCKS ?? '', 10)
  return BigInt(Number.isFinite(n) && n > 0 ? n : 20_000_000)
}

/** Candidate tokens capped so one whale can't turn a card into a crawl. */
function maxCandidates(): number {
  const n = parseInt(process.env.PONS_WALLET_MAX_TOKENS ?? '', 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 400) : 200
}

export interface WalletBag {
  token: Address
  /** Raw base units. */
  balanceRaw: bigint
  decimals: number
  /** Human units. */
  balance: number
  symbol: string
}

/**
 * Every ERC-20 the wallet has received inside the scan window. Receiving is
 * the right signal: a token can only be held if it arrived, and balances are
 * confirmed separately, so a sold-out position simply weighs zero.
 */
export async function discoverWalletTokens(wallet: string): Promise<Address[]> {
  const head = await latestBlock()
  const span = walletScanBlocks()
  const from = head > span ? head - span : 0n

  const tokens = new Set<string>()
  await scanLogs({
    // No address filter: we are asking "what touched this wallet", not
    // "what happened to this token".
    events: [TRANSFER_EVENT],
    fromBlock: from,
    toBlock: head,
    // Measured ceiling on this RPC; the reader halves from here on failure.
    startWindow: 2_000_000n,
    maxWindow: 2_000_000n,
    args: { to: getAddress(wallet) },
    onLogs: logs => {
      for (const log of logs) {
        const address = (log as { address?: string }).address
        if (address) tokens.add(address.toLowerCase())
      }
    },
  })

  return Array.from(tokens).slice(0, maxCandidates()).map(t => getAddress(t))
}

/** Current balances + metadata for candidate tokens, in one batched call. */
export async function getWalletBalances(
  wallet: string,
  tokens: Address[]
): Promise<WalletBag[]> {
  if (tokens.length === 0) return []
  const client = publicClient()
  const owner = getAddress(wallet)

  // Three reads per token in a single round trip. allowFailure keeps one
  // non-conforming contract from voiding the whole batch.
  const results = (await client.readContract({
    address: MULTICALL3,
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    args: [
      tokens.flatMap(token => [
        { target: token, allowFailure: true, callData: encodeBalanceOf(owner) },
        { target: token, allowFailure: true, callData: DECIMALS_CALLDATA },
        { target: token, allowFailure: true, callData: SYMBOL_CALLDATA },
      ]),
    ],
  } as never)) as ReadonlyArray<{ success: boolean; returnData: `0x${string}` }>

  const out: WalletBag[] = []
  tokens.forEach((token, i) => {
    const [balance, decimals, symbol] = results.slice(i * 3, i * 3 + 3)
    if (!balance?.success) return
    const balanceRaw = BigInt(balance.returnData || '0x0')
    if (balanceRaw <= 0n) return

    const dec = decimals?.success ? Number(BigInt(decimals.returnData || '0x12')) : 18
    out.push({
      token,
      balanceRaw,
      decimals: dec,
      balance: Number(formatUnits(balanceRaw, dec)),
      symbol: decodeStringResult(symbol?.success ? symbol.returnData : null) ?? shortAddress(token),
    })
  })

  return out.sort((a, b) => b.balance - a.balance)
}

export interface WalletCostBasis {
  /** Average entry in the quote asset (ETH), null when no buys were found. */
  vwap: number | null
  totalTokensBought: number
  totalQuoteSpent: number
  buyCount: number
  firstBuyAt: Date | null
  hasSold: boolean
}

const EMPTY_BASIS: WalletCostBasis = {
  vwap: null,
  totalTokensBought: 0,
  totalQuoteSpent: 0,
  buyCount: 0,
  firstBuyAt: null,
  hasSold: false,
}

/**
 * Exact cost basis for one wallet in one token, from the curve's own trade
 * events. Returns an empty basis rather than a guess when the token isn't a
 * Pons launch or the wallet only ever received transfers — a card that says
 * "no entry price found" is worth more than one that invents one.
 */
export async function getWalletCostBasis(
  wallet: string,
  token: Address,
  tokenDecimals: number
): Promise<WalletCostBasis> {
  const launch = await getPonsLaunch(token)
  if (!launch || !launch.nativeQuote) return EMPTY_BASIS

  const head = await latestBlock()
  const span = walletScanBlocks()
  const from = head > span ? head - span : 0n
  const owner = getAddress(wallet)

  let boughtRaw = 0n
  let spentRaw = 0n
  let buyCount = 0
  let firstBlock: bigint | null = null
  let hasSold = false

  await scanLogs({
    address: launch.curve,
    events: [CURVE_BUY_EVENT, CURVE_SELL_EVENT],
    fromBlock: from,
    toBlock: head,
    startWindow: 2_000_000n,
    maxWindow: 2_000_000n,
    onLogs: logs => {
      for (const log of logs) {
        const name = (log as { eventName?: string }).eventName
        const args = (log as { args?: Record<string, unknown> }).args ?? {}
        // Two events rules out an indexed filter, but the scan is already
        // pinned to this one curve, so matching here is cheap.
        const recipient = args.recipient as string | undefined
        if (!recipient || recipient.toLowerCase() !== owner.toLowerCase()) continue
        if (name === 'CurveBuy') {
          boughtRaw += (args.tokensOut as bigint) ?? 0n
          spentRaw += (args.quoteIn as bigint) ?? 0n
          buyCount++
          const bn = (log as { blockNumber?: bigint }).blockNumber
          if (bn != null && (firstBlock == null || bn < firstBlock)) firstBlock = bn
        } else if (name === 'CurveSell') {
          hasSold = true
        }
      }
    },
  })

  const bought = Number(formatUnits(boughtRaw, tokenDecimals))
  const spent = Number(formatUnits(spentRaw, 18))
  if (!(bought > 0 && spent > 0)) {
    return { ...EMPTY_BASIS, buyCount, hasSold }
  }

  let firstBuyAt: Date | null = null
  if (firstBlock != null) {
    try {
      const block = await publicClient().getBlock({ blockNumber: firstBlock })
      firstBuyAt = new Date(Number(block.timestamp) * 1000)
    } catch {
      /* timestamp is nice to have, not load-bearing */
    }
  }

  return {
    vwap: spent / bought,
    totalTokensBought: bought,
    totalQuoteSpent: spent,
    buyCount,
    firstBuyAt,
    hasSold,
  }
}

// --- calldata helpers (hand-rolled: three selectors don't need an encoder) ---

const DECIMALS_CALLDATA = '0x313ce567' as const // decimals()
const SYMBOL_CALLDATA = '0x95d89b41' as const // symbol()

function encodeBalanceOf(owner: Address): `0x${string}` {
  return `0x70a08231${owner.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`
}

function shortAddress(token: string): string {
  return `${token.slice(0, 6)}…`
}

/**
 * ERC-20 `symbol()` is meant to return a dynamic string, but plenty of older
 * tokens return a fixed bytes32 instead. Handle both, give up quietly.
 */
function decodeStringResult(data: string | null | undefined): string | null {
  if (!data || data === '0x') return null
  try {
    const body = data.slice(2)
    if (body.length === 64) {
      const text = Buffer.from(body, 'hex').toString('utf8').replace(/\0+$/, '').trim()
      return text || null
    }
    const length = parseInt(body.slice(64, 128), 16)
    if (!Number.isFinite(length) || length <= 0 || length > 64) return null
    const text = Buffer.from(body.slice(128, 128 + length * 2), 'hex').toString('utf8').trim()
    return text || null
  } catch {
    return null
  }
}

export { ERC20_ABI }
