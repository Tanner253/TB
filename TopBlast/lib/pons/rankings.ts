import { isContractBytecode } from '@/lib/evm/bytecode'
import { getV1Launch } from './v1'
import 'server-only'
import mongoose from 'mongoose'
import { config } from '@/lib/config'
import { indexLaunchHolders } from './holderIndex'
import { publicClient, ERC20_ABI, getChainId, isTestnet } from './contracts'
import { ethPrice, resolvedPrice } from './price'
import { getLivePoolBalance } from '@/lib/payout/poolBalance'
import { getRankingsKey } from '@/lib/tenant/keys'
import { loadLastWinCycleByWallet } from '@/lib/payout/winnerPersistence'
import { ensureLiquidityPoolAddresses } from '@/lib/eligibility/liquidityPools'
import { buildRankingRowsFromBirdeye, persistRankingsSnapshot, type RefreshLiveHolderRankingsResult } from '@/lib/tracker/birdeyeRankings'
import type { HolderRefreshSession } from '@/lib/platform/holderRefreshPolicy'
import connectDB from '@/lib/db'

export async function assertPonsReady() {
  const { resolvePonsCapability } = await import('./capability')
  const capability = await resolvePonsCapability(config.tokenMint)
  if (capability.halted) throw new Error(capability.haltReason ?? 'Pons launch is not payable')
  if (capability.degradedReason) console.warn(`[Pons] Degraded service: ${capability.degradedReason}`)
  await connectDB()
  const checkpoint = await mongoose.connection.db!.collection('pons_holder_checkpoints').findOne({ _id: (getChainId() + ':' + config.tokenMint.toLowerCase()) as any })
  const head = await publicClient().getBlockNumber()
  if (!checkpoint || head - BigInt(checkpoint.cursor) > 1000n) throw new Error('Pons indexing is incomplete or stale')
}
export async function refreshPonsRankings(options?: { force?: boolean; session?: HolderRefreshSession }): Promise<RefreshLiveHolderRankingsResult> {
  const { CurrentRankings } = await import('@/lib/db/models')
  await connectDB()
  try {
    if (isTestnet()) throw new Error('Pons testnet deployment not configured')
    const { resolvePonsCapability } = await import('./capability')
    const capability = await resolvePonsCapability(config.tokenMint)
    const v1 = capability.launch ? null : await getV1Launch(config.tokenMint)
    if (capability.halted && !v1?.nativeQuote) throw new Error(capability.haltReason ?? 'Launch is not a supported ETH market')
    const index = await indexLaunchHolders({ tokenAddress: config.tokenMint })
    if (!index) throw new Error('Pons indexing unavailable')
    if (index.incomplete) throw new Error('Pons historical backfill is still running')
    const [price, eth, pool] = await Promise.all([resolvedPrice(), ethPrice(), getLivePoolBalance()])
    if (!price || !eth) throw new Error('Pons pricing unavailable')
    await ensureLiquidityPoolAddresses(config.tokenMint)
    const lastWinByWallet = await loadLastWinCycleByWallet(index.holders.map(h => h.wallet))
    const { getCurrentPayoutCycle } = await import('@/lib/payout/executor')
    const rows = buildRankingRowsFromBirdeye(index.holders.map(h => ({
      ...h, vwap: h.vwap == null ? null : h.vwap * eth, firstBuyTimestamp: h.firstBuyAt?.getTime() ?? null,
    })), { mint: config.tokenMint, tokenPrice: price.price, poolUsd: pool.poolUsd, currentCycle: getCurrentPayoutCycle(),
      lastWinByWallet, minTokenHolding: config.minTokenHolding, tokenDecimals: config.tokenDecimals })
    const counts = await persistRankingsSnapshot(rows, price.price, { reportedHolderCount: index.holders.length, markHolderFetch: true })
    return { refreshed: true, holderCount: index.holders.length, ...counts, apiCalls: 0 }
  } catch (error) {
    // Never leave yesterday's eligible winners payable when the current scan failed.
    await CurrentRankings.updateOne({ key: getRankingsKey() }, { $set: { eligibleCount: 0, 'rankings.$[].isEligible': false, 'rankings.$[].ineligibleReason': 'Pons indexing or trading unavailable' } })
    throw error
  }
}
export async function liveHolderBalances(mint: string, limit: number) {
  const indexed = await indexLaunchHolders({ tokenAddress: mint })
  if (!indexed || indexed.incomplete) throw new Error('Pons holder index incomplete')
  const token = mint as `0x${string}`
  const { withRpcRetry } = await import('@/lib/evm/retry')
  const decimals = await withRpcRetry(() => publicClient().readContract({ address: token, abi: ERC20_ABI, functionName: 'decimals' }))
  const rows = []
  // Small batches with per-call retry: the RPC rate-limits bursts, and one
  // refused call used to throw away the whole refresh.
  const BATCH = 5
  for (let offset = 0; offset < Math.min(limit, indexed.holders.length); offset += BATCH) {
    rows.push(...await Promise.all(indexed.holders.slice(offset, Math.min(offset + BATCH, limit)).map(async h => ({
      wallet: h.wallet,
      balance: Number(await withRpcRetry(() => publicClient().readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [h.wallet as `0x${string}`] }))),
      // isContractBytecode, not `!== '0x'`: an EIP-7702 delegated EOA has code
      // and is still a person. The bare check deleted real holders from payouts.
      isContract: isContractBytecode(await withRpcRetry(() => publicClient().getBytecode({ address: h.wallet as `0x${string}` }))),
    }))))
  }
  return rows
}
