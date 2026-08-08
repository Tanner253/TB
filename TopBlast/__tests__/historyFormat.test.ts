import {
  formatHistoryUsd,
  formatPayoutAmount,
  resolvePayoutAmountAsset,
} from '@/lib/payout/historyFormat'

describe('historyFormat', () => {
  it('treats dev fee as SOL', () => {
    expect(resolvePayoutAmountAsset(0, 0.003422, 0.26)).toBe('sol')
  })

  it('treats large winner amounts as session tokens', () => {
    expect(resolvePayoutAmountAsset(1, 2_729_024.507339, 7.32)).toBe('token')
  })

  it('treats small winner SOL payouts as SOL', () => {
    expect(resolvePayoutAmountAsset(1, 0.04, 3.04)).toBe('sol')
  })

  it('formats token amounts with commas', () => {
    expect(formatPayoutAmount(2_729_024.507339, 'token')).toBe('2,729,025')
  })

  it('formats SOL with commas and decimals', () => {
    expect(formatPayoutAmount(0.003422, 'sol')).toBe('0.003422')
    expect(formatPayoutAmount(1234.5678, 'sol')).toBe('1,234.5678')
  })

  it('formats USD with commas', () => {
    expect(formatHistoryUsd(1234.5)).toBe('1,234.50')
  })
})
