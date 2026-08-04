import { MIN_HOLD_DURATION_MINUTES, formatHoldDuration } from '@/lib/eligibility/holdDuration'

describe('holdDuration', () => {
  it('is hardcoded to 15 minutes', () => {
    expect(MIN_HOLD_DURATION_MINUTES).toBe(15)
  })

  it('formats minutes for display', () => {
    expect(formatHoldDuration(15)).toBe('15 min')
    expect(formatHoldDuration(60)).toBe('1 hr')
    expect(formatHoldDuration(90)).toBe('1 hr 30 min')
  })
})
