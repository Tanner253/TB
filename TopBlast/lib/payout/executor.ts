/**
 * Payout Executor - timer, deployment reset, and payout execution.
 * Timer stays in "waiting" until the first eligible holder exists, then counts down uniformly via MongoDB.
 */

import connectDB from '@/lib/db'
import { Payout, Disqualification, TimerState, PayoutVolumeSwap } from '@/lib/db/models'
import { resetDeploymentState } from '@/lib/payout/resetDeployment'
import { transferSol, MIN_TRANSFER_SOL } from '@/lib/solana/transfer'
import { swapSolForToken, isNativeTokenPayoutEnabled } from '@/lib/solana/jupiterSwap'
import {
  transferSessionToken,
  getPayoutWalletTokenBalance,
  allocateTokenAmountsBySolShare,
  resolveSwapDeliveredTokens,
  minHumanTokenTransfer,
} from '@/lib/solana/tokenTransfer'
import { getLivePoolBalance } from '@/lib/payout/poolBalance'
import { isExcludedParticipantWallet } from '@/lib/eligibility/excludedWallets'
import { isLiquidityPoolWallet, ensureLiquidityPoolAddresses } from '@/lib/eligibility/liquidityPools'
import { mergeLiveHolderBalances } from '@/lib/leaderboard/mergeLiveHolderBalances'
import { workerOwnsIndexing } from '@/lib/platform/workerMode'
import { getStaleTokenHolders } from '@/lib/solana/heliusCache'
import { evaluateHolderEligibility } from '@/lib/eligibility/evaluateHolder'
import { getTokenPrice } from '@/lib/solana/price'
import { isPoolFundedForPayout, minPoolForPayoutLabel } from '@/lib/payout/poolMinimum'
import { getTokenHolders } from '@/lib/solana/indexer'
import { normalizeTokenBalance } from '@/lib/solana/tokenAmount'
import { config } from '@/lib/config'
import { getWinnerShareFractions } from '@/lib/payout/winnerShares'
import { PublicKey } from '@solana/web3.js'
import {
  persistWinnerAfterPayout,
  loadLastWinCycleByWallet,
} from '@/lib/payout/winnerPersistence'
import { saveRankingsToDb, loadRankingsFromDb, markWinnersCooldown, getServiceStatus, refreshPoolUsdCache } from '@/lib/tracker/holderService'
import { recordPayoutVolumeSwap } from '@/lib/payout/volumeSwap'
import {
  getEffectivePayoutIntervalMinutes,
} from '@/lib/payout/payoutRetry'

import { getTimerKey } from '@/lib/tenant/keys'
import { getTenantSlug } from '@/lib/tenant/context'
import { tenantFields } from '@/lib/tenant/scope'
import { isPayoutExecutionAuthorized, runAuthorizedPayout } from '@/lib/payout/payoutAuthContext'
import {
  assertProductionPayoutConfig,
  assertPayoutTransferAllowed,
  assertPayoutTokenTransferAllowed,
  filterWinnersHoldingSessionToken,
  maxDistributableSol,
} from '@/lib/payout/payoutSecurity'
import type { PayableWinner } from '@/lib/payout/types'
import { computePayoutSecondsRemaining } from '@/lib/payout/timerMath'

export type { PayableWinner } from '@/lib/payout/types'

export type PayoutTimerStatus = 'waiting' | 'active'

export interface PayoutTimerInfo {
  timer_status: PayoutTimerStatus
  seconds_remaining: number | null
  current_cycle: number
  next_cycle: number
  last_payout_error: string | null
  last_payout_error_at: string | null
  payout_retry_mode: boolean
  failed_attempts: number
}

type TimerCacheState = {
  lastPayoutTime: number | null
  currentCycle: number
  timerStatus: PayoutTimerStatus
  tokenMint: string
  lastSync: number
  failedAttempts: number
  lastPayoutError: string | null
  lastPayoutErrorAt: number | null
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
    failedAttempts: 0,
    lastPayoutError: null,
    lastPayoutErrorAt: null,
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
  cache.failedAttempts = 0
  cache.lastPayoutError = null
  cache.lastPayoutErrorAt = null
  cache.tokenMint = tokenMint
  cache.lastSync = Date.now()
}

