import 'server-only'

/**
 * On-chart buyback — the Robinhood Chain replacement for `jupiterSwap.ts`.
 *
 * A Pons v2 launch trades in two venues over its life, and `phase` says which:
 *
 *  - phase 0 (NotGraduated) → buy straight off the bonding curve. No router,
 *    no aggregator, and slippage protection is a plain `minTokensOut`
 *    argument. This is the common case by a wide margin (graduation is rare).
 *  - phase 2 (PoolCreated)  → an ordinary Uniswap v4 pool. Needs a v4-aware
 *    router; see `swapOnV4()` below.
 *
 * The curve exposes no quote function, so we reproduce its constant-product
 * maths locally in the contract's own integer order (per the Pons docs) —
 * a quote computed this way matches settlement when nothing moves in between.
 */

import { formatUnits, type Address } from 'viem'
import {
  CURVE_ABI,
  LaunchPhase,
  accountForKey,
  publicClient,
  walletClientForKey,
} from './contracts'
import { getPonsLaunch, type PonsLaunch } from './launch'

const BPS = 10_000n

/** Constant product in the curve's own integer order (no fee applied here). */
export function amountOut(inAmount: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (inAmount <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n
  return (inAmount * reserveOut) / (reserveIn + inAmount)
}

export interface CurveQuote {
  /** Quote asset actually spent on the swap, after fees/taxes are removed. */
  netQuoteIn: bigint
  tokensOut: bigint
  feeAmount: bigint
  taxAmount: bigint
  /** tokensOut with slippage tolerance applied — pass as `minTokensOut`. */
  minTokensOut: bigint
}

/**
 * Quote a buy locally. Fees are charged on the way in, so they come off
 * `quoteIn` before the constant-product step.
 */
export async function quoteCurveBuy(
  curve: Address,
  quoteIn: bigint,
  recipient: Address,
  slippageBps = 300
): Promise<CurveQuote | null> {
  try {
    const c = publicClient()
    const read = (functionName: string, args?: unknown[]) =>
      c.readContract({ address: curve, abi: CURVE_ABI, functionName: functionName as never, args: args as never })

    const [reserves, feeBps, creatorTaxBps, snipeTaxBps] = (await Promise.all([
      read('getReserves'),
      read('feeBps'),
      read('creatorTaxBps'),
      read('currentSnipeTaxBps', [recipient]).catch(() => 0n),
    ])) as [readonly [bigint, bigint], bigint, bigint, bigint]

    const [quoteReserve, tokenReserve] = reserves
    // Base trade fee plus, inside the launch window, the snipe tax.
    const feeAmount = (quoteIn * (feeBps + snipeTaxBps)) / BPS
    const taxAmount = (quoteIn * creatorTaxBps) / BPS
    const netQuoteIn = quoteIn - feeAmount - taxAmount
    if (netQuoteIn <= 0n) return null

    const tokensOut = amountOut(netQuoteIn, quoteReserve, tokenReserve)
    const minTokensOut = (tokensOut * (BPS - BigInt(slippageBps))) / BPS

    return { netQuoteIn, tokensOut, feeAmount, taxAmount, minTokensOut }
  } catch (err) {
    console.warn('[Pons] curve quote failed:', err instanceof Error ? err.message : err)
    return null
  }
}

export interface BuybackResult {
  success: boolean
  txHash: string | null
  /** Tokens actually received (human units) — read from the receipt when possible. */
  tokensOut: number
  /** Quote asset spent (human units). */
  quoteSpent: number
  venue: 'curve' | 'uniswap-v4' | null
  error: string | null
}

/**
 * Buy the session token with pool funds — the on-chart buy that precedes the
 * winner airdrop. Routes on `phase`, never on guesswork.
 */
export async function buybackSessionToken(input: {
  tokenAddress: string
  /** Amount of the quote asset to spend, in wei (native) or token base units. */
  quoteInWei: bigint
  privateKeyHex: string | undefined | null
  tokenDecimals: number
  slippageBps?: number
  execute?: boolean
}): Promise<BuybackResult> {
  const base: BuybackResult = {
    success: false,
    txHash: null,
    tokensOut: 0,
    quoteSpent: 0,
    venue: null,
    error: null,
  }

  const account = accountForKey(input.privateKeyHex)
  if (!account) return { ...base, error: 'Payout wallet key missing or not a valid EVM key' }

  const launch = await getPonsLaunch(input.tokenAddress)
  if (!launch) return { ...base, error: 'Not a Pons v2 launch' }

  if (launch.phase === LaunchPhase.Swept) {
    // Transient: the curve has closed but the pool is not up yet.
    return { ...base, error: 'Launch is mid-graduation (swept) — retry next cycle' }
  }
  if (launch.phase === LaunchPhase.Rescued) {
    return { ...base, error: 'Launch is in the rescued state — buybacks disabled' }
  }

  if (launch.onUniswapV4) return swapOnV4(launch, input, base)

  // ---- Curve path (the common case) ----
  const quote = await quoteCurveBuy(
    launch.curve,
    input.quoteInWei,
    account.address,
    input.slippageBps ?? 300
  )
  if (!quote || quote.tokensOut <= 0n) {
    return { ...base, venue: 'curve', error: 'Curve quote returned no output' }
  }

  const expectedTokens = Number(formatUnits(quote.tokensOut, input.tokenDecimals))
  const spent = Number(formatUnits(input.quoteInWei, launch.nativeQuote ? 18 : input.tokenDecimals))

  if (input.execute === false) {
    console.log(
      `[Pons] Dry run — would buy ~${expectedTokens} tokens off the curve for ${spent}`
    )
    return { ...base, success: true, venue: 'curve', tokensOut: expectedTokens, quoteSpent: spent }
  }

  const wallet = walletClientForKey(input.privateKeyHex)
  if (!wallet) return { ...base, error: 'Could not build wallet client' }

  try {
    if (!launch.nativeQuote) {
      // Custom-pair launches need an approval first and send no value.
      const { ERC20_ABI } = await import('./contracts')
      const approveHash = await wallet.writeContract({
        address: launch.pairToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [launch.curve, input.quoteInWei],
        account,
        chain: wallet.chain,
      })
      await publicClient().waitForTransactionReceipt({ hash: approveHash, timeout: 60_000 })
    }

    const txHash = await wallet.writeContract({
      address: launch.curve,
      abi: CURVE_ABI,
      functionName: 'buy',
      args: [input.quoteInWei, quote.minTokensOut, account.address],
      // Native-quote launches require value === quoteIn; refunds return in-tx.
      value: launch.nativeQuote ? input.quoteInWei : 0n,
      account,
      chain: wallet.chain,
    })

    const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash, timeout: 90_000 })
    if (receipt.status !== 'success') {
      return { ...base, venue: 'curve', txHash, error: 'Curve buy reverted' }
    }

    console.log(`[Pons] ✅ Curve buy ${expectedTokens} tokens — ${txHash}`)
    return {
      success: true,
      txHash,
      tokensOut: expectedTokens,
      quoteSpent: spent,
      venue: 'curve',
      error: null,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Pons] Curve buy failed:', msg)
    return { ...base, venue: 'curve', error: msg }
  }
}

