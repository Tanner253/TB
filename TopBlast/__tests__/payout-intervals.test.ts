import {
  DEFAULT_PAYOUT_INTERVAL_MINUTES,
  formatPayoutInterval,
  formatPayoutIntervalCompact,
  formatPayoutIntervalOptionsList,
  PAYOUT_INTERVAL_RANGE_COMPACT,
  validatePayoutIntervalMinutes,
} from '@/lib/platform/payoutIntervals'

describe('payout intervals', () => {
  it('defaults to 15 minutes', () => {
    expect(validatePayoutIntervalMinutes()).toBe(DEFAULT_PAYOUT_INTERVAL_MINUTES)
    expect(validatePayoutIntervalMinutes(undefined)).toBe(15)
  })

  it('accepts each allowed option', () => {
    expect(validatePayoutIntervalMinutes(60)).toBe(60)
    expect(validatePayoutIntervalMinutes(360)).toBe(360)
  })

  it('rejects unsupported intervals', () => {
    expect(() => validatePayoutIntervalMinutes(45)).toThrow(/Payout frequency must be one of/)
    expect(() => validatePayoutIntervalMinutes(1440)).toThrow(/Payout frequency must be one of/)
  })

  it('formats labels for UI copy', () => {
    expect(formatPayoutInterval(60)).toBe('1 hour')
    expect(formatPayoutIntervalOptionsList()).toContain('or 6 hours')
  })

  it('formats compact range for stat cards', () => {
    expect(formatPayoutIntervalCompact(15)).toBe('15m')
    expect(formatPayoutIntervalCompact(360)).toBe('6h')
    expect(PAYOUT_INTERVAL_RANGE_COMPACT).toBe('15m–6h')
  })
})
