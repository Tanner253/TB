/**
 * Payout Executor - timer, deployment reset, and payout execution.
 * Timer stays in "waiting" until the first eligible holder exists, then counts down uniformly via MongoDB.
 */

import connectDB from '@/lib/db'
import { Payout, Disqualification, TimerState } from '@/lib/db/models'
import { resetDeploymentState } from '@/lib/payout/resetDeployment'
import { transferSol, MIN_TRANSFER_SOL } from '@/lib/solana/transfer'
import { getLivePoolBalance } from '@/lib/payout/poolBalance'
import { isExcludedParticipantWallet } from '@/lib/eligibility/excludedWallets'
import { evaluateHolderEligibility } from '@/lib/eligibility/evaluateHolder'
import { getTokenPrice } from '@/lib/solana/price'
import { getTokenHolders } from '@/lib/solana/indexer'
import { config } from '@/lib/config'
import { PublicKey } from '@solana/web3.js'
import {
  persistWinnerAfterPayout,
  loadLastWinCycleByWallet,
} from '@/lib/payout/winnerPersistence'
import { saveRankingsToDb, loadRankingsFromDb, markWinnersCooldown, getServiceStatus, refreshPoolUsdCache } from '@/lib/tracker/holderService'

import { getTimerKey } from '@/lib/tenant/keys'
import { getTenantSlug } from '@/lib/tenant/context'
import { tenantFields } from '@/lib/tenant/scope'
import { isPayoutExecutionAuthorized, runAuthorizedPayout } from '@/lib/payout/payoutAuthContext'
import {
  assertProductionPayoutConfig,
  assertPayoutTransferAllowed,
  filterWinnersHoldingSessionToken,
  maxDistributableSol,
} from '@/lib/payout/payoutSecurity'
import type { PayableWinner } from '@/lib/payout/types'

export type { PayableWinner } from '@/lib/payout/types'

export type PayoutTimerStatus = 'waiting' | 'active'

export interface PayoutTimerInfo {
  timer_status: PayoutTimerStatus
  seconds_remaining: number | null
  current_cycle: number
  next_cycle: number
}

type TimerCacheState = {
  lastPayoutTime: number | null
  currentCycle: number
  timerStatus: PayoutTimerStatus
  tokenMint: string
  lastSync: number
}

declare global {
  // eslint-disable-next-line no-var
  var _payoutTimerCaches: Map<string, TimerCacheState> | undefined
}

function emptyTimerCache(tokenMint = ''): TimerCacheState {
  return {
    lastPayoutTime: null,
    currentCycle: 0,
    timerStatus: 'waiting',
    tokenMint,
    lastSync: 0,
  }
}

function getTimerCacheMap(): Map<string, TimerCacheState> {
  if (!global._payoutTimerCaches) {
    global._payoutTimerCaches = new Map()
  }
  return global._payoutTimerCaches
}

function getTimerCache(): TimerCacheState {
  const slug = getTenantSlug()
  const map = getTimerCacheMap()
  let state = map.get(slug)
  if (!state) {
    state = emptyTimerCache()
    map.set(slug, state)
  }
  return state
}

function getIntervalSeconds(): number {
  return config.payoutIntervalMinutes * 60
}

function normalizeMint(mint: string): string {
  return mint.trim()
}

function payoutTokenFields() {
  return {
    tokenMint: config.tokenMint?.trim() || null,
    tokenSymbol: config.tokenSymbol?.trim() || null,
  }
}

async function resetForNewToken(tokenMint: string): Promise<void> {
  console.log(`[Payout] New token detected (${tokenMint.slice(0, 10)}...) — resetting deployment state`)
  await resetDeploymentState()
  const cache = getTimerCache()
  cache.lastPayoutTime = null
  cache.currentCycle = 0
  cache.timerStatus = 'waiting'
  cache.tokenMint = tokenMint
  cache.lastSync = Date.now()
}

