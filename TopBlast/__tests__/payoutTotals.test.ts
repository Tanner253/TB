import { aggregateSuccessfulPayoutTotals } from '@/lib/payout/payoutTotals'

describe('aggregateSuccessfulPayoutTotals', () => {
  it('sums USD from payout history and SOL only for SOL-denominated rows', () => {
    const totals = aggregateSuccessfulPayoutTotals([
      {
        rank: 1,
        amount: 7.32,
        amountTokens: 2_729_024.507339,
        status: 'success',
      },
      {
        rank: 0,
        amount: 0.26,
        amountTokens: 0.003422,
        status: 'success',
      },
      {
        rank: 2,
        amount: 5,
        amountTokens: 0.02,
        status: 'success',
      },
      {
        rank: 1,
        amount: 99,
        amountTokens: 1,
        status: 'failed',
      },
    ])

    expect(totals.total_usd).toBeCloseTo(12.58)
    expect(totals.total_sol).toBeCloseTo(0.023422)
  })

  it('mirrors the same totals for gen volume and paid out', () => {
    const payouts = [
      {
        rank: 1,
        amount: 18.89,
        amountTokens: 2_729_024.664,
        status: 'success',
      },
    ]

    const paidOut = aggregateSuccessfulPayoutTotals(payouts)
    const genVolume = aggregateSuccessfulPayoutTotals(payouts)

    expect(genVolume).toEqual(paidOut)
    expect(genVolume.total_usd).toBeCloseTo(18.89)
  })
})
