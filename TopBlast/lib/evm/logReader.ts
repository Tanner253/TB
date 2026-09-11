import 'server-only'
import type { AbiEvent, Address, Log } from 'viem'
import { publicClient } from '@/lib/pons/contracts'
export interface ScanOptions {
  /** Omit to scan every contract and rely on `args`/topics alone. */
  address?: Address | Address[]
  events: AbiEvent[]
  /**
   * Indexed-argument filter, e.g. { to: wallet }. Only honoured with exactly
   * ONE event — viem silently ignores args alongside `events`, which turns a
   * targeted query into a full scan, so this is asserted rather than trusted.
   */
  args?: Record<string, unknown>
  fromBlock: bigint
  toBlock: bigint
  onLogs: (logs: Log[]) => Promise<void> | void
  maxBlocks?: bigint
  startWindow?: bigint
  /**
   * Ceiling the window grows back to. The default suits per-token scans;
   * a topic-filtered wallet scan matches far less and can afford much wider
   * windows, which is the difference between 10 requests and 50.
   */
  maxWindow?: bigint
  /**
   * Spacing between requests. The public RPC answers a burst with 403/429,
   * and backing off afterwards costs more than pacing ahead of it, so a wide
   * scan walks rather than sprints.
   */
  pauseMs?: number
}
export interface ScanResult {
  lastBlock: bigint
  logCount: number
  requests: number
  truncated: boolean
}
/** Never advance past a failed read or consumer. */
export async function scanLogs(opts: ScanOptions): Promise<ScanResult> {
  let cursor = opts.fromBlock
  let window = opts.startWindow ?? 100_000n
  if (window < 1n || (opts.maxBlocks != null && opts.maxBlocks < 1n)) throw new Error('Invalid scan budget')
  if (opts.args && opts.events.length !== 1) {
    throw new Error('scanLogs: args filtering requires exactly one event')
  }
  const budgetEnd = opts.maxBlocks == null ? opts.toBlock : cursor + opts.maxBlocks - 1n
  const target = budgetEnd < opts.toBlock ? budgetEnd : opts.toBlock
  let logCount = 0
  let requests = 0
  while (cursor <= target) {
    let retries = 0
    let logs: Log[]
    let end: bigint
    for (;;) {
      end = cursor + window - 1n < target ? cursor + window - 1n : target
      try {
        requests++
        logs = await publicClient().getLogs({
          ...(opts.address ? { address: opts.address } : {}),
          ...(opts.args
            ? { event: opts.events[0], args: opts.args }
            : { events: opts.events }),
          fromBlock: cursor,
          toBlock: end,
          strict: true,
        } as never) as Log[]
        break
      } catch (error) {
        const message = String(error).toLowerCase()
        // A timeout means the same thing as the cap for our purposes: the
        // range was too ambitious. Measured on this chain, a topic-filtered
        // scan handles ~2M blocks and times out around 10M.
        if (
          /exceeds limit|too many results|query returned more than|timed out|timeout/.test(message) &&
          window > 1n
        ) {
          window = window / 2n || 1n
          continue
        }
        if (++retries >= 5) throw error
        await new Promise(resolve => setTimeout(resolve, 250 * 2 ** retries))
      }
    }
    await opts.onLogs(logs)
    logCount += logs.length
    cursor = end + 1n

    const ceiling = opts.maxWindow ?? 400_000n
    if (logs.length < 2000 && window < ceiling) {
      window = window * 2n > ceiling ? ceiling : window * 2n
    }

    const pause = opts.pauseMs ?? 120
    if (pause > 0 && cursor <= target) {
      await new Promise(resolve => setTimeout(resolve, pause))
    }
  }
  return { lastBlock: cursor - 1n, logCount, requests, truncated: target < opts.toBlock }
}
export async function latestBlock(): Promise<bigint> {
  return publicClient().getBlockNumber()
}
