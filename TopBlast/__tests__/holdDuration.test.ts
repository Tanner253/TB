import { MIN_HOLD_DURATION_MINUTES, formatHoldDuration, getHoldSecondsRemaining, getHoldEligibleAt, formatHoldCountdown } from '@/lib/eligibility/holdDuration'

describe('holdDuration', () => {
  it('is hardcoded to 15 minutes', () => {
    expect(MIN_HOLD_DURATION_MINUTES).toBe(15)
  })

  it('formats minutes for display', () => {
    expect(formatHoldDuration(15)).toBe('15 min')
    expect(formatHoldDuration(60)).toBe('1 hr')
    expect(formatHoldDuration(90)).toBe('1 hr 30 min')
  })

  it('computes hold eligible timestamp', () => {
    const firstBuy = 1_000_000
    expect(getHoldEligibleAt(firstBuy, 15)).toBe(firstBuy + 15 * 60 * 1000)
  })

  it('computes seconds remaining until hold met', () => {
    const now = 1_000_000
    const firstBuy = now - 5 * 60 * 1000
    expect(getHoldSecondsRemaining(firstBuy, 15, now)).toBe(10 * 60)
    expect(getHoldSecondsRemaining(firstBuy, 15, now + 10 * 60 * 1000)).toBe(0)
    expect(getHoldSecondsRemaining(null, 15, now)).toBeNull()
  })

  it('formats countdown display', () => {
    expect(formatHoldCountdown(125)).toBe('2:05')
    expect(formatHoldCountdown(9)).toBe('0:09')
  })
})
