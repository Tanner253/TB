/**
 * Post-graduation cost basis. The dangerous failures here are silent ones:
 * counting a curve trade twice (halves a wallet's VWAP), reading a sell as a
 * buy, or inventing a basis when the data source is unavailable.
 */

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }))

import axios from 'axios'
import { fetchV4Trades, newestTradeTime } from '@/lib/pons/v4Trades'

const TOKEN = '0x600A5bbB67EB4e405f9aAE72f3E049a3888eeF68'
const ETH = '0x0000000000000000000000000000000000000000'
const WALLET = '0x698dd6c03b50c3D4aF12932A0388338bCdD3AAeD'

const get = axios.get as jest.Mock

function leg(address: string, uiAmount: number, decimals = 18) {
  return { address, uiAmount, decimals }
}

function page(items: unknown[], hasNext = false) {
  return { data: { data: { items, hasNext } } }
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.BIRDEYE_API_KEY = 'test-key'
})

describe('fetchV4Trades', () => {
  it('reads a buy from the leg direction, not the side label', async () => {
    get.mockResolvedValueOnce(
      page([
        {
          owner: WALLET, source: 'uniswapV4', txType: 'swap', blockUnixTime: 1000,
          from: leg(ETH, 0.5), to: leg(TOKEN, 1000),
        },
      ])
    )
    const trades = await fetchV4Trades({ token: TOKEN, sinceUnix: 0, quoteAddress: ETH })
    expect(trades).toHaveLength(1)
    expect(trades![0].isBuy).toBe(true)
    expect(trades![0].owner).toBe(WALLET.toLowerCase())
    expect(trades![0].quoteDelta).toBe(500000000000000000n) // 0.5 ETH
    expect(trades![0].tokenDelta).toBe(1000000000000000000000n)
  })

  it('reads a sell when the token is the outgoing leg', async () => {
    get.mockResolvedValueOnce(
      page([
        {
          owner: WALLET, source: 'uniswapV4', txType: 'swap', blockUnixTime: 1000,
          from: leg(TOKEN, 1000), to: leg(ETH, 0.5),
        },
      ])
    )
    const trades = await fetchV4Trades({ token: TOKEN, sinceUnix: 0, quoteAddress: ETH })
    expect(trades![0].isBuy).toBe(false)
  })

  it('ignores non-v4 trades — the curve is already indexed exactly', async () => {
    get.mockResolvedValueOnce(
      page([
        { owner: WALLET, source: 'pons', txType: 'swap', blockUnixTime: 1000, from: leg(ETH, 1), to: leg(TOKEN, 10) },
        { owner: WALLET, source: 'uniswapV4', txType: 'swap', blockUnixTime: 999, from: leg(ETH, 1), to: leg(TOKEN, 10) },
      ])
    )
    const trades = await fetchV4Trades({ token: TOKEN, sinceUnix: 0, quoteAddress: ETH })
    expect(trades).toHaveLength(1)
    expect(trades![0].unixTime).toBe(999)
  })

  it('stops at the cursor and does not re-read old trades', async () => {
    get.mockResolvedValueOnce(
      page(
        [
          { owner: WALLET, source: 'uniswapV4', txType: 'swap', blockUnixTime: 300, from: leg(ETH, 1), to: leg(TOKEN, 10) },
          { owner: WALLET, source: 'uniswapV4', txType: 'swap', blockUnixTime: 100, from: leg(ETH, 1), to: leg(TOKEN, 10) },
        ],
        true
      )
    )
    const trades = await fetchV4Trades({ token: TOKEN, sinceUnix: 200, quoteAddress: ETH })
    expect(trades!.map(t => t.unixTime)).toEqual([300])
    expect(get).toHaveBeenCalledTimes(1) // stopped paging once the cursor was reached
  })

  it('skips trades whose legs are not this token against the quote', async () => {
    get.mockResolvedValueOnce(
      page([
        {
          owner: WALLET, source: 'uniswapV4', txType: 'swap', blockUnixTime: 1000,
          from: leg('0xdead00000000000000000000000000000000beef', 1), to: leg(TOKEN, 10),
        },
      ])
    )
    expect(await fetchV4Trades({ token: TOKEN, sinceUnix: 0, quoteAddress: ETH })).toEqual([])
  })

  it('returns null without a key, so "no source" is distinguishable from "no trades"', async () => {
    delete process.env.BIRDEYE_API_KEY
    expect(await fetchV4Trades({ token: TOKEN, sinceUnix: 0, quoteAddress: ETH })).toBeNull()
    expect(get).not.toHaveBeenCalled()
  })

  it('returns null when the request fails rather than reporting zero trades', async () => {
    get.mockRejectedValueOnce(new Error('503'))
    expect(await fetchV4Trades({ token: TOKEN, sinceUnix: 0, quoteAddress: ETH })).toBeNull()
  })
})

describe('newestTradeTime', () => {
  it('never moves the cursor backwards', () => {
    expect(newestTradeTime([], 500)).toBe(500)
    expect(newestTradeTime([{ unixTime: 100 }] as never, 500)).toBe(500)
    expect(newestTradeTime([{ unixTime: 900 }, { unixTime: 100 }] as never, 500)).toBe(900)
  })
})
