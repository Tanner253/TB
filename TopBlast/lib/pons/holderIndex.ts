import { getV1Launch, V3_ABI } from './v1'
import 'server-only'
import mongoose from 'mongoose'
import { formatUnits, parseEventLogs, type Address } from 'viem'
import connectDB from '@/lib/db'
import { scanLogs } from '@/lib/evm/logReader'
import { CURVE_ABI, ERC20_ABI, NATIVE_ADDRESS, V4_POOL_MANAGER, PONS_V2, getChainId, publicClient } from './contracts'
import { getPonsLaunch } from './launch'

export interface IndexedHolder {
  wallet: string
  balance: number
  vwap: number | null
  totalTokensBought: number
  totalQuoteSpent: number
  firstBuyAt: Date | null
  hasSold: boolean
  hasTransferIn: boolean
}
export interface IndexResult {
  holders: IndexedHolder[]
  lastIndexedBlock: number
  incomplete: boolean
  quoteDecimals: number
  quoteIsNative: boolean
}
type Raw = { balance: string; bought: string; spent: string; firstBuyMs: number | null; sold: boolean; transferIn: boolean }
type Checkpoint = { _id: string; version: number; launchBlock: string; cursor: string; blockHash: string; holders: Record<string, Raw>
  /** Newest post-graduation trade already folded in (unix seconds). */
  v4Cursor?: number }