function applyTimerDoc(state: {
  tokenMint?: string
  timerStatus?: PayoutTimerStatus
  lastPayoutTime?: Date | null
  currentCycle?: number
}): void {
  const tokenMint = state.tokenMint || config.tokenMint
  const timerStatus: PayoutTimerStatus =
    state.timerStatus ||
    ((state.currentCycle || 0) > 0 ? 'active' : 'waiting')

  const cache = getTimerCache()
  cache.lastPayoutTime = state.lastPayoutTime ? new Date(state.lastPayoutTime).getTime() : null
  cache.currentCycle = state.currentCycle || 0
  cache.timerStatus = timerStatus
  cache.tokenMint = tokenMint
  cache.lastSync = Date.now()
}

async function loadTimerState(): Promise<void> {
  try {
    await connectDB()

    if (!config.tokenMint) {
      return
    }

    const expectedMint = normalizeMint(config.tokenMint)
    let state = await TimerState.findOne({ key: getTimerKey() }).lean()

    const storedMint = normalizeMint(state?.tokenMint || '')

    if (state && storedMint !== expectedMint) {
      await resetForNewToken(config.tokenMint)
      return
    }

    if (!state) {
      await TimerState.create({
        key: getTimerKey(),
        tokenMint: config.tokenMint,
        timerStatus: 'waiting',
        lastPayoutTime: null,
        currentCycle: 0,
        failedAttempts: 0,
        isPayoutInProgress: false,
      })
      applyTimerDoc({
        tokenMint: config.tokenMint,
        timerStatus: 'waiting',
        lastPayoutTime: null,
        currentCycle: 0,
      })
      console.log('[Payout] Timer initialized in waiting state (starts when first holder is eligible)')
      return
    }

    applyTimerDoc(state)
  } catch (error) {
    console.error('[Payout] Failed to load timer state:', error)
  }
}

async function saveTimerState(
  lastPayoutTime: number | null,
  currentCycle: number,
  timerStatus: PayoutTimerStatus = getTimerCache().timerStatus
): Promise<void> {
  try {
    await TimerState.findOneAndUpdate(
      { key: getTimerKey() },
      {
        $set: {
          tokenMint: config.tokenMint,
          timerStatus,
          lastPayoutTime: lastPayoutTime ? new Date(lastPayoutTime) : null,
          currentCycle,
          failedAttempts: 0,
          isPayoutInProgress: false,
        },
      },
      { upsert: true }
    )
    const cache = getTimerCache()
    cache.lastPayoutTime = lastPayoutTime
    cache.currentCycle = currentCycle
    cache.timerStatus = timerStatus
    cache.tokenMint = config.tokenMint
    cache.lastSync = Date.now()
  } catch (error) {
    console.error('[Payout] Failed to save timer state:', error)
  }
}

async function getAccruedDevFeeEth(): Promise<number> {
  try {
    const doc = await TimerState.findOne({ key: getTimerKey() }).select('accruedDevFeeEth').lean()
    return doc?.accruedDevFeeEth ?? 0
  } catch {
    return 0
  }
}

async function setAccruedDevFeeEth(amount: number): Promise<void> {
  try {
    await TimerState.findOneAndUpdate(
      { key: getTimerKey() },
      { $set: { accruedDevFeeEth: Math.max(0, amount) } },
      { upsert: true }
    )
  } catch (error) {
    console.error('[Payout] Failed to update accrued dev fee:', error)
  }
}

export function getSecondsUntilNextPayout(): number | null {
  const cache = getTimerCache()
  if (cache.timerStatus !== 'active') {
    return null
  }
  if (!cache.lastPayoutTime) {
    return getIntervalSeconds()
  }
  const intervalMs = config.payoutIntervalMinutes * 60 * 1000
  const elapsed = Date.now() - cache.lastPayoutTime
  return Math.max(0, Math.floor((intervalMs - elapsed) / 1000))
}

export function getCurrentPayoutCycle(): number {
  return getTimerCache().currentCycle
}

export function getPayoutTimerStatus(): PayoutTimerStatus {
  return getTimerCache().timerStatus
}

