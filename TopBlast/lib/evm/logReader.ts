import 'server-only'
import type { AbiEvent, Address, Log } from 'viem'
import { publicClient } from '@/lib/pons/contracts'
export interface ScanOptions {
  address: Address | Address[]
  events: AbiEvent[]
  fromBlock: bigint
  toBlock: bigint
  onLogs: (logs: Log[]) => Promise<void> | void
  maxBlocks?: bigint
  startWindow?: bigint
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
        logs = await publicClient().getLogs({ address: opts.address, events: opts.events, fromBlock: cursor, toBlock: end, strict: true }) as Log[]
        break
      } catch (error) {
        const message = String(error).toLowerCase()
        if (/exceeds limit|too many results|query returned more than/.test(message) && window > 1n) {
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
    if (logs.length < 2000) window = window * 2n > 400_000n ? 400_000n : window * 2n
  }
  return { lastBlock: cursor - 1n, logCount, requests, truncated: target < opts.toBlock }
}
export async function latestBlock(): Promise<bigint> {
  return publicClient().getBlockNumber()
}
