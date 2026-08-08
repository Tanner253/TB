/**
 * Single source of truth for payout countdown / limbo UI across catalog and leaderboard.
 * Matches executor rules: an active Mongo timer with zero eligible holders is treated as paused.
 * Pool below MIN_POOL_FOR_PAYOUT (USD value of payout-wallet SOL) also forces limbo.
 */

export type SessionDisplayPhase =
  | 'syncing'
  | 'limbo'
  | 'timer_starting'
  | 'countdown'
  | 'payout_due'

export interface SessionDisplayInput {
  timerStatus: 'waiting' | 'active'
  secondsRemaining: number | null
  eligibleCount: number
  rankedHolderCount: number
  trackedHolders?: number
  isInitializing?: boolean
  /** When false, session stays in limbo until payout wallet SOL (USD) meets minimum. */
  poolFundedForPayout?: boolean
}

export interface SessionDisplayState {
  phase: SessionDisplayPhase
  /** Timer status after eligibility sync (active + 0 eligible → waiting). */
  effectiveTimerStatus: 'waiting' | 'active'
  showCountdown: boolean
  effectiveSecondsRemaining: number | null
  /** Limbo because payout wallet SOL (USD) is below minimum. */
  poolBelowMinimum: boolean
}

export function deriveSessionDisplayState(input: SessionDisplayInput): SessionDisplayState {
  const {
    timerStatus,
    secondsRemaining,
    eligibleCount,
    rankedHolderCount,
    trackedHolders = 0,
    isInitializing = false,
    poolFundedForPayout = true,
  } = input

  const hasEligible = eligibleCount > 0
  const hasRankedHolders = rankedHolderCount > 0
  const isSyncing =
    isInitializing || (!hasRankedHolders && trackedHolders === 0 && !isInitializing)

  const poolBelowMinimum = poolFundedForPayout === false

  const effectiveTimerStatus: 'waiting' | 'active' =
    timerStatus === 'active' && (!hasEligible || poolBelowMinimum) ? 'waiting' : timerStatus

  const effectiveSecondsRemaining =
    effectiveTimerStatus === 'active' ? secondsRemaining : null

  if (isSyncing) {
    return {
      phase: 'syncing',
      effectiveTimerStatus,
      showCountdown: false,
      effectiveSecondsRemaining: null,
      poolBelowMinimum,
    }
  }

  if (poolBelowMinimum) {
    return {
      phase: 'limbo',
      effectiveTimerStatus: 'waiting',
      showCountdown: false,
      effectiveSecondsRemaining: null,
      poolBelowMinimum: true,
    }
  }

  if (!hasEligible && hasRankedHolders && effectiveTimerStatus === 'waiting') {
    return {
      phase: 'limbo',
      effectiveTimerStatus,
      showCountdown: false,
      effectiveSecondsRemaining: null,
      poolBelowMinimum: false,
    }
  }

  if (hasEligible && effectiveTimerStatus === 'waiting') {
    return {
      phase: 'timer_starting',
      effectiveTimerStatus,
      showCountdown: false,
      effectiveSecondsRemaining: null,
      poolBelowMinimum: false,
    }
  }

  if (effectiveTimerStatus === 'active') {
    if (effectiveSecondsRemaining != null && effectiveSecondsRemaining <= 0) {
      return {
        phase: 'payout_due',
        effectiveTimerStatus,
        showCountdown: true,
        effectiveSecondsRemaining,
        poolBelowMinimum: false,
      }
    }
    return {
      phase: 'countdown',
      effectiveTimerStatus,
      showCountdown: true,
      effectiveSecondsRemaining,
      poolBelowMinimum: false,
    }
  }

  return {
    phase: 'limbo',
    effectiveTimerStatus,
    showCountdown: false,
    effectiveSecondsRemaining: null,
    poolBelowMinimum: false,
  }
}
