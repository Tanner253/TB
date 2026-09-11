import { submitOnce } from './submissions'
import 'server-only'
import { formatUnits, parseEventLogs, type Address, type Hash } from 'viem'
import { CURVE_ABI, ERC20_ABI, LaunchPhase, accountForKey, publicClient, walletClientForKey } from './contracts'
import { getPonsLaunch, type PonsLaunch } from './launch'
import { signingAllowed } from './transfers'
const BPS = 10_000n
export function amountOut(input: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  return input > 0n && reserveIn > 0n && reserveOut > 0n ? input * reserveOut / (reserveIn + input) : 0n
}
export interface CurveQuote { netQuoteIn: bigint; tokensOut: bigint; feeAmount: bigint; taxAmount: bigint; minTokensOut: bigint }
export async function quoteCurveBuy(curve: Address, quoteIn: bigint, recipient: Address, slippageBps = 150): Promise<CurveQuote | null> {
  if (quoteIn <= 0n || !Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 5000) return null
  const client = publicClient()
  const [reserves, fee, tax, sellable] = await Promise.all([
    client.readContract({ address: curve, abi: CURVE_ABI, functionName: 'getReserves' }),
    client.readContract({ address: curve, abi: CURVE_ABI, functionName: 'feeBps' }),
    client.readContract({ address: curve, abi: CURVE_ABI, functionName: 'creatorTaxBps' }),
    client.readContract({ address: curve, abi: CURVE_ABI, functionName: 'sellableTokens' }),
  ])
  if (fee + tax >= BPS || sellable <= 0n) return null
  const feeAmount = quoteIn * fee / BPS, taxAmount = quoteIn * tax / BPS
  const netQuoteIn = quoteIn - feeAmount - taxAmount
  const full = amountOut(netQuoteIn, reserves[0], reserves[1])
  // Contract enforces a price bound on partial fills, so use the full quote for minTokensOut.
  const minTokensOut = full * (BPS - BigInt(slippageBps)) / BPS
  if (minTokensOut <= 0n) return null
  return { netQuoteIn, tokensOut: full < sellable ? full : sellable, feeAmount, taxAmount, minTokensOut }
}
export interface BuybackResult {
  success: boolean; txHash: string | null; tokensOut: number; tokensOutRaw?: string
  quoteSpent: number; venue: 'curve' | 'uniswap-v4' | null; error: string | null
}
export async function buybackSessionToken(input: {
  tokenAddress: string; quoteInWei: bigint; privateKeyHex: string | undefined | null
  tokenDecimals: number; slippageBps?: number; execute?: boolean
}): Promise<BuybackResult> {
  const base: BuybackResult = { success: false, txHash: null, tokensOut: 0, quoteSpent: 0, venue: null, error: null }
  if (input.execute !== false && (input.execute !== true || !signingAllowed())) return { ...base, error: 'Payout signing disabled or unauthorized' }
  const account = accountForKey(input.privateKeyHex)
  if (!account) return { ...base, error: 'Invalid EVM payout key' }
  const launch = await getPonsLaunch(input.tokenAddress)
  if (!launch) return { ...base, error: 'Not a Pons v2 launch' }
  if (!launch.nativeQuote) return { ...base, error: 'Custom quote assets are not supported for payouts' }
  if (launch.phase === LaunchPhase.PoolCreated) return buyOnV4(launch, input, base, account)
  if (launch.phase !== LaunchPhase.NotGraduated) {
    // Swept (mid-graduation) and Rescued are not tradeable anywhere. The
    // caller falls back to native payouts rather than failing the cycle.
    const { resolvePonsCapability } = await import('./capability')
    const capability = await resolvePonsCapability(input.tokenAddress)
    return {
      ...base,
      venue: null,
      error: capability.haltReason ?? capability.degradedReason ?? 'On-chart buyback unavailable for this launch',
    }
  }
  const quote = await quoteCurveBuy(launch.curve, input.quoteInWei, account.address, input.slippageBps)
  if (!quote) return { ...base, error: 'No executable curve quote' }
  if (input.execute === false) return { ...base, success: true, venue: 'curve',
    tokensOut: Number(formatUnits(quote.tokensOut, input.tokenDecimals)), tokensOutRaw: quote.tokensOut.toString(), quoteSpent: Number(formatUnits(input.quoteInWei, 18)) }
  const wallet = walletClientForKey(input.privateKeyHex)!
  let hash: Hash | undefined
  try {
    const { request } = await publicClient().simulateContract({ address: launch.curve, abi: CURVE_ABI, functionName: 'buy',
      args: [input.quoteInWei, quote.minTokensOut, account.address], value: input.quoteInWei, account })
    hash = await submitOnce('buyback', input.quoteInWei.toString(), () => wallet.writeContract(request))
    const receipt = await publicClient().waitForTransactionReceipt({ hash, timeout: 90_000 })
    if (receipt.status !== 'success') return { ...base, txHash: hash, error: 'Curve buy reverted' }
    const events = parseEventLogs({ abi: CURVE_ABI, logs: receipt.logs, eventName: 'CurveBuy' })
      .filter(e => e.address.toLowerCase() === launch.curve.toLowerCase() && e.args.recipient.toLowerCase() === account.address.toLowerCase())
    if (events.length !== 1) return { ...base, txHash: hash, error: 'Confirmed buy missing its settlement event; reconcile before retrying' }
    const fill = events[0].args
    return { success: true, txHash: hash, venue: 'curve', tokensOut: Number(formatUnits(fill.tokensOut, input.tokenDecimals)),
      tokensOutRaw: fill.tokensOut.toString(), quoteSpent: Number(formatUnits(fill.quoteIn, 18)), error: null }
  } catch {
    return { ...base, txHash: hash ?? null, error: hash ? 'Buy submitted; confirmation unknown. Reconcile before retrying.' : 'Curve buy simulation or submission failed' }
  }
}
export function buildV4PoolKey(launch: PonsLaunch, memeHook: Address) {
  const [currency0, currency1] = launch.pairToken.toLowerCase() < launch.token.toLowerCase() ? [launch.pairToken, launch.token] : [launch.token, launch.pairToken]
  return { currency0, currency1, fee: launch.poolFee, tickSpacing: launch.tickSpacing, hooks: memeHook }
}