/** Locate the initial mint using logs; public RPC may not retain historical state. */
async function deploymentBlock(token: Address, head: bigint): Promise<bigint> {
  const event = ERC20_ABI.find(a => a.type === 'event' && a.name === 'Transfer')!
  for (let end = head; end >= 0n;) {
    const start = end > 399_999n ? end - 399_999n : 0n
    const logs = await publicClient().getLogs({ address: token, event, args: { from: NATIVE_ADDRESS }, fromBlock: start, toBlock: end, strict: true })
    if (logs.length) return logs[0].blockNumber!
    if (start === 0n) break
    end = start - 1n
  }
  throw new Error('Initial token mint event not found; cannot build complete balances')
}
export async function indexLaunchHolders(input: { tokenAddress: string; launchBlock?: bigint; fromBlock?: bigint }): Promise<IndexResult | null> {
  const v2 = await getPonsLaunch(input.tokenAddress)
  const v1 = v2 ? null : await getV1Launch(input.tokenAddress)
  const launch = v2 ?? (v1 ? { token: v1.token, curve: v1.pool, pairToken: v1.pairedToken, nativeQuote: v1.nativeQuote } : null)
  if (!launch) return null
  await connectDB()
  const db = mongoose.connection.db
  if (!db) throw new Error('Database is required for Pons indexing')
  const collection = db.collection<Checkpoint>('pons_holder_checkpoints')
  const id = getChainId() + ':' + launch.token.toLowerCase()
  const saved = await collection.findOne({ _id: id })
  const client = publicClient()
  const head = await client.getBlockNumber()
  const confirmed = head > 100n ? head - 100n : 0n
  let prior = saved
  if (prior) {
    const block = await client.getBlock({ blockNumber: BigInt(prior.cursor) })
    if (block.hash !== prior.blockHash) prior = null // replay after a reorg
  }
  const launchBlock = prior ? BigInt(prior.launchBlock) : await deploymentBlock(launch.token, v1 && v1.restrictionsEndBlock < confirmed ? v1.restrictionsEndBlock : confirmed)
  const start = prior ? BigInt(prior.cursor) + 1n : launchBlock
  const raw: Record<string, Raw> = structuredClone(prior?.holders ?? {})
  const get = (address: string) => raw[address.toLowerCase()] ??= { balance: '0', bought: '0', spent: '0', firstBuyMs: null, sold: false, transferIn: false }
  const excluded = new Set([NATIVE_ADDRESS, launch.token, launch.curve, V4_POOL_MANAGER, ...Object.values(PONS_V2)].map(a => a.toLowerCase()))
  const [decimals, quoteDecimals] = await Promise.all([
    client.readContract({ address: launch.token, abi: ERC20_ABI, functionName: 'decimals' }),
    launch.nativeQuote ? Promise.resolve(18) : client.readContract({ address: launch.pairToken, abi: ERC20_ABI, functionName: 'decimals' }),
  ])
  const budget = 2_000_000n
  const end = start + budget - 1n < confirmed ? start + budget - 1n : confirmed
  const times = new Map<string, number>()
  if (start <= end) {
    await scanLogs({
      address: [launch.token, launch.curve],
      events: [...ERC20_ABI, ...CURVE_ABI, ...V3_ABI].filter(a => a.type === 'event'),
      fromBlock: start, toBlock: end,
      onLogs: async logs => {
        for (const log of logs) {
          const { eventName: name, args = {} } = log as unknown as { eventName: string; args: Record<string, any> }
          if (name === 'Transfer' && log.address.toLowerCase() === launch.token.toLowerCase()) {
            const { from, to, value } = args
            if (!from || !to || typeof value !== 'bigint') throw new Error('Malformed Transfer log')
            if (from.toLowerCase() === to.toLowerCase()) continue
            if (!excluded.has(from.toLowerCase())) {
              const h = get(from); h.balance = (BigInt(h.balance) - value).toString(); h.sold = true
            }
            if (!excluded.has(to.toLowerCase())) {
              const h = get(to); h.balance = (BigInt(h.balance) + value).toString()
              if (from.toLowerCase() !== launch.curve.toLowerCase()) h.transferIn = true
            }
          } else if (name === 'CurveBuy' && log.address.toLowerCase() === launch.curve.toLowerCase()) {
            const h = get(args.recipient)
            h.bought = (BigInt(h.bought) + args.tokensOut).toString()
            h.spent = (BigInt(h.spent) + args.quoteIn).toString()
            if (h.firstBuyMs == null) {
              const bn = log.blockNumber!
              if (!times.has(bn.toString())) times.set(bn.toString(), Number((await client.getBlock({ blockNumber: bn })).timestamp) * 1000)
              h.firstBuyMs = times.get(bn.toString())!
            }
          } else if (name === 'Swap' && v1 && log.address.toLowerCase() === v1.pool.toLowerCase()) {
            const tokenDelta = v1.isToken0 ? args.amount0 : args.amount1
            const quoteDelta = v1.isToken0 ? args.amount1 : args.amount0
            if (tokenDelta < 0n && quoteDelta > 0n) {
              const receipt = await client.getTransactionReceipt({ hash: log.transactionHash! })
              const trades = parseEventLogs({ abi: V3_ABI, logs: receipt.logs, eventName: 'Swap' })
                .filter(e => e.address.toLowerCase() === v1.pool.toLowerCase())
              // Ambiguous multi-swap transactions never get invented entry prices.
              if (trades.length === 1) {
                const transfers = parseEventLogs({ abi: ERC20_ABI, logs: receipt.logs, eventName: 'Transfer' })
                  .filter(e => e.address.toLowerCase() === launch.token.toLowerCase())
                const net = new Map<string, bigint>()
                for (const e of transfers) {
                  const from = e.args.from.toLowerCase(), to = e.args.to.toLowerCase()
                  net.set(from, (net.get(from) ?? 0n) - e.args.value)
                  net.set(to, (net.get(to) ?? 0n) + e.args.value)
                }
                const recipients = [...net].filter(([address, amount]) => amount > 0n && !excluded.has(address))
                if (recipients.length === 1 && recipients[0][1] === -tokenDelta) {
                  const h = get(recipients[0][0])
                  h.bought = (BigInt(h.bought) - tokenDelta).toString()
                  h.spent = (BigInt(h.spent) + quoteDelta).toString()
                  if (h.firstBuyMs == null) h.firstBuyMs = Number((await client.getBlock({ blockNumber: log.blockNumber! })).timestamp) * 1000
                }
              }
            }
          } else if (name === 'CurveSell' && log.address.toLowerCase() === launch.curve.toLowerCase()) {
            get(args.seller).sold = true // recipient receives quote; seller disposes tokens
          }
        }
      },
    })
    // Only a v2 launch record knows about graduation; v1 pools are indexed
    // from their own Swap events above.
    const v4Cursor = await foldV4Trades({
      launch: { token: launch.token, pairToken: launch.pairToken, nativeQuote: launch.nativeQuote, onUniswapV4: Boolean(v2?.onUniswapV4) },
      raw, get, excluded, prior: saved?.v4Cursor ?? 0,
    })
    const checkpoint: Checkpoint = {
      _id: id, version: (saved?.version ?? 0) + 1, launchBlock: launchBlock.toString(),
      cursor: end.toString(), blockHash: (await client.getBlock({ blockNumber: end })).hash!,
      holders: raw, v4Cursor,
    }
    if (saved) {
      const write = await collection.replaceOne({ _id: id, version: saved.version }, checkpoint)
      if (!write.matchedCount) throw new Error('Concurrent Pons index refresh; retry')
    } else await collection.insertOne(checkpoint)
  }
  const holders: IndexedHolder[] = []
  for (const [wallet, h] of Object.entries(raw)) {
    if (excluded.has(wallet) || BigInt(h.balance) <= 0n) continue
    const balance = Number(formatUnits(BigInt(h.balance), Number(decimals)))
    const bought = Number(formatUnits(BigInt(h.bought), Number(decimals)))
    const spent = Number(formatUnits(BigInt(h.spent), Number(quoteDecimals)))
    holders.push({ wallet, balance, vwap: bought > 0 ? spent / bought : null, totalTokensBought: bought, totalQuoteSpent: spent,
      firstBuyAt: h.firstBuyMs == null ? null : new Date(h.firstBuyMs), hasSold: h.sold, hasTransferIn: h.transferIn })
  }
  return { holders: holders.sort((a,b) => b.balance - a.balance), lastIndexedBlock: Number(end), incomplete: end < confirmed,
    quoteDecimals: Number(quoteDecimals), quoteIsNative: launch.nativeQuote }
}
export { CURVE_ABI }

