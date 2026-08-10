/**
 * Maps real Birdeye API shape (snake_case) to TopBlast holder fields.
 * Fixture captured from live probe 2026-08-10 on EvEPfQm…pump.
 */
import { mapBirdeyeWalletHolderRow } from '@/lib/solana/birdeyeHolderMapping'

const LIVE_FIXTURE = {
  owner: '6at5BdhHnm6y5cVjNE3PMyv8Cvh3SQxU1VxkbAKv9skF',
  amount: 35235233.959633,
  avg_buy_price: 0.000005522759253076367,
  avg_sell_price: 0,
  first_trade_unix_time: 1779758854,
}

const TRANSFER_ONLY_FIXTURE = {
  owner: '3KGLdavtQHCVX53xjv2bDizmdpQuYWNBchCcd8HhdPYi',
  amount: 563158363.530315,
  avg_buy_price: 0,
  avg_sell_price: 0,
  first_trade_unix_time: 1786251175,
}

describe('birdeyeHolderMapping', () => {
  it('maps buy holder to balance, vwap, firstBuy, hasSold=false', () => {
    const row = mapBirdeyeWalletHolderRow(LIVE_FIXTURE, 0.000006131)
    expect(row.wallet).toBe(LIVE_FIXTURE.owner)
    expect(row.balance).toBeCloseTo(LIVE_FIXTURE.amount, 0)
    expect(row.vwap).toBeCloseTo(LIVE_FIXTURE.avg_buy_price, 12)
    expect(row.hasSold).toBe(false)
    expect(row.firstBuyTimestamp).toBe(LIVE_FIXTURE.first_trade_unix_time * 1000)
    expect(row.drawdownPct).toBeGreaterThan(0) // in profit at probe price
  })

  it('flags sold holder via avg_sell_price', () => {
    const row = mapBirdeyeWalletHolderRow(
      {
        owner: '4wRHFNV4RGMBm2xaojuGFKaAHW9YSLyUtHCjgVP8gCpA',
        amount: 34513861.499551,
        avg_buy_price: 0.000004255420605874474,
        avg_sell_price: 0.0000053123113864073605,
        first_trade_unix_time: 1777473779,
      },
      0.000006131
    )
    expect(row.hasSold).toBe(true)
  })

  it('treats zero avg_buy as no buy history (transfer/LP)', () => {
    const row = mapBirdeyeWalletHolderRow(TRANSFER_ONLY_FIXTURE, 0.000006131)
    expect(row.vwap).toBeNull()
    expect(row.firstBuyTimestamp).toBe(TRANSFER_ONLY_FIXTURE.first_trade_unix_time * 1000)
  })
})
