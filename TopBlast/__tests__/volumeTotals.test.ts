import { resolveGeneratedVolume } from '@/lib/payout/volumeTotals'

describe('resolveGeneratedVolume', () => {
  it('mirrors paid-out USD and converts SOL from current price', () => {
    expect(
      resolveGeneratedVolume({
        paidOut: { total_sol: 0.03, total_usd: 32 },
        solPrice: 80,
      })
    ).toEqual({ total_sol: 0.4, total_usd: 32 })
  })

  it('returns zeros when paid out is empty', () => {
    expect(
      resolveGeneratedVolume({
        paidOut: { total_sol: 0, total_usd: 0 },
        solPrice: 80,
      })
    ).toEqual({ total_sol: 0, total_usd: 0 })
  })
})
