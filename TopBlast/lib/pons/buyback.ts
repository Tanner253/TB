import { submitOnce } from './submissions'
import 'server-only'
import { formatUnits, parseEventLogs, type Address, type Hash } from 'viem'
import { CURVE_ABI, LaunchPhase, accountForKey, publicClient, walletClientForKey } from './contracts'
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
  if (launch.phase !== LaunchPhase.NotGraduated) return { ...base, error: 'Payouts paused: graduated or inactive launch requires V4 execution and cost basis support' }
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
