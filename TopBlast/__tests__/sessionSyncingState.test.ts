import { deriveSessionDisplayState } from '@/lib/session/displayState'

/**
 * A fresh listing's only holder is usually the creator's own payout wallet,
 * which is excluded from winning. That scan succeeds and still ranks nobody —
 * which must not render as "Indexing chain…" forever.
 */
describe('syncing vs indexed-but-empty', () => {
  const base = {
    timerStatus: 'waiting' as const,
    secondsRemaining: null,
    eligibleCount: 0,
    rankedHolderCount: 0,
    trackedHolders: 0,
    poolFundedForPayout: true,
  }

  it('syncs while no scan has reported anything', () => {
    expect(deriveSessionDisplayState({ ...base, reportedHolderCount: 0 }).phase).toBe('syncing')
  })

  it('stops syncing once a scan reports holders, even if none are rankable', () => {
    const state = deriveSessionDisplayState({ ...base, reportedHolderCount: 1 })
    expect(state.phase).not.toBe('syncing')
    expect(state.phase).toBe('limbo')
  })

  it('does not spin just because isInitializing is set, if a scan reported holders', () => {
    const state = deriveSessionDisplayState({
      ...base,
      reportedHolderCount: 3,
      isInitializing: true,
    })
    expect(state.phase).not.toBe('syncing')
  })

  it('still syncs when initializing with no scan yet', () => {
    const state = deriveSessionDisplayState({
      ...base,
      reportedHolderCount: 0,
      isInitializing: true,
    })
    expect(state.phase).toBe('syncing')
  })

  it('keeps an unfunded pool ahead of every holder state', () => {
    const state = deriveSessionDisplayState({
      ...base,
      reportedHolderCount: 1,
      poolFundedForPayout: false,
    })
    expect(state.phase).toBe('waiting_for_topup')
  })

  it('shows a countdown once someone is actually eligible', () => {
    const state = deriveSessionDisplayState({
      ...base,
      reportedHolderCount: 5,
      rankedHolderCount: 5,
      eligibleCount: 2,
      timerStatus: 'active',
      secondsRemaining: 120,
    })
    expect(state.phase).not.toBe('syncing')
    expect(state.showCountdown).toBe(true)
  })
})
