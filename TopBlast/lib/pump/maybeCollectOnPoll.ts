import 'server-only'

import { config } from '@/lib/config'
import { getPayoutPrivateKey, getTenantSlug } from '@/lib/tenant/context'
import { getPayoutWalletAddressFromKey } from '@/lib/solana/transfer'
import { runAuthorizedPayout } from '@/lib/payout/payoutAuthContext'
import { isPumpAutoCollectEnabled } from '@/lib/pump/config'
import {
  markPumpCollectAttempt,
  shouldThrottlePumpCollect,
} from '@/lib/pump/collectThrottle'
import {
  collectPumpCreatorFeesIfDue,
  type PumpCollectResult,
} from '@/lib/pump/collectCreatorFees'

/**
 * Collect Pump creator fees for the active tenant context (leaderboard or catalog sweep).
 */
export async function collectPumpCreatorFeesForActiveTenant(): Promise<PumpCollectResult | null> {
  if (!isPumpAutoCollectEnabled()) {
    return null
  }

  const mint = config.tokenMint?.trim()
  const privateKey = getPayoutPrivateKey()?.trim()
  const payoutWallet = getPayoutWalletAddressFromKey()

  if (!mint || !privateKey || !payoutWallet) {
    return null
  }

  const tenantKey = getTenantSlug()
  if (shouldThrottlePumpCollect(tenantKey)) {
    return null
  }

  markPumpCollectAttempt(tenantKey)

  try {
    const result = await collectPumpCreatorFeesIfDue({
      mint,
      creatorWallet: payoutWallet,
      privateKey,
    })

    if (result.status === 'collected') {
      console.log(
        `[PumpCollect] Tenant ${tenantKey}: topped up payout wallet with creator fees (~$${result.collectedUsd.toFixed(2)})`
      )
    } else if (result.status === 'error') {
      console.warn(`[PumpCollect] Tenant ${tenantKey}: ${result.error}`)
    }

    return result
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[PumpCollect] Tenant ${tenantKey}: ${message}`)
    return { status: 'error', error: message }
  }
}

/**
 * Leaderboard-driven Pump creator fee collection (no cron).
 * Runs at most once per tenant per throttle window when polls hit /api/leaderboard.
 */
export async function maybeCollectPumpCreatorFeesOnPoll(): Promise<PumpCollectResult | null> {
  return runAuthorizedPayout(() => collectPumpCreatorFeesForActiveTenant())
}
