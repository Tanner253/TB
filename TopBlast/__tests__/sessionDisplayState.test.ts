import { deriveSessionDisplayState } from '@/lib/session/displayState'

describe('deriveSessionDisplayState', () => {
  it('shows limbo when Mongo timer is active but nobody is eligible', () => {
    const state = deriveSessionDisplayState({
      timerStatus: 'active',
      secondsRemaining: 881,
      eligibleCount: 0,
      rankedHolderCount: 8,
      trackedHolders: 8,
    })
    expect(state.phase).toBe('limbo')
    expect(state.effectiveTimerStatus).toBe('waiting')
    expect(state.showCountdown).toBe(false)
  })

  it('shows countdown when timer is active and holders qualify', () => {
    const state = deriveSessionDisplayState({
      timerStatus: 'active',
      secondsRemaining: 881,
      eligibleCount: 2,
      rankedHolderCount: 8,
    })
    expect(state.phase).toBe('countdown')
    expect(state.showCountdown).toBe(true)
    expect(state.effectiveSecondsRemaining).toBe(881)
  })

  it('shows timer starting when eligible but timer not started', () => {
    const state = deriveSessionDisplayState({
      timerStatus: 'waiting',
      secondsRemaining: null,
      eligibleCount: 3,
      rankedHolderCount: 10,
    })
    expect(state.phase).toBe('timer_starting')
    expect(state.showCountdown).toBe(false)
  })

  it('shows limbo when waiting with ranked holders and zero eligible', () => {
    const state = deriveSessionDisplayState({
      timerStatus: 'waiting',
      secondsRemaining: null,
      eligibleCount: 0,
      rankedHolderCount: 5,
      trackedHolders: 5,
    })
    expect(state.phase).toBe('limbo')
  })

  it('shows payout due at zero seconds', () => {
    const state = deriveSessionDisplayState({
      timerStatus: 'active',
      secondsRemaining: 0,
      eligibleCount: 1,
      rankedHolderCount: 4,
    })
    expect(state.phase).toBe('payout_due')
  })
})
