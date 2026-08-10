/**
 * Birdeye token holder snapshots — one paginated call per 100 wallets (by CA).
 * @see https://docs.birdeye.so/reference/get-defi-v3-token-holder
 */

import axios from 'axios'
import { mapBirdeyeWalletHolderRow, type BirdeyeWalletHolderRow } from '@/lib/solana/birdeyeHolderMapping'

const BASE_URL = 'https://public-api.birdeye.so'

export function isBirdeyeHolderSourceEnabled(): boolean {
  return Boolean(process.env.BIRDEYE_API_KEY?.trim())
}

function getApiKey(): string {
  const key = process.env.BIRDEYE_API_KEY?.trim()
  if (!key) throw new Error('BIRDEYE_API_KEY is required')
  return key
}

export interface BirdeyeHolderSnapshot {
  wallet: string
  balance: number
  vwap: number | null
  firstBuyTimestamp: number | null
  hasSold: boolean
  hasTransferIn: boolean
  drawdownPct: number | null
  lossUsd: number | null
}

export interface FetchBirdeyeHoldersResult {
  holders: BirdeyeHolderSnapshot[]
  apiCalls: number
  totalReported: number | null
}

export async function fetchBirdeyeTokenHolders(
  mint: string,
  options?: {
    maxHolders?: number
    tokenPrice?: number | null
    pageDelayMs?: number
  }
): Promise<FetchBirdeyeHoldersResult> {
  const apiKey = getApiKey()
  const maxHolders = options?.maxHolders ?? 500
  const pageDelayMs = options?.pageDelayMs ?? 0
  const holders: BirdeyeHolderSnapshot[] = []
  let offset = 0
  let apiCalls = 0
  let totalReported: number | null = null

  while (holders.length < maxHolders) {
    const response = await axios.get(`${BASE_URL}/defi/v3/token/holder`, {
      params: {
        address: mint,
        mode: 'wallet',
        offset,
        limit: 100,
        ui_amount_mode: 'scaled',
      },
      headers: {
        'X-API-KEY': apiKey,
        'x-chain': 'solana',
      },
      timeout: 25000,
      validateStatus: s => s === 200 || s === 429,
    })

    apiCalls++

    if (response.status === 429) {
      console.warn('[Birdeye] Rate limited on token/holder')
      break
    }

    if (response.status !== 200) {
      throw new Error(`Birdeye token/holder HTTP ${response.status}`)
    }

    const data = response.data?.data
    const items = (data?.items ?? []) as BirdeyeWalletHolderRow[]
    if (totalReported == null && typeof data?.holder === 'number') {
      totalReported = data.holder
    }

    if (items.length === 0) break

    for (const row of items) {
      const mapped = mapBirdeyeWalletHolderRow(row, options?.tokenPrice ?? null)
      if (!mapped.wallet) continue

      const hasTransferIn = !mapped.vwap && mapped.balance > 0
      holders.push({
        wallet: mapped.wallet,
        balance: mapped.balance,
        vwap: mapped.vwap,
        firstBuyTimestamp: mapped.firstBuyTimestamp,
        hasSold: mapped.hasSold,
        hasTransferIn,
        drawdownPct: mapped.drawdownPct,
        lossUsd: mapped.lossUsd,
      })
    }

    offset += items.length
    if (items.length < 100) break
    if (pageDelayMs > 0) {
      await new Promise(r => setTimeout(r, pageDelayMs))
    }
  }

  return {
    holders: holders.slice(0, maxHolders),
    apiCalls,
    totalReported,
  }
}
