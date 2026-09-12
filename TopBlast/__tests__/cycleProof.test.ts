/**
 * The proof badge is a claim about money. The only failure that matters here
 * is overclaiming — saying every payment is verifiable when it isn't.
 */

import { deriveCycleProof } from '@/lib/payout/cycleProof'

const winner = (status: 'success' | 'failed', tx: string | null = '0xabc') =>
  ({ type: 'winner' as const, status, tx_hash: tx })
const devFee = () => ({ type: 'dev_fee' as const, status: 'success' as const, tx_hash: '0xfee' })

describe('deriveCycleProof', () => {
  it('makes the strong claim only when every recipient is paid and linkable', () => {
    const p = deriveCycleProof({ payouts: [winner('success'), winner('success'), devFee()] })!
    expect(p).toMatchObject({ recipients: 2, paid: 2, evidenced: 2, notSent: 0, pct: 100, complete: true })
    expect(p.summary).toBe('All 2 recipients paid — every payment has an on-chain record.')
  })

  it('excludes the protocol fee from the recipient count', () => {
    // Counting the treasury transfer would pad 1/1 into 2/2.
    const p = deriveCycleProof({ payouts: [winner('success'), devFee()] })!
    expect(p.recipients).toBe(1)
    expect(p.summary).toBe('All 1 recipient paid — every payment has an on-chain record.')
  })

  it('reports a partial cycle honestly', () => {
    const p = deriveCycleProof({
      payouts: [winner('success'), winner('success'), winner('failed', null), devFee()],
    })!
    expect(p).toMatchObject({ recipients: 3, paid: 2, evidenced: 2, notSent: 1, pct: 67, complete: false })
    expect(p.summary).toBe('2 of 3 recipients paid — 2 with an on-chain record, 1 did not land.')
  })

  it('does not claim a record for a success with no transaction hash', () => {
    const p = deriveCycleProof({ payouts: [winner('success'), winner('success', null)] })!
    expect(p.paid).toBe(2)
    expect(p.evidenced).toBe(1)
    expect(p.complete).toBe(false)
    expect(p.summary).toMatch(/1 with an on-chain record, 1 still indexing/)
  })

  it('never reports 100% complete when nothing landed', () => {
    const p = deriveCycleProof({ payouts: [winner('failed', null), winner('failed', null)] })!
    expect(p.pct).toBe(0)
    expect(p.complete).toBe(false)
    expect(p.summary).toBe('No recipients paid this cycle — 2 did not land.')
  })

  it('returns null for a cycle with no winner payouts at all', () => {
    expect(deriveCycleProof({ payouts: [devFee()] })).toBeNull()
    expect(deriveCycleProof({ payouts: [] })).toBeNull()
  })
})
