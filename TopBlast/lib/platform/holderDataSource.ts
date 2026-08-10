import 'server-only'

import { isBirdeyeHolderSourceEnabled } from '@/lib/solana/birdeyeHolders'

/**
 * Single policy for holder + VWAP data sources.
 * Birdeye replaces Helius Enhanced pagination entirely — never run both.
 */

export function holderIndexingUsesBirdeye(): boolean {
  return isBirdeyeHolderSourceEnabled()
}

/** Per-wallet Helius Enhanced tx history — only without Birdeye. */
export function heliusEnhancedVwapEnabled(): boolean {
  return !holderIndexingUsesBirdeye()
}

function apiPollsAreReadOnly(): boolean {
  return process.env.WORKER_OWNS_INDEXING === 'true'
}

function allowManualHeliusRefreshOnPoll(): boolean {
  return process.env.ALLOW_MANUAL_HELIUS_REFRESH === 'true'
}

/**
 * Whether an HTTP poll/cron may trigger Helius DAS re-index or Enhanced VWAP hydration.
 * False when Birdeye is configured OR worker owns indexing (except manual ?refresh=1).
 */
export function shouldRunHeliusHolderIndexing(forceRefresh = false): boolean {
  if (holderIndexingUsesBirdeye()) return false
  if (apiPollsAreReadOnly()) {
    return forceRefresh && allowManualHeliusRefreshOnPoll()
  }
  return true
}
