/** Map Birdeye /defi/v3/token/holder wallet-mode rows → TopBlast holder inputs. */

export interface BirdeyeWalletHolderRow {
  owner?: string
  amount?: number
  ui_amount?: number
  avg_buy_price?: number
  avgBuyPrice?: number
  avg_sell_price?: number
  avgSellPrice?: number
  first_trade_unix_time?: number
  firstTradeUnixTime?: number
}

export interface MappedHolderSnapshot {
  wallet: string
  balance: number
  vwap: number | null
  firstBuyTimestamp: number | null
  hasSold: boolean
  drawdownPct: number | null
  lossUsd: number | null
}

export function mapBirdeyeWalletHolderRow(
  row: BirdeyeWalletHolderRow,
  tokenPrice: number | null
): MappedHolderSnapshot {
  const balance = row.ui_amount ?? row.amount ?? 0
  const rawVwap = row.avg_buy_price ?? row.avgBuyPrice ?? 0
  const vwap = rawVwap > 0 ? rawVwap : null
  const firstUnix = row.first_trade_unix_time ?? row.firstTradeUnixTime
  const firstBuyTimestamp = firstUnix ? firstUnix * 1000 : null
  const avgSell = row.avg_sell_price ?? row.avgSellPrice ?? 0
  const hasSold = avgSell > 0

  let drawdownPct: number | null = null
  let lossUsd: number | null = null
  if (vwap && tokenPrice && tokenPrice > 0) {
    drawdownPct = ((tokenPrice - vwap) / vwap) * 100
    if (tokenPrice < vwap) {
      lossUsd = (vwap - tokenPrice) * balance
    } else {
      lossUsd = 0
    }
  }

  return {
    wallet: String(row.owner || ''),
    balance,
    vwap,
    firstBuyTimestamp,
    hasSold,
    drawdownPct,
    lossUsd,
  }
}
