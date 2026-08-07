import { evaluateHolderEligibility } from '@/lib/eligibility/evaluateHolder'

describe('evaluateHolderEligibility', () => {
  const base = {
    balance: 1_000_000,
    vwap: 0.00001,
    tokenPrice: 0.000008,
    firstBuyTimestamp: Date.now() - 20 * 60 * 1000,
    poolUsd: 10,
    currentCycle: 5,
  }

  it('marks holder eligible when all rules pass', () => {
    const result = evaluateHolderEligibility({
      ...base,
      totalTokensBought: 1_000_000,
    })
    expect(result.isEligible).toBe(true)
    expect(result.drawdownPct).toBeLessThan(0)
  })

  it('rejects at break-even', () => {
    const result = evaluateHolderEligibility({
      ...base,
      tokenPrice: base.vwap,
    })
    expect(result.isEligible).toBe(false)
    expect(result.ineligibleReason).toBe('At break-even')
  })

  it('rejects when hold duration not met', () => {
    const result = evaluateHolderEligibility({
      ...base,
      firstBuyTimestamp: Date.now() - 5 * 60 * 1000,
    })
    expect(result.isEligible).toBe(false)
    expect(result.ineligibleReason).toBe('Hold duration not met')
  })

  it('rejects contracts path via sold flag', () => {
    const result = evaluateHolderEligibility({
      ...base,
      hasSold: true,
    })
    expect(result.ineligibleReason).toBe('Sold tokens')
  })

  it('labels transfer-only wallets as received via transfer', () => {
    const result = evaluateHolderEligibility({
      ...base,
      vwap: null,
      hasTransferIn: true,
      totalTokensBought: 0,
      firstBuyTimestamp: null,
    })
    expect(result.ineligibleReason).toBe('Received via transfer')
  })
})
