/**
 * Single source of truth for reward pool size — always read from payout wallet on-chain.
 * Do not use MongoDB PoolBalance or POOL_BALANCE_USD env for live UI.
 */

import { getPayoutWalletBalance } from '@/lib/evm/transfer'
import { getEthPrice, formatUsd } from '@/lib/evm/price'
import { config } from '@/lib/config'

export interface LivePoolBalance {
  payoutWalletAddress: string | null
  walletEth: number
  poolEth: number
  poolUsd: number
  ethPrice: number
  poolUsdFormatted: string
  poolEthFormatted: string
  minLossUsd: number
  minLossUsdFormatted: string
  available: boolean
}

export async function getLivePoolBalance(): Promise<LivePoolBalance> {
  const ethPrice = (await getEthPrice()) || 3500
  const walletBalance = await getPayoutWalletBalance()

  if (!walletBalance) {
    return {
      payoutWalletAddress: null,
      walletEth: 0,
      poolEth: 0,
      poolUsd: 0,
      ethPrice,
      poolUsdFormatted: formatUsd(0),
      poolEthFormatted: '0.0000',
      minLossUsd: 0,
      minLossUsdFormatted: formatUsd(0),
      available: false,
    }
  }

  const walletEth = walletBalance.eth || walletBalance.sol || 0
  const poolEth = walletEth * config.poolPercentage
  const poolUsd = poolEth * ethPrice
  const minLossUsd = poolUsd * (config.minLossThresholdPct / 100)

  return {
    payoutWalletAddress: walletBalance.address,
    walletEth,
    poolEth,
    poolUsd,
    ethPrice,
    poolUsdFormatted: formatUsd(poolUsd),
    poolEthFormatted: poolEth.toFixed(4),
    minLossUsd,
    minLossUsdFormatted: formatUsd(minLossUsd),
    available: true,
  }
}