export function getPayoutTimerInfo(): PayoutTimerInfo {
  return {
    timer_status: getTimerCache().timerStatus,
    seconds_remaining: getSecondsUntilNextPayout(),
    current_cycle: getTimerCache().currentCycle,
    next_cycle: getTimerCache().currentCycle + 1,
  }
}

export async function ensureTimerStateSync(): Promise<void> {
  if (Date.now() - getTimerCache().lastSync < 5000 && getTimerCache().lastSync > 0) {
    return
  }
  await loadTimerState()
}

/** Start the payout countdown once at least one holder is eligible. */
export async function maybeStartPayoutTimer(eligibleCount: number): Promise<boolean> {
  await ensureTimerStateSync()

  if (getTimerCache().timerStatus === 'active') {
    return false
  }
  if (eligibleCount <= 0) {
    return false
  }

  const now = Date.now()
  await saveTimerState(now, getTimerCache().currentCycle, 'active')
  console.log(`[Payout] Timer started — ${eligibleCount} eligible holder(s)`)
  return true
}

/** Pause timer when stuck at 0 with nobody eligible (e.g. after DB wipe). */
export async function pausePayoutTimerToWaiting(): Promise<void> {
  await saveTimerState(null, getTimerCache().currentCycle, 'waiting')
  console.log('[Payout] Timer paused — waiting for eligible holders')
}

export async function resetTimerForNextInterval(): Promise<void> {
  const now = Date.now()
  await saveTimerState(now, getTimerCache().currentCycle, 'active')
  console.log(`[Payout] Timer reset for next interval (${config.payoutIntervalMinutes} min)`)
}

export function isPayoutDue(): boolean {
  if (getTimerCache().timerStatus !== 'active') {
    return false
  }
  const secondsUntil = getSecondsUntilNextPayout()
  return secondsUntil !== null && secondsUntil <= 0
}

/** Live eligibility for payout — do not trust stale Mongo isEligible flags. */
export async function resolveLivePayableWinners(limit = 3): Promise<PayableWinner[]> {
  const dbRankings = await loadRankingsFromDb()
  if (!dbRankings?.rankings?.length || !config.tokenMint) {
    return []
  }

  const [tokenPrice, livePool] = await Promise.all([
    getTokenPrice(config.tokenMint),
    getLivePoolBalance(),
  ])
  if (!tokenPrice || tokenPrice <= 0) {
    return []
  }

  const contractWallets = new Set(
    (await getTokenHolders(config.tokenMint, 100))
      .filter(h => h.isContract)
      .map(h => h.wallet)
  )

  const currentCycle = getCurrentPayoutCycle()

  const lastWinByWallet = await loadLastWinCycleByWallet(
    dbRankings.rankings.map(h => h.wallet)
  )

  return dbRankings.rankings
    .filter(
      h =>
        !h.isContract &&
        !contractWallets.has(h.wallet) &&
        !isExcludedParticipantWallet(h.wallet)
    )
    .map(h => {
      const firstBuyMs = h.firstBuyAt ? new Date(h.firstBuyAt).getTime() : null
      const lastWinCycle =
        lastWinByWallet.get(h.wallet) ?? h.lastWinCycle ?? null
      const live = evaluateHolderEligibility({
        wallet: h.wallet,
        balance: h.balance,
        vwap: h.vwap || null,
        tokenPrice,
        firstBuyTimestamp: firstBuyMs,
        hasSold: h.hasSold ?? false,
        hasTransferredOut: h.hasTransferredOut ?? false,
        lastWinCycle,
        totalTokensBought: h.totalTokensBought ?? 0,
        poolUsd: livePool.poolUsd,
        currentCycle,
      })
      return {
        wallet: h.wallet,
        drawdownPct: live.drawdownPct,
        lossUsd: live.lossUsd,
        isEligible: live.isEligible,
      }
    })
    .filter(h => h.isEligible)
    .sort((a, b) => {
      if (a.drawdownPct !== b.drawdownPct) return a.drawdownPct - b.drawdownPct
      return b.lossUsd - a.lossUsd
    })
    .slice(0, limit)
    .map(({ wallet, drawdownPct, lossUsd }) => ({ wallet, drawdownPct, lossUsd }))
}