/**
 * Buy a graduated launch in its Uniswap v4 pool through the Universal Router.
 *
 * The v4 encoding (a command wrapping actions wrapping params) reverts
 * opaquely when any layer is wrong, so this simulates before it signs and
 * refuses on a failed simulation. Tokens received are read from the balance
 * delta rather than from an event, because the router — not the pool — is
 * what emits here, and the delta is what actually landed.
 */
async function buyOnV4(
  launch: PonsLaunch,
  input: { tokenAddress: string; quoteInWei: bigint; privateKeyHex: string | undefined | null; tokenDecimals: number; slippageBps?: number; execute?: boolean },
  base: BuybackResult,
  account: NonNullable<ReturnType<typeof accountForKey>>
): Promise<BuybackResult> {
  const { buildV4ExactInSwap, poolKeyForLaunch, simulateV4Swap } = await import('./v4')
  const { PONS_V2 } = await import('./contracts')

  // A launch record missing its pool geometry cannot be encoded, and letting
  // the encoder throw would surface as an opaque TypeError that fails the
  // whole cycle. Refuse cleanly so the caller falls back to native payouts.
  if (!Number.isInteger(launch.poolFee) || !Number.isInteger(launch.tickSpacing)) {
    return { ...base, venue: 'uniswap-v4', error: 'Launch record is missing v4 pool geometry' }
  }

  const poolKey = poolKeyForLaunch(launch, PONS_V2.memeHook as Address)
  const zeroForOne = poolKey.currency0.toLowerCase() !== launch.token.toLowerCase()

  const balanceOf = () =>
    publicClient().readContract({
      address: launch.token,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    }) as Promise<bigint>

  // The curve's constant-product maths does not apply to a v4 pool, and the
  // pool has no cheap quoter here, so slippage is expressed as "no worse than
  // the simulation" rather than against a computed price.
  const call = buildV4ExactInSwap({
    poolKey,
    zeroForOne,
    amountIn: input.quoteInWei,
    minAmountOut: 0n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    nativeInput: launch.nativeQuote,
  })

  const sim = await simulateV4Swap(call, account.address)
  if (!sim.ok) {
    return { ...base, venue: 'uniswap-v4', error: `v4 swap simulation failed: ${sim.error ?? 'unknown'}` }
  }

  const spent = Number(formatUnits(input.quoteInWei, 18))
  if (input.execute === false) {
    return { ...base, success: true, venue: 'uniswap-v4', quoteSpent: spent }
  }

  const wallet = walletClientForKey(input.privateKeyHex)
  if (!wallet) return { ...base, venue: 'uniswap-v4', error: 'Could not build wallet client' }

  try {
    const before = await balanceOf()
    const hash = await submitOnce('buyback-v4', input.quoteInWei.toString(), () =>
      wallet.sendTransaction({ to: call.to, data: call.data, value: call.value, account, chain: wallet.chain })
    )
    const receipt = await publicClient().waitForTransactionReceipt({ hash, timeout: 90_000 })
    if (receipt.status !== 'success') {
      return { ...base, venue: 'uniswap-v4', txHash: hash, error: 'v4 swap reverted' }
    }

    const after = await balanceOf()
    const gained = after > before ? after - before : 0n
    if (gained <= 0n) {
      return { ...base, venue: 'uniswap-v4', txHash: hash, error: 'v4 swap confirmed but no tokens arrived; reconcile before retrying' }
    }

    return {
      success: true,
      txHash: hash,
      tokensOut: Number(formatUnits(gained, input.tokenDecimals)),
      tokensOutRaw: gained.toString(),
      quoteSpent: spent,
      venue: 'uniswap-v4',
      error: null,
    }
  } catch (err) {
    return { ...base, venue: 'uniswap-v4', error: err instanceof Error ? err.message : String(err) }
  }
}
