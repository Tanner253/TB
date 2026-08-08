import {
  getEffectivePayoutIntervalMinutes,
  getPayoutFailureRetryMinutes,
  getPayoutSwapMaxRetries,
} from '@/lib/payout/payoutRetry'

describe('payout retry config', () => {
  afterEach(() => {
    delete process.env.PAYOUT_FAILURE_RETRY_MINUTES
    delete process.env.PAYOUT_SWAP_MAX_RETRIES
  })

  it('defaults failure retry interval to 3 minutes', () => {
    expect(getPayoutFailureRetryMinutes()).toBe(3)
  })

  it('defaults swap max retries to 3', () => {
    expect(getPayoutSwapMaxRetries()).toBe(3)
  })

  it('uses shorter interval when failedAttempts > 0', () => {
    expect(getEffectivePayoutIntervalMinutes(15, 0)).toBe(15)
    expect(getEffectivePayoutIntervalMinutes(15, 2)).toBe(3)
    expect(getEffectivePayoutIntervalMinutes(2, 1)).toBe(2)
  })

  it('respects PAYOUT_FAILURE_RETRY_MINUTES env', () => {
    process.env.PAYOUT_FAILURE_RETRY_MINUTES = '5'
    expect(getEffectivePayoutIntervalMinutes(15, 1)).toBe(5)
  })
})