async function acquirePayoutLock(cycle: number): Promise<boolean> {
  try {
    const result = await TimerState.findOneAndUpdate(
      {
        key: getTimerKey(),
        $or: [
          { isPayoutInProgress: false },
          { isPayoutInProgress: { $exists: false } },
          { lockAcquiredAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) } },
        ],
      },
      {
        $set: {
          isPayoutInProgress: true,
          lockAcquiredAt: new Date(),
          lockCycle: cycle,
        },
      },
      { new: true }
    )

    return result !== null
  } catch (error) {
    console.error('[Payout] Failed to acquire lock:', error)
    return false
  }
}

async function releasePayoutLock(): Promise<void> {
  try {
    await TimerState.findOneAndUpdate(
      { key: getTimerKey() },
      { $set: { isPayoutInProgress: false, lockAcquiredAt: null } }
    )
  } catch (error) {
    console.error('[Payout] Failed to release lock:', error)
  }
}

export interface PayoutResult {
  success: boolean
  cycle?: number
  error?: string
  data?: any
}

/** Pause timer when a due cycle has nobody to pay — avoids empty/failed payout history. */
async function pausePayoutForNoWinners(reason: string): Promise<PayoutResult> {
  console.log(`[Payout] ${reason} — pausing timer until someone qualifies`)
  await releasePayoutLock()
  await pausePayoutTimerToWaiting()
  return { success: true, data: { skipped: true, reason: 'No eligible winners' } }
}

/** Drop aborted cycle records so history is not filled with failed attempts. */
async function cleanupAbortedCycleRecords(cycle: number): Promise<void> {
  try {
    await Payout.deleteMany({ ...tenantFields(), cycle })
  } catch (error) {
    console.error('[Payout] Failed to cleanup aborted cycle records:', error)
  }
}

