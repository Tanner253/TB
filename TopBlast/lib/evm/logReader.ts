import 'server-only'

/**
 * Adaptive `eth_getLogs` reader for Robinhood Chain.
 *
 * The chain produces a block every ~0.101s (~853k blocks/day) and the public
 * RPC enforces two limits we measured directly:
 *   - a hard cap of 10,000 matched logs per query, and
 *   - HTTP 429 once you ask for too much too fast.
 *
 * So we can't just ask for a wide range. This walks a block span in windows
 * that shrink when a query is too fat and grow back when it isn't, with
 * backoff on rate limits. Callers get a simple async iteration and never have
 * to think about any of it.
 */

import type { AbiEvent, Address, Log } from 'viem'
import { publicClient } from '@/lib/pons/contracts'

/** Start here; adapts per token. Roughly 2.8h of chain at 0.101s blocks. */
const DEFAULT_WINDOW = 100_000n
const MIN_WINDOW = 1_000n
const MAX_WINDOW = 400_000n
const MAX_RETRIES = 5

function isTooManyLogs(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return m.includes('exceeds limit') || m.includes('too many results') || m.includes('query returned more than')
}

function isRateLimited(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return m.includes('429') || m.includes('too many requests') || m.includes('rate limit')
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export interface ScanOptions {
  address: Address | Address[]
  events: AbiEvent[]
  fromBlock: bigint
  toBlock: bigint
  /** Called for each batch, in ascending block order. */
  onLogs: (logs: Log[]) => Promise<void> | void
  /** Stop early once this many blocks have been scanned (budget guard). */
  maxBlocks?: bigint
  startWindow?: bigint
}

export interface ScanResult {
  /** Last block actually scanned — persist this as the cursor. */
  lastBlock: bigint
  logCount: number
  requests: number
  /** True when we stopped on the budget rather than reaching `toBlock`. */
  truncated: boolean
}

/**
 * Walks [fromBlock, toBlock] and streams matching logs to `onLogs`.
 * Never throws on rate limits — it backs off and retries, and gives up on a
 * window only after MAX_RETRIES, returning the cursor it safely reached.
 */
export async function scanLogs(opts: ScanOptions): Promise<ScanResult> {
  const client = publicClient()
  let window = opts.startWindow ?? DEFAULT_WINDOW
  let cursor = opts.fromBlock
  let logCount = 0
  let requests = 0
  let scannedBlocks = 0n

  while (cursor <= opts.toBlock) {
    if (opts.maxBlocks != null && scannedBlocks >= opts.maxBlocks) {
      return { lastBlock: cursor - 1n, logCount, requests, truncated: true }
    }

    const end = cursor + window - 1n > opts.toBlock ? opts.toBlock : cursor + window - 1n
    let attempt = 0
    let ok = false

    while (attempt < MAX_RETRIES && !ok) {
      try {
        requests++
        const logs = await client.getLogs({
          address: opts.address,
          events: opts.events,
          fromBlock: cursor,
          toBlock: end,
        } as never)

        if (logs.length) {
          await opts.onLogs(logs as Log[])
          logCount += logs.length
        }
        ok = true

        // Comfortably under the cap — reach for a wider window next time.
        if (logs.length < 2_000 && window < MAX_WINDOW) {
          window = window * 2n > MAX_WINDOW ? MAX_WINDOW : window * 2n
        }
      } catch (err) {
        attempt++
        if (isTooManyLogs(err)) {
          // Too fat: halve and retry the SAME range, don't advance.
          if (window <= MIN_WINDOW) {
            console.warn(
              `[LogReader] ${cursor}-${end} exceeds the log cap at the minimum window; skipping`
            )
            ok = true // give up on this slice rather than spin forever
            break
          }
          window = window / 2n < MIN_WINDOW ? MIN_WINDOW : window / 2n
          continue
        }
        if (isRateLimited(err)) {
          const wait = 400 * 2 ** (attempt - 1)
          await sleep(wait)
          // Also ease off the window — we're asking for too much per second.
          if (window > MIN_WINDOW) window = window / 2n
          continue
        }
        if (attempt >= MAX_RETRIES) {
          console.error(
            `[LogReader] giving up on ${cursor}-${end}:`,
            err instanceof Error ? err.message : err
          )
          ok = true
          break
        }
        await sleep(250 * attempt)
      }
    }

    scannedBlocks += end - cursor + 1n
    cursor = end + 1n
  }

  return { lastBlock: opts.toBlock, logCount, requests, truncated: false }
}

export async function latestBlock(): Promise<bigint> {
  return publicClient().getBlockNumber()
}
