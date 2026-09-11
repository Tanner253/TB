import 'server-only'

/**
 * Uniswap v4 execution for graduated Pons launches.
 *
 * A launch that graduates stops trading on its bonding curve and starts
 * trading in an ordinary v4 pool, so the buyback has to go through a
 * v4-aware router instead of calling `curve.buy()`.
 *
 * The canonical Universal Router on Robinhood Chain was not documented
 * anywhere, so it was identified on-chain: of everything calling the v4
 * PoolManager, exactly one contract carries the full Universal Router
 * selector set (`execute(bytes,bytes[],uint256)`, `execute(bytes,bytes[])`,
 * `poolManager()`, `unlockCallback(bytes)`, `msgSender()`), and its
 * `poolManager()` returns our PoolManager. Permit2 is deployed at its
 * canonical address too, though a native-ETH swap never touches it —
 * there is no ERC-20 to approve on the way in.
 *
 * `PONS_V4_ROUTER` still overrides the default, because an address found by
 * inference should be overridable without a deploy.
 */

import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbi,
  parseAbiParameters,
  zeroAddress,
  type Address,
} from 'viem'
import { publicClient } from './contracts'
import type { PonsLaunch } from './launch'

/** Verified on-chain: poolManager() === the Pons v4 PoolManager. */
export const UNIVERSAL_ROUTER = '0x8876789976dEcBfCbBbe364623C63652db8C0904' as Address

export const V4_POOL_MANAGER = '0x8366a39CC670B4001A1121B8F6A443A643e40951' as Address

export const UNIVERSAL_ROUTER_ABI = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) payable',
])

/** Universal Router command byte for a v4 swap. */
const CMD_V4_SWAP = '10'

/** v4 Actions. Order matters: swap, pay what you owe, take what you are owed. */
const ACTION_SWAP_EXACT_IN_SINGLE = '06'
const ACTION_SETTLE_ALL = '0c'
const ACTION_TAKE_ALL = '0f'

export function v4RouterAddress(): Address {
  const override = process.env.PONS_V4_ROUTER?.trim()
  return (override || UNIVERSAL_ROUTER) as Address
}

export interface V4PoolKey {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  hooks: Address
}

/**
 * Pool key for a graduated launch. v4 sorts currencies by address and native
 * ETH is the zero address, so an ETH-quoted launch always has ETH as
 * currency0 — which also makes an ETH-in swap `zeroForOne`.
 */
export function poolKeyForLaunch(launch: PonsLaunch, memeHook: Address): V4PoolKey {
  const quote = launch.nativeQuote ? zeroAddress : launch.pairToken
  const [currency0, currency1] =
    quote.toLowerCase() < launch.token.toLowerCase()
      ? [quote, launch.token]
      : [launch.token, quote]

  return {
    currency0: currency0 as Address,
    currency1: currency1 as Address,
    // Zero: the Pons hook charges the fee, not the pool.
    fee: launch.poolFee,
    tickSpacing: launch.tickSpacing,
    hooks: memeHook,
  }
}

const POOL_KEY_PARAMS = parseAbiParameters(
  '((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, bytes hookData)'
)
const CURRENCY_AMOUNT_PARAMS = parseAbiParameters('address currency, uint256 amount')
const V4_INPUT_PARAMS = parseAbiParameters('bytes actions, bytes[] params')

export interface V4SwapCall {
  to: Address
  data: `0x${string}`
  /** Native value to attach — equals amountIn for an ETH-in swap. */
  value: bigint
}

/**
 * Builds the Universal Router calldata for "spend exactly `amountIn` of the
 * quote asset, receive at least `minAmountOut` of the token".
 */
export function buildV4ExactInSwap(input: {
  poolKey: V4PoolKey
  /** True when the input currency is currency0. */
  zeroForOne: boolean
  amountIn: bigint
  minAmountOut: bigint
  deadline: bigint
  /** Native input needs the value attached; ERC-20 input does not. */
  nativeInput: boolean
}): V4SwapCall {
  const inputCurrency = input.zeroForOne ? input.poolKey.currency0 : input.poolKey.currency1
  const outputCurrency = input.zeroForOne ? input.poolKey.currency1 : input.poolKey.currency0

  const actions = `0x${ACTION_SWAP_EXACT_IN_SINGLE}${ACTION_SETTLE_ALL}${ACTION_TAKE_ALL}` as const

  const swapParams = encodeAbiParameters(POOL_KEY_PARAMS, [
    {
      poolKey: input.poolKey,
      zeroForOne: input.zeroForOne,
      amountIn: input.amountIn,
      amountOutMinimum: input.minAmountOut,
      hookData: '0x',
    },
  ] as never)

  // SETTLE_ALL caps what the router may pull from us; TAKE_ALL floors what we
  // must receive. Together they bound the trade on both sides.
  const settle = encodeAbiParameters(CURRENCY_AMOUNT_PARAMS, [inputCurrency, input.amountIn])
  const take = encodeAbiParameters(CURRENCY_AMOUNT_PARAMS, [outputCurrency, input.minAmountOut])

  const v4Input = encodeAbiParameters(V4_INPUT_PARAMS, [actions, [swapParams, settle, take]])

  const data = encodeFunctionData({
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: 'execute',
    args: [`0x${CMD_V4_SWAP}`, [v4Input], input.deadline],
  })

  return {
    to: v4RouterAddress(),
    data,
    value: input.nativeInput ? input.amountIn : 0n,
  }
}

export interface V4SimulationResult {
  ok: boolean
  error: string | null
}

/**
 * Dry-runs the swap with `eth_call`. Encoding a v4 swap wrong fails in ways
 * that are hard to read from a reverted transaction, so the execution path
 * simulates first and refuses rather than broadcasting a guess.
 */
export async function simulateV4Swap(
  call: V4SwapCall,
  from: Address
): Promise<V4SimulationResult> {
  try {
    await publicClient().call({
      account: from,
      to: call.to,
      data: call.data,
      value: call.value,
    })
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