export async function executePayout(): Promise<PayoutResult> {
  if (!isPayoutExecutionAuthorized()) {
    console.error('[Payout] Blocked — not running inside authorized server context')
    return { success: false, error: 'Payout execution not authorized' }
  }

  const configError = assertProductionPayoutConfig()
  if (configError) {
    console.error(`[Payout] Blocked — ${configError}`)
    return { success: false, error: configError }
  }

  await ensureTimerStateSync()

  if (getTimerCache().timerStatus !== 'active') {
    return { success: false, error: 'Payout timer not started' }
  }

  const now = Date.now()
  const nextCycle = getTimerCache().currentCycle + 1

  try {
    await connectDB()

    const lockAcquired = await acquirePayoutLock(nextCycle)
    if (!lockAcquired) {
      console.log('[Payout] Payout already in progress — skipping duplicate request')
      return { success: false, error: 'Payout already in progress' }
    }

    console.log('')
    console.log('[Payout] ╔════════════════════════════════════════════════════════╗')
    console.log(`[Payout] ║           STARTING PAYOUT CYCLE ${nextCycle}                      ║`)
    console.log('[Payout] ╚════════════════════════════════════════════════════════╝')

    const livePool = await getLivePoolBalance()
    await refreshPoolUsdCache(livePool.poolUsd)
    const solPrice = livePool.solPrice
    const poolSol = livePool.poolSol
    const poolUsd = livePool.poolUsd

    console.log(`[Payout] Payout wallet: ${livePool.payoutWalletAddress || 'NOT CONFIGURED'}`)
    console.log(`[Payout] Wallet balance: ${livePool.walletSol.toFixed(6)} SOL`)
    console.log(`[Payout] Pool: ${poolSol.toFixed(6)} SOL ($${poolUsd.toFixed(2)})`)

    if (!livePool.available || livePool.walletSol <= 0) {
      console.log('[Payout] No balance — skipping and resetting timer')
      await releasePayoutLock()
      await resetTimerForNextInterval()
      return { success: false, error: 'No wallet balance' }
    }

    if (poolSol < config.minPoolSol) {
      console.log(
        `[Payout] Pool ${poolSol.toFixed(6)} SOL below minimum ${config.minPoolSol} SOL — skipping and resetting timer`
      )
      await releasePayoutLock()
      await resetTimerForNextInterval()
      return { success: false, error: 'Pool below minimum' }
    }

    const distributableCap = maxDistributableSol(livePool.walletSol)
    if (distributableCap < MIN_TRANSFER_SOL) {
      console.log(
        `[Payout] Distributable ${distributableCap.toFixed(6)} SOL below minimum after wallet reserve — skipping`
      )
      await releasePayoutLock()
      await resetTimerForNextInterval()
      return { success: false, error: 'Insufficient balance after reserve' }
    }

    let eligibleWinners: PayableWinner[] = await resolveLivePayableWinners(3)
    eligibleWinners = await filterWinnersHoldingSessionToken(eligibleWinners)

    console.log(`[Payout] Live eligible winners (on-chain verified): ${eligibleWinners.length}`)

    if (eligibleWinners.length === 0) {
      return pausePayoutForNoWinners('No eligible winners')
    }

    console.log('[Payout] Winners to pay:')
    eligibleWinners.forEach((w: any, i: number) => {
      console.log(`[Payout]   #${i + 1}: ${w.wallet.slice(0, 8)}... (${w.drawdownPct.toFixed(1)}% loss, $${w.lossUsd.toFixed(2)})`)
    })

    const devFeeSol = poolSol * config.devFeePct
    const winnersPoolSol = poolSol - devFeeSol
    const payoutAmounts = [
      winnersPoolSol * config.payoutSplit.first,
      winnersPoolSol * config.payoutSplit.second,
      winnersPoolSol * config.payoutSplit.third,
    ]

    const accruedDevFee = await getAccruedDevFeeEth()
    const devWalletValid = (() => {
      if (!config.devWalletAddress) return false
      try {
        // eslint-disable-next-line no-new
        new PublicKey(config.devWalletAddress)
        return true
      } catch {
        return false
      }
    })()
    const totalDevFeeSol = devFeeSol + accruedDevFee

    const results: any[] = []
    let totalPaidSol = 0

    console.log('[Payout] Creating pending winner payout records...')

    const winnerPending: { id: any; rank: number; wallet: string; amountSol: number }[] = []

    for (let i = 0; i < eligibleWinners.length; i++) {
      const winner = eligibleWinners[i]
      const amountSol = payoutAmounts[i]

      if (amountSol < MIN_TRANSFER_SOL) continue

      const winnerPayout = await Payout.create({
        ...tenantFields(),
        ...payoutTokenFields(),
        cycle: nextCycle,
        rank: i + 1,
        wallet: winner.wallet,
        amount: amountSol * solPrice,
        amountTokens: amountSol,
        drawdownPct: winner.drawdownPct,
        lossUsd: winner.lossUsd,
        txHash: null,
        status: 'pending',
        errorMessage: null,
      })
      winnerPending.push({ id: winnerPayout._id, rank: i + 1, wallet: winner.wallet, amountSol })
    }

    if (winnerPending.length === 0) {
      return pausePayoutForNoWinners('No winner payouts meet minimum transfer size')
    }

    console.log(`[Payout] Created ${winnerPending.length} pending winner records`)

    for (const pending of winnerPending) {
      const label = `#${pending.rank}`
      const currentLive = await getLivePoolBalance()
      const availableSol = currentLive.walletSol

      const transferCheck = await assertPayoutTransferAllowed({
        rank: pending.rank,
        recipient: pending.wallet,
        amountSol: pending.amountSol,
        walletSol: availableSol,
        allowedWinners: eligibleWinners,
        expectedWinnerAmounts: payoutAmounts,
      })

      if (!transferCheck.ok) {
        console.error(`[Payout] ${label} BLOCKED: ${transferCheck.reason}`)
        await Payout.findByIdAndUpdate(pending.id, {
          status: 'failed',
          errorMessage: transferCheck.reason,
        })
        results.push({
          rank: pending.rank,
          type: 'winner',
          wallet: pending.wallet,
          amount_eth: pending.amountSol.toFixed(6),
          status: 'failed',
          tx_hash: null,
          error: transferCheck.reason,
        })
        continue
      }

      const requiredSol = pending.amountSol + 0.001

      if (availableSol < requiredSol) {
        console.log(`[Payout] ${label}: Insufficient balance — skipping`)
        await Payout.findByIdAndUpdate(pending.id, {
          status: 'skipped',
          errorMessage: `Insufficient balance: ${availableSol.toFixed(6)} SOL < ${requiredSol.toFixed(6)} SOL needed`,
        })
        continue
      }

      console.log(`[Payout] ${label}: Sending ${pending.amountSol.toFixed(6)} SOL to ${pending.wallet.slice(0, 10)}...`)

      const txResult = config.executePayouts
        ? await transferSol(pending.wallet, pending.amountSol)
        : { success: false, txHash: null, error: 'EXECUTE_PAYOUTS disabled' }

      console.log(`[Payout] ${label} result: ${txResult.success ? '✅' : '❌'} ${txResult.txHash || txResult.error}`)

      await Payout.findByIdAndUpdate(pending.id, {
        txHash: txResult.txHash,
        status: txResult.success ? 'success' : 'failed',
        errorMessage: txResult.error,
      })

      if (txResult.success) {
        totalPaidSol += pending.amountSol

        await Disqualification.create({
          wallet: pending.wallet,
          reason: 'winner_cooldown',
          expiresAt: new Date(Date.now() + config.payoutIntervalMinutes * 60 * 1000 * 2),
        }).catch(() => {})

        const tokenPrice = (await getTokenPrice(config.tokenMint)) ?? solPrice
        await persistWinnerAfterPayout(pending.wallet, nextCycle, tokenPrice)
      }

      results.push({
        rank: pending.rank,
        type: 'winner',
        wallet: pending.wallet,
        amount_eth: pending.amountSol.toFixed(6),
        status: txResult.success ? 'success' : 'failed',
        tx_hash: txResult.txHash,
        error: txResult.error,
      })
    }

    const successfulWinnerWallets = results
      .filter(r => r.type === 'winner' && r.status === 'success')
      .map(r => r.wallet)

    if (successfulWinnerWallets.length === 0) {
      await cleanupAbortedCycleRecords(nextCycle)
      return pausePayoutForNoWinners('No successful winner payouts this cycle')
    }

    // Dev fee only runs after at least one winner is paid — avoids dev-only partial cycles.
    if (devWalletValid && config.executePayouts && totalDevFeeSol >= MIN_TRANSFER_SOL) {
      const devPayout = await Payout.create({
        ...tenantFields(),
        ...payoutTokenFields(),
        cycle: nextCycle,
        rank: 0,
        wallet: config.devWalletAddress,
        amount: totalDevFeeSol * solPrice,
        amountTokens: totalDevFeeSol,
        drawdownPct: 0,
        lossUsd: 0,
        txHash: null,
        status: 'pending',
        errorMessage: null,
      })

      const currentLive = await getLivePoolBalance()
      const availableSol = currentLive.walletSol
      const transferCheck = await assertPayoutTransferAllowed({
        rank: 0,
        recipient: config.devWalletAddress,
        amountSol: totalDevFeeSol,
        walletSol: availableSol,
        allowedWinners: eligibleWinners,
        expectedWinnerAmounts: payoutAmounts,
      })

      if (transferCheck.ok && availableSol >= totalDevFeeSol + 0.001) {
        console.log(`[Payout] Dev fee: Sending ${totalDevFeeSol.toFixed(6)} SOL to ${config.devWalletAddress.slice(0, 10)}...`)
        const txResult = config.executePayouts
          ? await transferSol(config.devWalletAddress, totalDevFeeSol)
          : { success: false, txHash: null, error: 'EXECUTE_PAYOUTS disabled' }

        await Payout.findByIdAndUpdate(devPayout._id, {
          txHash: txResult.txHash,
          status: txResult.success ? 'success' : 'failed',
          errorMessage: txResult.error,
        })

        if (txResult.success) {
          totalPaidSol += totalDevFeeSol
          await setAccruedDevFeeEth(0)
        }

        results.unshift({
          rank: 0,
          type: 'dev_fee',
          wallet: config.devWalletAddress,
          amount_eth: totalDevFeeSol.toFixed(6),
          status: txResult.success ? 'success' : 'failed',
          tx_hash: txResult.txHash,
          error: txResult.error,
        })
      } else {
        const reason = transferCheck.ok
          ? `Insufficient balance: ${availableSol.toFixed(6)} SOL`
          : transferCheck.reason
        console.warn(`[Payout] Dev fee skipped: ${reason}`)
        await Payout.findByIdAndUpdate(devPayout._id, {
          status: 'failed',
          errorMessage: reason,
        })
        const newAccrued = accruedDevFee + devFeeSol
        await setAccruedDevFeeEth(newAccrued)
      }
    } else if (devWalletValid && devFeeSol > 0) {
      const newAccrued = accruedDevFee + devFeeSol
      await setAccruedDevFeeEth(newAccrued)
      console.log(
        `[Payout] Dev fee ${devFeeSol.toFixed(6)} SOL below min transfer — accrued total ${newAccrued.toFixed(6)} SOL`
      )
    } else if (devFeeSol > 0 && !devWalletValid) {
      console.warn('[Payout] DEV_WALLET_ADDRESS missing or invalid — dev fee stays in pool wallet')
    }

    await saveTimerState(now, nextCycle, 'active')

    markWinnersCooldown(successfulWinnerWallets, nextCycle)
    console.log(`[Payout] Updated ${successfulWinnerWallets.length} winners with cooldown in memory`)

    if (getServiceStatus().holderCount > 0) {
      await saveRankingsToDb()
    }

    console.log('')
    console.log('[Payout] ╔════════════════════════════════════════════════════════╗')
    console.log(`[Payout] ║  ✅ CYCLE ${nextCycle} COMPLETE - ${totalPaidSol.toFixed(6)} SOL PAID              ║`)
    console.log('[Payout] ╚════════════════════════════════════════════════════════╝')

    await releasePayoutLock()

    return {
      success: true,
      cycle: nextCycle,
      data: {
        cycle: nextCycle,
        total_paid_eth: totalPaidSol.toFixed(6),
        total_paid_usd: (totalPaidSol * solPrice).toFixed(2),
        payouts: results,
      },
    }
  } catch (error: any) {
    console.error('[Payout] ERROR:', error)
    await releasePayoutLock()
    return { success: false, error: error.message }
  }
}

export function canExecutePayout(): boolean {
  return isPayoutDue()
}

/**
 * Run payout when the timer hits zero — called from leaderboard polls (no external cron).
 * Mongo payout lock prevents duplicate sends across concurrent requests.
 */
export async function maybeExecuteDuePayout(eligibleCount: number): Promise<PayoutResult | null> {
  await ensureTimerStateSync()
  const timer = getPayoutTimerInfo()

  if (timer.timer_status !== 'active' || !isPayoutDue()) {
    return null
  }

  if (eligibleCount <= 0) {
    await pausePayoutTimerToWaiting()
    return { success: true, data: { skipped: true, reason: 'No eligible winners' } }
  }

  if (!config.executePayouts) {
    console.log('[Payout] Timer due but EXECUTE_PAYOUTS is false — skipping on-chain transfer')
    return null
  }

  const configError = assertProductionPayoutConfig()
  if (configError) {
    console.error(`[Payout] Blocked — ${configError}`)
    return { success: false, error: configError }
  }

  return runAuthorizedPayout(() => executePayout())
}
