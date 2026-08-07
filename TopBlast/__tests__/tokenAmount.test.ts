import {
  rawToHumanTokenAmount,
  normalizeTokenBalance,
  formatTokenBalance,
  meetsMinTokenHoldingFromChain,
} from '@/lib/solana/tokenAmount'

describe('tokenAmount', () => {
  const decimals = 6
  const rawTopHolder = 10_480_149_453_770

  it('converts raw SPL amount to human tokens', () => {
    expect(rawToHumanTokenAmount(rawTopHolder, decimals)).toBeCloseTo(10_480_149.45, 0)
  })

  it('normalizes legacy raw balances stored in DB', () => {
    expect(normalizeTokenBalance(rawTopHolder, decimals, 1000)).toBeCloseTo(10_480_149.45, 0)
  })

  it('leaves already-human balances unchanged', () => {
    expect(normalizeTokenBalance(1_500_000, decimals, 1000)).toBe(1_500_000)
  })

  it('formats large human balances with grouping', () => {
    expect(formatTokenBalance(10_480_149)).toBe('10,480,149')
  })

  it('checks min holding against raw on-chain amounts', () => {
    expect(meetsMinTokenHoldingFromChain(999_000_000, decimals, 1000)).toBe(false)
    expect(meetsMinTokenHoldingFromChain(1_000_000_000, decimals, 1000)).toBe(true)
  })
})
