import {
  computePayoutSecondsRemaining,
  formatPayoutCountdown,
} from '@/lib/payout/timerMath'

describe('timerMath', () => {
  const base = {
    timerStatus: 'active' as const,
    payoutIntervalMinutes: 15,
    now: 1_000_000_000_000,
  }

  it('returns full interval when timer active with no last payout', () => {
    expect(
      computePayoutSecondsRemaining({
        ...base,
        lastPayoutTime: null,
      })
    ).toBe(900)
  })

  it('returns null when timer is waiting', () => {
    expect(
      computePayoutSecondsRemaining({
        ...base,
        timerStatus: 'waiting',
        lastPayoutTime: new Date(base.now - 60_000),
      })
    ).toBeNull()
  })

  it('counts down from last payout time', () => {
    expect(
      computePayoutSecondsRemaining({
        ...base,
        lastPayoutTime: new Date(base.now - 120_000),
      })
    ).toBe(780)
  })

  it('formats mm:ss countdown', () => {
    expect(formatPayoutCountdown(513)).toBe('8:33')
    expect(formatPayoutCountdown(65)).toBe('1:05')
  })
})
