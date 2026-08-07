/**
 * Single source of truth for reward pool size — payout wallet SOL balance on-chain.
 */

import { getPayoutWalletBalance } from '@/lib/solana/transfer'
import { getSolPrice, formatUsd } from '@/lib/solana/price'
import { config } from '@/lib/config'
import { maxDistributableSol } from '@/lib/payout/payoutSecurity'

export interface LivePoolBalance {
  payoutWalletAddress: string | null
  walletSol: number
  poolSol: number
  poolUsd: number
  solPrice: number
  poolUsdFormatted: string
  poolSolFormatted: string
  /** @deprecated use poolSol — kept for API field compatibility */
  walletEth: number
  poolEth: number
  ethPrice: number
  poolEthFormatted: string
  minLossUsd: number
  minLossUsdFormatted: string
  available: boolean
  /** True when address is known but on-chain balance could not be fetched */
  balanceLookupFailed?: boolean
}

export async function getLivePoolBalance(): Promise<LivePoolBalance> {
  const solPrice = (await getSolPrice()) || 150
  const walletBalance = await getPayoutWalletBalance()

  if (!walletBalance) {
    return {
      payoutWalletAddress: null,
      walletSol: 0,
      poolSol: 0,
      poolUsd: 0,
      solPrice,
      poolUsdFormatted: formatUsd(0),
      poolSolFormatted: '0.0000',
      walletEth: 0,
      poolEth: 0,
      ethPrice: solPrice,
      poolEthFormatted: '0.0000',
      minLossUsd: 0,
      minLossUsdFormatted: formatUsd(0),
      available: false,
      balanceLookupFailed: false,
    }
  }

  if (walletBalance.rpcError) {
    return {
      payoutWalletAddress: walletBalance.address,
      walletSol: 0,
      poolSol: 0,
      poolUsd: 0,
      solPrice,
      poolUsdFormatted: formatUsd(0),
      poolSolFormatted: '0.0000',
      walletEth: 0,
      poolEth: 0,
      ethPrice: solPrice,
      poolEthFormatted: '0.0000',
      minLossUsd: 0,
      minLossUsdFormatted: formatUsd(0),
      available: false,
      balanceLookupFailed: true,
    }
  }

  const walletSol = walletBalance.sol
  const poolSol = maxDistributableSol(walletSol)
  const poolUsd = poolSol * solPrice
  const minLossUsd = poolUsd * (config.minLossThresholdPct / 100)

  return {
    payoutWalletAddress: walletBalance.address,
    walletSol,
    poolSol,
    poolUsd,
    solPrice,
    poolUsdFormatted: formatUsd(poolUsd),
    poolSolFormatted: poolSol.toFixed(4),
    walletEth: walletSol,
    poolEth: poolSol,
    ethPrice: solPrice,
    poolEthFormatted: poolSol.toFixed(4),
    minLossUsd,
    minLossUsdFormatted: formatUsd(minLossUsd),
    available: true,
  }
}