function applyTimerDoc(state: {
  tokenMint?: string
  timerStatus?: PayoutTimerStatus
  lastPayoutTime?: Date | null
  currentCycle?: number
  failedAttempts?: number
  lastPayoutError?: string | null
  lastPayoutErrorAt?: Date | null
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
  cache.failedAttempts = state.failedAttempts ?? 0
  cache.lastPayoutError = state.lastPayoutError ?? null
  cache.lastPayoutErrorAt = state.lastPayoutErrorAt
    ? new Date(state.lastPayoutErrorAt).getTime()
    : null
  cache.lastSync = Date.now()
  syncHolderServiceCycle(cache.currentCycle)
}

function syncHolderServiceCycle(cycle: number): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { setCurrentCycle } = require('@/lib/tracker/holderService') as typeof import('@/lib/tracker/holderService')
    setCurrentCycle(cycle)
  } catch {
    // holderService may be unavailable in isolated tests
  }
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
  timerStatus: PayoutTimerStatus = getTimerCache().timerStatus,
  options?: {
    failedAttempts?: number
    lastPayoutError?: string | null
    lastPayoutErrorAt?: number | null
    clearPayoutError?: boolean
  }
): Promise<void> {
  const cache = getTimerCache()
  const failedAttempts =
    options?.failedAttempts ??
    (options?.clearPayoutError ? 0 : cache.failedAttempts)
  const lastPayoutError = options?.clearPayoutError
    ? null
    : options?.lastPayoutError !== undefined
      ? options.lastPayoutError
      : cache.lastPayoutError
  const lastPayoutErrorAt = options?.clearPayoutError
    ? null
    : options?.lastPayoutErrorAt !== undefined
      ? options.lastPayoutErrorAt
      : cache.lastPayoutErrorAt

  try {
    await TimerState.findOneAndUpdate(
      { key: getTimerKey() },
      {
        $set: {
          tokenMint: config.tokenMint,
          timerStatus,
          lastPayoutTime: lastPayoutTime ? new Date(lastPayoutTime) : null,
          currentCycle,
          failedAttempts,
          lastPayoutError,
          lastPayoutErrorAt: lastPayoutErrorAt ? new Date(lastPayoutErrorAt) : null,
          isPayoutInProgress: false,
        },
      },
      { upsert: true }
    )
    cache.lastPayoutTime = lastPayoutTime
    cache.currentCycle = currentCycle
    cache.timerStatus = timerStatus
    cache.tokenMint = config.tokenMint
    cache.failedAttempts = failedAttempts
    cache.lastPayoutError = lastPayoutError
    cache.lastPayoutErrorAt = lastPayoutErrorAt
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
  const intervalMinutes = getEffectivePayoutIntervalMinutes(
    config.payoutIntervalMinutes,
    cache.failedAttempts
  )
  return computePayoutSecondsRemaining({
    timerStatus: cache.timerStatus,
    lastPayoutTime:
      cache.lastPayoutTime != null ? new Date(cache.lastPayoutTime) : null,
    payoutIntervalMinutes: intervalMinutes,
  })
}

export function getCurrentPayoutCycle(): number {
  return getTimerCache().currentCycle
}

export function getPayoutTimerStatus(): PayoutTimerStatus {
  return getTimerCache().timerStatus
}

export function getPayoutTimerInfo(): PayoutTimerInfo {
  const cache = getTimerCache()
  const retryMode = cache.failedAttempts > 0 && Boolean(cache.lastPayoutError)
  return {
    timer_status: cache.timerStatus,
    seconds_remaining: getSecondsUntilNextPayout(),
    current_cycle: cache.currentCycle,
    next_cycle: cache.currentCycle + 1,
    last_payout_error: cache.lastPayoutError,
    last_payout_error_at: cache.lastPayoutErrorAt
      ? new Date(cache.lastPayoutErrorAt).toISOString()
      : null,
    payout_retry_mode: retryMode,
    failed_attempts: cache.failedAttempts,
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

  if (isPayoutDue()) {
    return false
  }
  if (getTimerCache().timerStatus === 'active') {
    return false
  }
  if (eligibleCount <= 0) {
    return false
  }

  const livePool = await getLivePoolBalance()
  if (!isPoolFundedForPayout(livePool)) {
    console.log(
      `[Payout] Pool ~${livePool.poolUsdFormatted} below minimum ${minPoolForPayoutLabel()} — timer not started`
    )
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

/**
 * Stop an active countdown when nobody qualifies — avoids a ticking timer with no possible payout.
 * Restart happens via maybeStartPayoutTimer when eligibility returns.
 */
export async function syncPayoutTimerWithEligibility(eligibleCount: number): Promise<void> {
  await ensureTimerStateSync()
  if (getTimerCache().timerStatus === 'active' && eligibleCount <= 0) {
    if (isPayoutDue()) {
      console.warn(
        '[Payout] Timer at 00:00 with stale zero eligible count — holding due state until payout runs'
      )
      return
    }
    await pausePayoutTimerToWaiting()
  }
}

async function syncPayoutTimerWithPoolMinimum(): Promise<void> {
  await ensureTimerStateSync()
  if (getTimerCache().timerStatus !== 'active') return
  /** Never pause or restart while a cycle is due — payout path decides wait vs fail. */
  if (isPayoutDue()) return

  const livePool = await getLivePoolBalance()
  if (!isPoolFundedForPayout(livePool)) {
    console.log(
      `[Payout] Pool ~${livePool.poolUsdFormatted} below minimum ${minPoolForPayoutLabel()} — pausing timer until topped up`
    )
    await pausePayoutTimerToWaiting()
  }
}

/** Live eligible winners that still hold the session token on-chain (same bar as payout). */
export async function countVerifiedPayableWinners(limit?: number): Promise<number> {
  const winnerLimit = limit ?? config.winnerCount
  const winners = await resolveLivePayableWinners(winnerLimit)
  if (winners.length === 0) return 0
  const verified = await filterWinnersHoldingSessionToken(winners)
  return verified.length
}

export interface SyncPayoutTimerResult {
  /** Verified on-chain winners — use for payout execution. */
  verifiedPayableCount: number
  /** Count used to start/pause the countdown (matches live leaderboard eligibility). */
  timerEligibleCount: number
}

/**
 * Start or pause the payout timer from live eligibility.
 * When `knownEligibleCount` is supplied (leaderboard / holder indexer), the timer uses
 * that hydrated count so the UI countdown matches displayed winners. Payout execution
 * still relies on verified on-chain winners.
 */
export async function syncPayoutTimerWithPayableWinners(
  knownEligibleCount?: number
): Promise<SyncPayoutTimerResult> {
  await ensureTimerStateSync()
  const verifiedPayableCount = await countVerifiedPayableWinners()
  const timerEligibleCount = Math.max(knownEligibleCount ?? 0, verifiedPayableCount)

  /** Payout is due — do not pause, restart, or mutate timer; only executePayout may advance cycle. */
  if (isPayoutDue()) {
    return { verifiedPayableCount, timerEligibleCount }
  }

  await syncPayoutTimerWithPoolMinimum()
  await maybeStartPayoutTimer(timerEligibleCount)
  await syncPayoutTimerWithEligibility(timerEligibleCount)
  await syncPayoutTimerWithPoolMinimum()
  return { verifiedPayableCount, timerEligibleCount }
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
export async function resolveLivePayableWinners(limit?: number): Promise<PayableWinner[]> {
  const winnerLimit = limit ?? config.winnerCount
  const dbRankings = await loadRankingsFromDb()
  if (!dbRankings?.rankings?.length || !config.tokenMint) {
    return []
  }

  const [liveTokenPrice, livePool] = await Promise.all([
    getTokenPrice(config.tokenMint),
    getLivePoolBalance(),
  ])
  const tokenPrice =
    (liveTokenPrice && liveTokenPrice > 0 ? liveTokenPrice : null) ??
    dbRankings.tokenPrice ??
    0
  if (!tokenPrice || tokenPrice <= 0) {
    return []
  }

  await ensureLiquidityPoolAddresses(config.tokenMint)

  const rankingByWallet = new Map(
    dbRankings.rankings.map(h => [h.wallet, { ...h }] as const)
  )
  const liveHolders: Array<{ wallet: string; balance: number; isContract: boolean }> =
    workerOwnsIndexing()
      ? (getStaleTokenHolders(config.tokenMint) ?? []).map(h => ({
          wallet: h.wallet,
          balance: h.balance,
          isContract: isLiquidityPoolWallet(h.wallet, config.tokenMint),
        }))
      : await getTokenHolders(config.tokenMint, Math.min(config.maxHoldersToProcess, 1000))
  if (liveHolders.length > 0) {
    mergeLiveHolderBalances(rankingByWallet, liveHolders, config.tokenMint)
  }

  const contractWallets = new Set(
    liveHolders.filter(h => h.isContract).map(h => h.wallet)
  )

  const currentCycle = getCurrentPayoutCycle()

  const lastWinByWallet = await loadLastWinCycleByWallet(
    Array.from(rankingByWallet.keys())
  )

  return Array.from(rankingByWallet.values())
    .filter(
      h =>
        !h.isContract &&
        !contractWallets.has(h.wallet) &&
        !isExcludedParticipantWallet(h.wallet) &&
        !isLiquidityPoolWallet(h.wallet, config.tokenMint)
    )
    .map(h => {
      const firstBuyMs = h.firstBuyAt ? new Date(h.firstBuyAt).getTime() : null
      const lastWinCycle =
        lastWinByWallet.get(h.wallet) ?? h.lastWinCycle ?? null
      const live = evaluateHolderEligibility({
        wallet: h.wallet,
        balance: normalizeTokenBalance(h.balance, config.tokenDecimals, config.minTokenHolding),
        vwap: h.vwap || null,
        tokenPrice,
        firstBuyTimestamp: firstBuyMs,
        hasSold: h.hasSold ?? false,
        hasTransferredOut: h.hasTransferredOut ?? false,
        hasTransferIn: (h as { hasTransferIn?: boolean }).hasTransferIn ?? false,
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
    .slice(0, winnerLimit)
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

/** No winners to pay — hold at 00:00 if due, otherwise pause until someone qualifies. */
async function pausePayoutForNoWinners(reason: string, cycle?: number): Promise<PayoutResult> {
  await releasePayoutLock()
  if (isPayoutDue()) {
    const targetCycle = cycle ?? getTimerCache().currentCycle + 1
    console.log(`[Payout] ${reason} — timer stays at 00:00 until winners qualify`)
    return handlePayoutExecutionFailure(targetCycle, reason)
  }
  console.log(`[Payout] ${reason} — pausing timer until someone qualifies`)
  await pausePayoutTimerToWaiting()
  return { success: false, data: { skipped: true, reason: 'No eligible winners' } }
}

/** Drop aborted cycle records when nobody was eligible — not for execution failures. */
async function cleanupAbortedCycleRecords(cycle: number): Promise<void> {
  try {
    await Payout.deleteMany({ ...tenantFields(), cycle })
  } catch (error) {
    console.error('[Payout] Failed to cleanup aborted cycle records:', error)
  }
}

async function countSuccessfulWinnerPayouts(cycle: number): Promise<number> {
  return Payout.countDocuments({
    ...tenantFields(),
    cycle,
    status: 'success',
    rank: { $gte: 1 },
  })
}

/** Remove prior failed-only cycle rows before retrying the same cycle number. */
async function clearStaleFailedCycleRecords(cycle: number): Promise<void> {
  try {
    const existing = await Payout.find({ ...tenantFields(), cycle }).select('status').lean()
    if (existing.length === 0) return
    const hasSuccess = existing.some(p => p.status === 'success')
    if (hasSuccess) return
    await Payout.deleteMany({ ...tenantFields(), cycle })
  } catch (error) {
    console.error('[Payout] Failed to clear stale failed cycle records:', error)
  }
}

async function handlePayoutExecutionFailure(
  cycle: number,
  reason: string
): Promise<PayoutResult> {
  const cache = getTimerCache()
  const nextFailedAttempts = cache.failedAttempts + 1
  const now = Date.now()
  const trimmedReason = reason.slice(0, 500)

  console.error(
    `[Payout] Cycle ${cycle} failed — ${trimmedReason}. Timer held at 00:00 (attempt ${nextFailedAttempts}).`
  )

  /** Preserve lastPayoutTime so UI stays at 00:00 until swap + airdrop succeed. */
  await saveTimerState(cache.lastPayoutTime, cache.currentCycle, 'active', {
    failedAttempts: nextFailedAttempts,
    lastPayoutError: trimmedReason,
    lastPayoutErrorAt: now,
  })
  await releasePayoutLock()

  return {
    success: false,
    error: trimmedReason,
    cycle,
    data: {
      failed: true,
      reason: trimmedReason,
      failed_attempts: nextFailedAttempts,
      payouts: [],
    },
  }
}

/** Only path that advances currentCycle and resets the countdown after a verified payout. */
async function completeVerifiedPayoutCycle(
  nextCycle: number,
  options: {
    payWinnersInNativeToken: boolean
    swapTxHash: string | null
    successfulWinnerWallets: string[]
  }
): Promise<PayoutResult | null> {
  if (options.successfulWinnerWallets.length === 0) {
    return null
  }

  if (options.payWinnersInNativeToken) {
    let swapHash = options.swapTxHash
    if (!swapHash) {
      const priorSwap = await PayoutVolumeSwap.findOne({ ...tenantFields(), cycle: nextCycle })
        .sort({ createdAt: -1 })
        .lean()
      swapHash = priorSwap?.txHash ?? null
    }
    if (!swapHash) {
      return handlePayoutExecutionFailure(
        nextCycle,
        'Cannot complete cycle — Jupiter on-chart buy did not succeed'
      )
    }
  }

  const now = Date.now()
  await saveTimerState(now, nextCycle, 'active', { clearPayoutError: true })
  markWinnersCooldown(options.successfulWinnerWallets, nextCycle)

  if (getServiceStatus().holderCount > 0) {
    await saveRankingsToDb()
  }

  console.log('')
  console.log('[Payout] ╔════════════════════════════════════════════════════════╗')
  console.log(`[Payout] ║  ✅ CYCLE ${nextCycle} COMPLETE — timer restarted                  ║`)
  console.log('[Payout] ╚════════════════════════════════════════════════════════╝')

  return {
    success: true,
    cycle: nextCycle,
    data: { cycle: nextCycle },
  }
}

export async function executePayout(knownWinners?: PayableWinner[]): Promise<PayoutResult> {
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

    await clearStaleFailedCycleRecords(nextCycle)

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
      console.log('[Payout] No balance — cannot pay winners')
      await releasePayoutLock()
      if (isPayoutDue()) {
        return handlePayoutExecutionFailure(nextCycle, 'No wallet balance')
      }
      await pausePayoutTimerToWaiting()
      return { success: false, error: 'No wallet balance' }
    }

    if (!isPoolFundedForPayout(livePool)) {
      console.log(
        `[Payout] Pool ~${livePool.poolUsdFormatted} below minimum ${minPoolForPayoutLabel()} — cannot pay winners`
      )
      await releasePayoutLock()
      if (isPayoutDue()) {
        return handlePayoutExecutionFailure(
          nextCycle,
          `Pool below minimum (${minPoolForPayoutLabel()})`
        )
      }
      await pausePayoutTimerToWaiting()
      return { success: false, error: 'Pool below minimum' }
    }

    const distributableCap = maxDistributableSol(livePool.walletSol)
    if (distributableCap < MIN_TRANSFER_SOL) {
      console.log(
        `[Payout] Distributable ${distributableCap.toFixed(6)} SOL below minimum after wallet reserve`
      )
      await releasePayoutLock()
      if (isPayoutDue()) {
        return handlePayoutExecutionFailure(
          nextCycle,
          'Insufficient balance after reserve'
        )
      }
      await pausePayoutTimerToWaiting()
      return { success: false, error: 'Insufficient balance after reserve' }
    }

    let eligibleWinners: PayableWinner[] =
      knownWinners && knownWinners.length > 0
        ? knownWinners.slice(0, config.winnerCount)
        : await resolveLivePayableWinners(config.winnerCount)
    eligibleWinners = eligibleWinners.slice(0, config.winnerCount)
    eligibleWinners = await filterWinnersHoldingSessionToken(eligibleWinners)

    console.log(`[Payout] Live eligible winners (on-chain verified): ${eligibleWinners.length}`)

    if (eligibleWinners.length === 0) {
      return pausePayoutForNoWinners('No eligible winners', nextCycle)
    }

    console.log('[Payout] Winners to pay:')
    eligibleWinners.forEach((w: any, i: number) => {
      console.log(`[Payout]   #${i + 1}: ${w.wallet.slice(0, 8)}... (${w.drawdownPct.toFixed(1)}% loss, $${w.lossUsd.toFixed(2)})`)
    })

    const devFeeSol = poolSol * config.devFeePct
    const winnersPoolSol = poolSol - devFeeSol
    const shareFractions = getWinnerShareFractions(config.winnerCount)
    const payoutAmounts = shareFractions.map(fraction => winnersPoolSol * fraction)

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

    const payWinnersInNativeToken =
      isNativeTokenPayoutEnabled() && Boolean(config.tokenMint) && config.executePayouts

    console.log('[Payout] Creating pending winner payout records...')

    const winnerPending: { id: any; rank: number; wallet: string; amountSol: number }[] = []
    const existingForCycle = await Payout.find({
      ...tenantFields(),
      cycle: nextCycle,
      rank: { $gte: 1 },
    }).lean()

    for (let i = 0; i < eligibleWinners.length; i++) {
      const winner = eligibleWinners[i]
      const amountSol = payoutAmounts[i]
      const rank = i + 1

      if (amountSol < MIN_TRANSFER_SOL) continue

      const existing = existingForCycle.find(
        p => p.rank === rank && p.wallet === winner.wallet
      )
      if (existing?.status === 'success') {
        continue
      }
      if (existing?.status === 'pending') {
        winnerPending.push({ id: existing._id, rank, wallet: winner.wallet, amountSol })
        continue
      }
      if (existing?.status === 'failed') {
        await Payout.findByIdAndUpdate(existing._id, {
          status: 'pending',
          errorMessage: null,
          txHash: null,
        })
        winnerPending.push({ id: existing._id, rank, wallet: winner.wallet, amountSol })
        continue
      }

      const winnerPayout = await Payout.create({
        ...tenantFields(),
        ...payoutTokenFields(),
        cycle: nextCycle,
        rank,
        wallet: winner.wallet,
        amount: amountSol * solPrice,
        amountTokens: amountSol,
        drawdownPct: winner.drawdownPct,
        lossUsd: winner.lossUsd,
        txHash: null,
        status: 'pending',
        errorMessage: null,
      })
      winnerPending.push({ id: winnerPayout._id, rank, wallet: winner.wallet, amountSol })
    }

    if (winnerPending.length === 0) {
      const successCount = await countSuccessfulWinnerPayouts(nextCycle)
      if (successCount > 0 && getTimerCache().currentCycle < nextCycle) {
        const paid = await Payout.find({
          ...tenantFields(),
          cycle: nextCycle,
          status: 'success',
          rank: { $gte: 1 },
        })
          .select('wallet')
          .lean()
        const wallets = paid.map(p => p.wallet).filter(Boolean)
        const priorSwap = payWinnersInNativeToken
          ? (
              await PayoutVolumeSwap.findOne({ ...tenantFields(), cycle: nextCycle })
                .sort({ createdAt: -1 })
                .lean()
            )?.txHash ?? null
          : null
        const completed = await completeVerifiedPayoutCycle(nextCycle, {
          payWinnersInNativeToken,
          swapTxHash: priorSwap,
          successfulWinnerWallets: wallets,
        })
        await releasePayoutLock()
        if (completed?.success) {
          console.log(`[Payout] Cycle ${nextCycle} already paid — synced timer without re-sending`)
          return {
            success: true,
            cycle: nextCycle,
            data: { resumed: true, cycle: nextCycle },
          }
        }
        return (
          completed ?? handlePayoutExecutionFailure(nextCycle, 'Prior payout records could not be verified')
        )
      }
      return pausePayoutForNoWinners('No winner payouts meet minimum transfer size', nextCycle)
    }

    console.log(`[Payout] Created ${winnerPending.length} pending winner records`)

    if (payWinnersInNativeToken) {
      console.log('[Payout] Winner payouts: SOL → session token swap, then SPL transfer to winners')
    }

    let tokenAmountByRank = new Map<number, number>()
    let swapTxHash: string | null = null

    if (payWinnersInNativeToken && winnerPending.length > 0) {
      const preSwapBalance = await getPayoutWalletTokenBalance(
        config.tokenMint!,
        config.tokenDecimals
      )

      for (const pending of winnerPending) {
        const transferCheck = await assertPayoutTransferAllowed({
          rank: pending.rank,
          recipient: pending.wallet,
          amountSol: pending.amountSol,
          walletSol: (await getLivePoolBalance()).walletSol,
          allowedWinners: eligibleWinners,
          expectedWinnerAmounts: payoutAmounts,
        })
        if (!transferCheck.ok) {
          console.error(`[Payout] #${pending.rank} pre-swap BLOCKED: ${transferCheck.reason}`)
          await Payout.findByIdAndUpdate(pending.id, {
            status: 'failed',
            errorMessage: transferCheck.reason,
          })
        }
      }

      const swapCandidates: typeof winnerPending = []
      for (const pending of winnerPending) {
        const doc = await Payout.findById(pending.id).select('status').lean()
        if (doc?.status === 'pending') swapCandidates.push(pending)
      }

      if (swapCandidates.length > 0) {
        const swapSol = swapCandidates.reduce((sum, p) => sum + p.amountSol, 0)
        const minTokenUnit = minHumanTokenTransfer(config.tokenDecimals)
        const minTokensNeeded = minTokenUnit * swapCandidates.length
        const walletTokens = await getPayoutWalletTokenBalance(
          config.tokenMint!,
          config.tokenDecimals
        )
        const priorSwap = await PayoutVolumeSwap.findOne({ ...tenantFields(), cycle: nextCycle })
          .sort({ createdAt: -1 })
          .lean()

        const canReuseWalletTokens =
          walletTokens >= minTokensNeeded && Boolean(priorSwap?.txHash)

        if (canReuseWalletTokens) {
          swapTxHash = priorSwap?.txHash ?? null
          tokenAmountByRank = allocateTokenAmountsBySolShare(
            swapCandidates.map(p => ({ rank: p.rank, amountSol: p.amountSol })),
            walletTokens
          )
          console.log(
            `[Payout] Using ${walletTokens.toFixed(4)} ${config.tokenSymbol} already in payout wallet` +
              (priorSwap?.txHash ? ' (prior swap recorded)' : '')
          )
        } else {
          if (priorSwap?.txHash) {
            console.log(
              `[Payout] Prior swap ${priorSwap.txHash.slice(0, 8)}... recorded but wallet has ` +
                `${walletTokens.toFixed(6)} tokens — running fresh Jupiter buy for pending winners`
            )
          }

          console.log(
            `[Payout] Buying ~${swapSol.toFixed(6)} SOL of ${config.tokenSymbol} on-chart via Jupiter`
          )

          const swapResult = await swapSolForToken(
            swapSol,
            config.tokenMint!,
            config.tokenDecimals
          )

          if (!swapResult.success) {
            const swapError = swapResult.error || 'Token swap failed'
            for (const pending of swapCandidates) {
              await Payout.findByIdAndUpdate(pending.id, {
                status: 'failed',
                errorMessage: swapError,
              })
            }
            await releasePayoutLock()
            return handlePayoutExecutionFailure(nextCycle, swapError)
          }

          swapTxHash = swapResult.txHash
          const totalTokens = await resolveSwapDeliveredTokens({
            mint: config.tokenMint!,
            decimals: config.tokenDecimals,
            preSwapBalance,
            quotedOutputHuman: swapResult.outputAmountHuman,
          })

          console.log(
            `[Payout] Swap delivered ~${totalTokens.toFixed(4)} ${config.tokenSymbol} for winner pool`
          )

          if (totalTokens < minTokensNeeded) {
            const swapError =
              `Swap produced insufficient tokens (${totalTokens.toFixed(6)} ` +
              `${config.tokenSymbol}; need ≥${minTokensNeeded.toFixed(6)} for ${swapCandidates.length} winner(s))`
            for (const pending of swapCandidates) {
              await Payout.findByIdAndUpdate(pending.id, {
                status: 'failed',
                errorMessage: swapError,
              })
            }
            await releasePayoutLock()
            return handlePayoutExecutionFailure(nextCycle, swapError)
          }

          await recordPayoutVolumeSwap({
            cycle: nextCycle,
            swapSol,
            swapUsd: swapSol * solPrice,
            outputTokensHuman: totalTokens,
            txHash: swapResult.txHash,
          })

          tokenAmountByRank = allocateTokenAmountsBySolShare(
            swapCandidates.map(p => ({ rank: p.rank, amountSol: p.amountSol })),
            totalTokens
          )
        }
      }
    }

    for (const pending of winnerPending) {
      const label = `#${pending.rank}`
      const existing = await Payout.findById(pending.id).select('status errorMessage').lean()
      if (existing?.status !== 'pending') {
        if (
          existing?.status === 'failed' &&
          !results.some(r => r.type === 'winner' && r.rank === pending.rank)
        ) {
          results.push({
            rank: pending.rank,
            type: 'winner',
            wallet: pending.wallet,
            amount_eth: pending.amountSol.toFixed(6),
            status: 'failed',
            tx_hash: swapTxHash,
            error: existing.errorMessage,
          })
        }
        continue
      }

      const currentLive = await getLivePoolBalance()
      const availableSol = currentLive.walletSol
      const sessionTokenPrice =
        (await getTokenPrice(config.tokenMint!)) ?? solPrice

      if (payWinnersInNativeToken) {
        const tokenAmount = tokenAmountByRank.get(pending.rank)
        const minTokenUnit = minHumanTokenTransfer(config.tokenDecimals)
        if (tokenAmount == null || tokenAmount < minTokenUnit) {
          const reason =
            swapTxHash == null
              ? 'Token swap did not produce a distributable balance'
              : tokenAmount == null
                ? 'Winner was not included in the swap batch — retry will re-run buyback'
                : `Winner token share (${tokenAmount.toFixed(8)}) is below minimum transfer size`
          await Payout.findByIdAndUpdate(pending.id, {
            status: 'failed',
            errorMessage: reason,
          })
          results.push({
            rank: pending.rank,
            type: 'winner',
            wallet: pending.wallet,
            amount_eth: pending.amountSol.toFixed(6),
            status: 'failed',
            tx_hash: swapTxHash,
            error: reason,
          })
          continue
        }

        const tokenCheck = await assertPayoutTokenTransferAllowed({
          rank: pending.rank,
          recipient: pending.wallet,
          amountTokens: tokenAmount,
          allowedWinners: eligibleWinners,
        })

        if (!tokenCheck.ok) {
          console.error(`[Payout] ${label} BLOCKED: ${tokenCheck.reason}`)
          await Payout.findByIdAndUpdate(pending.id, {
            status: 'failed',
            errorMessage: tokenCheck.reason,
          })
          results.push({
            rank: pending.rank,
            type: 'winner',
            wallet: pending.wallet,
            amount_eth: pending.amountSol.toFixed(6),
            status: 'failed',
            tx_hash: null,
            error: tokenCheck.reason,
          })
          continue
        }

        console.log(
          `[Payout] ${label}: Sending ${tokenAmount.toFixed(4)} ${config.tokenSymbol} to ${pending.wallet.slice(0, 10)}...`
        )

        const txResult = config.executePayouts
          ? await transferSessionToken(
              pending.wallet,
              tokenAmount,
              config.tokenMint!,
              config.tokenDecimals,
              config.tokenSymbol
            )
          : { success: false, txHash: null, error: 'EXECUTE_PAYOUTS disabled' }

        console.log(
          `[Payout] ${label} result: ${txResult.success ? '✅' : '❌'} ${txResult.txHash || txResult.error}`
        )

        const tokenUsd = tokenAmount * sessionTokenPrice
        await Payout.findByIdAndUpdate(pending.id, {
          txHash: txResult.txHash || swapTxHash,
          amount: tokenUsd,
          amountTokens: tokenAmount,
          status: txResult.success ? 'success' : 'failed',
          errorMessage: txResult.error,
        })

        if (txResult.success) {
          totalPaidSol += pending.amountSol
        }

        results.push({
          rank: pending.rank,
          type: 'winner',
          wallet: pending.wallet,
          amount_eth: pending.amountSol.toFixed(6),
          amount_tokens: tokenAmount.toFixed(4),
          status: txResult.success ? 'success' : 'failed',
          tx_hash: txResult.txHash,
          error: txResult.error,
        })

        if (txResult.success) {
          await Disqualification.create({
            wallet: pending.wallet,
            reason: 'winner_cooldown',
            expiresAt: new Date(Date.now() + config.payoutIntervalMinutes * 60 * 1000 * 2),
          }).catch(() => {})

          try {
            await persistWinnerAfterPayout(pending.wallet, nextCycle, sessionTokenPrice)
          } catch (err) {
            console.error(
              `[Payout] Winner cooldown DB update failed for ${pending.wallet.slice(0, 10)}... (transfer already sent):`,
              err
            )
          }
        }
        continue
      }

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
        try {
          await persistWinnerAfterPayout(pending.wallet, nextCycle, tokenPrice)
        } catch (err) {
          console.error(
            `[Payout] Winner cooldown DB update failed for ${pending.wallet.slice(0, 10)}... (transfer already sent):`,
            err
          )
        }
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
      const failureReason =
        results.find(r => r.type === 'winner' && r.status === 'failed' && r.error)?.error ||
        'No successful winner payouts this cycle'

      if (eligibleWinners.length > 0) {
        return handlePayoutExecutionFailure(nextCycle, failureReason)
      }

      await cleanupAbortedCycleRecords(nextCycle)
      return pausePayoutForNoWinners('No successful winner payouts this cycle', nextCycle)
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

    const completed = await completeVerifiedPayoutCycle(nextCycle, {
      payWinnersInNativeToken,
      swapTxHash,
      successfulWinnerWallets,
    })
    if (!completed?.success) {
      await releasePayoutLock()
      return (
        completed ??
        handlePayoutExecutionFailure(nextCycle, 'Payout could not be verified on-chain')
      )
    }

    console.log(`[Payout] Updated ${successfulWinnerWallets.length} winners with cooldown in memory`)

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
    if (isPayoutDue()) {
      return handlePayoutExecutionFailure(
        getTimerCache().currentCycle + 1,
        error.message || 'Payout failed'
      )
    }
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
export async function maybeExecuteDuePayout(
  eligibleCount: number,
  knownWinners?: PayableWinner[]
): Promise<PayoutResult | null> {
  await ensureTimerStateSync()
  const timer = getPayoutTimerInfo()

  if (timer.timer_status !== 'active' || !isPayoutDue()) {
    console.log(
      `[Payout] Not executing — status=${timer.timer_status} due=${isPayoutDue()} remaining=${timer.seconds_remaining ?? 'null'}`
    )
    return null
  }

  if (eligibleCount <= 0) {
    const liveWinners = await resolveLivePayableWinners(config.winnerCount)
    if (liveWinners.length > 0) {
      console.warn(
        `[Payout] Due with caller eligibleCount=0 but ${liveWinners.length} live winner(s) — executing`
      )
      return runAuthorizedPayout(() => executePayout(liveWinners))
    }
    if (isPayoutDue()) {
      return handlePayoutExecutionFailure(
        getTimerCache().currentCycle + 1,
        'No eligible winners at payout time'
      )
    }
    await pausePayoutTimerToWaiting()
    return { success: false, data: { skipped: true, reason: 'No eligible winners' } }
  }

  const livePool = await getLivePoolBalance()
  if (!isPoolFundedForPayout(livePool)) {
    const msg = `Pool below minimum (${minPoolForPayoutLabel()})`
    console.log(`[Payout] Timer due but ${msg}`)
    return handlePayoutExecutionFailure(getTimerCache().currentCycle + 1, msg)
  }

  if (!config.executePayouts) {
    return handlePayoutExecutionFailure(
      getTimerCache().currentCycle + 1,
      'EXECUTE_PAYOUTS disabled'
    )
  }

  const configError = assertProductionPayoutConfig()
  if (configError) {
    console.error(`[Payout] Blocked — ${configError}`)
    return { success: false, error: configError }
  }

  return runAuthorizedPayout(() => executePayout(knownWinners))
}