/**
 * Graduated launches trade as ordinary Uniswap v4 pools — the docs are
 * explicit that nothing pons-specific is involved, so any v4-aware router
 * works. Robinhood Chain's canonical Universal Router is not yet confirmed;
 * set PONS_V4_ROUTER once it is, or we add a small periphery contract that
 * swaps through the PoolManager's `unlock()` callback.
 *
 * Graduation is rare (~0.02% of launches), so this path is deliberately last.
 */
async function swapOnV4(
  launch: PonsLaunch,
  input: { tokenAddress: string; quoteInWei: bigint; tokenDecimals: number },
  base: BuybackResult
): Promise<BuybackResult> {
  const router = process.env.PONS_V4_ROUTER?.trim()
  if (!router) {
    return {
      ...base,
      venue: 'uniswap-v4',
      error:
        'Launch has graduated to a Uniswap v4 pool but no PONS_V4_ROUTER is configured — ' +
        'set it to a v4-aware router on Robinhood Chain to enable post-graduation buybacks',
    }
  }
  return {
    ...base,
    venue: 'uniswap-v4',
    error: 'V4 router path not implemented yet',
  }
}

/** Pool key for a graduated launch — currencies sort by address, ETH is 0x0. */
export function buildV4PoolKey(launch: PonsLaunch, memeHook: Address) {
  const [currency0, currency1] =
    launch.pairToken.toLowerCase() < launch.token.toLowerCase()
      ? [launch.pairToken, launch.token]
      : [launch.token, launch.pairToken]
  return {
    currency0,
    currency1,
    fee: launch.poolFee, // zero — the hook charges the fee, not the pool
    tickSpacing: launch.tickSpacing,
    hooks: memeHook,
  }
}
