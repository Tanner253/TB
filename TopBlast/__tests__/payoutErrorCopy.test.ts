/**
 * Payout failures are read by holders, so the copy has to be clearer than the
 * raw chain error without being softer than the truth. The two failure modes
 * that matter: making a transient look like a broken protocol, and making a
 * real problem look like a hiccup.
 */

import { humanizePayoutError } from '@/lib/payout/payoutErrorCopy'

describe('humanizePayoutError', () => {
  it('explains the Solana blockhash transient as congestion, not a defect', () => {
    const copy = humanizePayoutError(
      'Failed to send transaction: Transaction simulation failed: Blockhash not found'
    )!
    expect(copy.message).toMatch(/congested/i)
    expect(copy.message).toMatch(/retried automatically/i)
    expect(copy.retried).toBe(true)
    // The chain's own words survive for support.
    expect(copy.raw).toContain('Blockhash not found')
  })

  it('does not dress a drained pool up as a retry', () => {
    const copy = humanizePayoutError('Insufficient balance: 0.001 SOL < 0.5 SOL needed')!
    expect(copy.retried).toBe(false)
    expect(copy.message).toMatch(/top up/i)
  })

  it('names thin liquidity rather than echoing TOKEN_NOT_TRADABLE', () => {
    const copy = humanizePayoutError('Swap failed: TOKEN_NOT_TRADABLE')!
    expect(copy.message).toMatch(/liquidity/i)
    expect(copy.retried).toBe(false)
  })

  it('treats an on-chain revert as final, and says no funds moved', () => {
    const copy = humanizePayoutError('execution reverted')!
    expect(copy.retried).toBe(false)
    expect(copy.message).toMatch(/no funds moved/i)
  })

  it('marks slippage as protective and retryable', () => {
    const copy = humanizePayoutError('Curve buy reverted: minTokensOut not met')!
    expect(copy.retried).toBe(true)
    expect(copy.message).toMatch(/protect the pool/i)
  })

  it('does not launder an unrecognised error into a friendly sentence', () => {
    const copy = humanizePayoutError('Error: Something nobody has seen before xyz')!
    expect(copy.message).toBe('Something nobody has seen before xyz')
    expect(copy.retried).toBe(false)
  })

  it('truncates a runaway error instead of blowing out the row', () => {
    const copy = humanizePayoutError('Error: ' + 'x'.repeat(500))!
    expect(copy.message.length).toBeLessThanOrEqual(140)
    expect(copy.message.endsWith('…')).toBe(true)
    expect(copy.raw.length).toBeGreaterThan(400)
  })

  it('returns null when there is no error at all', () => {
    expect(humanizePayoutError(null)).toBeNull()
    expect(humanizePayoutError('')).toBeNull()
    expect(humanizePayoutError('   ')).toBeNull()
  })
})
