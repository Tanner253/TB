import 'server-only'

/**
 * Reading Pons v2 launch state.
 *
 * `phase` is the authoritative signal for where a launch trades — the docs are
 * explicit that you must never infer it from balances or events. Everything
 * that routes a buyback or reads a curve goes through here.
 */

import { isAddress, type Address } from 'viem'
import {
  CURVE_ABI,
  FACTORY_ABI,
  LaunchPhase,
  PONS_V2,
  isNativeAsset,
  publicClient,
} from './contracts'

export interface PonsLaunch {
  token: Address
  curve: Address
  deployer: Address
  /** The wallet allowed to claim creator fees from the escrow. */
  creatorFeeRecipient: Address
  /** Quote asset — zero address means the launch is priced in native ETH. */
  pairToken: Address
  graduationThreshold: bigint
  poolFee: number
  tickSpacing: number
  creatorTaxBps: number
  buybackEnabled: boolean
  phase: LaunchPhase
  exists: boolean
  /** Convenience flags derived from `phase`. */
  onCurve: boolean
  onUniswapV4: boolean
  nativeQuote: boolean
}

/** Reads the factory launch record. Returns null for non-Pons-v2 tokens. */
export async function getPonsLaunch(token: string): Promise<PonsLaunch | null> {
  if (!isAddress(token, { strict: false })) return null
  try {
    const raw = await publicClient().readContract({
      address: PONS_V2.factory,
      abi: FACTORY_ABI,
      functionName: 'getLaunchedToken',
      args: [token as Address],
    })

    if (!raw?.exists) return null
    const phase = Number(raw.phase) as LaunchPhase

    return {
      token: raw.token,
      curve: raw.curve,
      deployer: raw.deployer,
      creatorFeeRecipient: raw.creatorFeeRecipient,
      pairToken: raw.pairToken,
      graduationThreshold: raw.graduationThreshold,
      poolFee: Number(raw.poolFee),
      tickSpacing: Number(raw.tickSpacing),
      creatorTaxBps: Number(raw.creatorTaxBps),
      buybackEnabled: raw.buybackEnabled,
      phase,
      exists: raw.exists,
      onCurve: phase === LaunchPhase.NotGraduated,
      onUniswapV4: phase === LaunchPhase.PoolCreated,
      nativeQuote: isNativeAsset(raw.pairToken),
    }
  } catch (err) {
    console.warn(
      `[Pons] getLaunchedToken failed for ${token.slice(0, 10)}…:`,
      err instanceof Error ? err.message : err
    )
    return null
  }
}

export interface CurveState {
  /** Pricing reserve — includes the virtual "phantom" quote. */
  quoteReserve: bigint
  /** Quote actually collected and still held, net of fees. */
  realQuoteReserve: bigint
  tokenReserve: bigint
  /** Tokens still buyable before the curve closes. */
  sellableTokens: bigint
  readyToGraduate: boolean
  feeBps: bigint
  creatorTaxBps: bigint
}

export async function getCurveState(curve: Address): Promise<CurveState | null> {
  try {
    const c = publicClient()
    const read = (functionName: string) =>
      c.readContract({ address: curve, abi: CURVE_ABI, functionName: functionName as never })

    const [quoteReserve, realQuoteReserve, tokenReserve, sellableTokens, readyToGraduate, feeBps, creatorTaxBps] =
      (await Promise.all([
        read('quoteReserve'),
        read('realQuoteReserve'),
        read('tokenReserve'),
        read('sellableTokens'),
        read('readyToGraduate'),
        read('feeBps'),
        read('creatorTaxBps'),
      ])) as [bigint, bigint, bigint, bigint, boolean, bigint, bigint]

    return { quoteReserve, realQuoteReserve, tokenReserve, sellableTokens, readyToGraduate, feeBps, creatorTaxBps }
  } catch (err) {
    console.warn('[Pons] curve state read failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Graduation progress for UI — mirrors what the old pump.fun bonding-curve
 * progress showed. `null` when the launch has already graduated.
 */
export async function getGraduationProgress(
  launch: PonsLaunch
): Promise<{ pairedQuote: bigint; threshold: bigint; pct: number } | null> {
  if (!launch.onCurve) return null
  const state = await getCurveState(launch.curve)
  if (!state) return null
  const threshold = launch.graduationThreshold
  if (threshold <= 0n) return null
  const pct = Number((state.realQuoteReserve * 10_000n) / threshold) / 100
  return {
    pairedQuote: state.realQuoteReserve,
    threshold,
    pct: Math.max(0, Math.min(100, pct)),
  }
}