/**
 * Adds post-graduation Uniswap v4 buys to the ledger.
 *
 * Curve trades stay the source of truth for everything before graduation —
 * they are exact and already indexed above. This only covers what the curve
 * can no longer see, and only for launches that have actually graduated.
 *
 * Returns the cursor to persist. On any failure it returns the previous
 * cursor unchanged, so a bad fetch re-reads the same window next cycle
 * rather than silently skipping trades.
 */
async function foldV4Trades(input: {
  launch: { token: Address; pairToken: Address; nativeQuote: boolean; onUniswapV4: boolean }
  raw: Record<string, Raw>
  get: (address: string) => Raw
  excluded: Set<string>
  prior: number
}): Promise<number> {
  if (!input.launch.onUniswapV4) return input.prior

  const { fetchV4Trades, newestTradeTime } = await import('./v4Trades')
  const trades = await fetchV4Trades({
    token: input.launch.token,
    sinceUnix: input.prior,
    quoteAddress: input.launch.nativeQuote ? NATIVE_ADDRESS : input.launch.pairToken,
  })
  if (!trades || trades.length === 0) return input.prior

  // Oldest first so `firstBuyMs` lands on the genuine first entry.
  for (const trade of [...trades].sort((a, b) => a.unixTime - b.unixTime)) {
    if (input.excluded.has(trade.owner)) continue
    const h = input.get(trade.owner)
    if (trade.isBuy) {
      h.bought = (BigInt(h.bought) + trade.tokenDelta).toString()
      h.spent = (BigInt(h.spent) + trade.quoteDelta).toString()
      // A real market buy is an entry, not an unexplained transfer in.
      h.transferIn = false
      if (h.firstBuyMs == null) h.firstBuyMs = trade.unixTime * 1000
    } else {
      h.sold = true
    }
  }

  return newestTradeTime(trades, input.prior)
}
