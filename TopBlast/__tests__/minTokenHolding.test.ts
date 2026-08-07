import {
  DEFAULT_MIN_TOKEN_HOLDING,
  parseMinTokenHoldingInput,
  validateMinTokenHolding,
} from '@/lib/platform/minTokenHolding'

describe('minTokenHolding', () => {
  it('defaults to 1000', () => {
    expect(validateMinTokenHolding()).toBe(DEFAULT_MIN_TOKEN_HOLDING)
  })

  it('accepts custom whole numbers', () => {
    expect(validateMinTokenHolding(500_000)).toBe(500_000)
  })

  it('rejects fractional values', () => {
    expect(() => validateMinTokenHolding(1.5)).toThrow(/whole number/)
  })

  it('parses comma-separated input', () => {
    expect(parseMinTokenHoldingInput('1,000,000')).toBe(1_000_000)
  })
})
