import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Dev-only: simulate a v4 buyback against a real graduated Pons pool.
 *
 * A v4 swap is encoded as commands inside actions inside calldata, and
 * getting any layer wrong reverts opaquely. This runs the real builder
 * through `eth_call` so the encoding is proven before anything is broadcast.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.PONS_PROBE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'pass ?token=0x…' }, { status: 400 })
  const from = (request.nextUrl.searchParams.get('from') ??
    '0x8366a39CC670B4001A1121B8F6A443A643e40951') as `0x${string}`
  const amountIn = BigInt(request.nextUrl.searchParams.get('wei') ?? '1000000000000000') // 0.001 ETH

  try {
    const { getPonsLaunch } = await import('@/lib/pons/launch')
    const { PONS_V2 } = await import('@/lib/pons/contracts')
    const { buildV4ExactInSwap, poolKeyForLaunch, simulateV4Swap, v4RouterAddress } = await import(
      '@/lib/pons/v4'
    )

    const launch = await getPonsLaunch(token)
    if (!launch) return NextResponse.json({ error: 'Not a Pons v2 launch' }, { status: 404 })

    const poolKey = poolKeyForLaunch(launch, PONS_V2.memeHook as `0x${string}`)
    // ETH is the zero address, so it always sorts to currency0.
    const zeroForOne = poolKey.currency0.toLowerCase() !== launch.token.toLowerCase()

    const call = buildV4ExactInSwap({
      poolKey,
      zeroForOne,
      amountIn,
      minAmountOut: 0n, // simulation only — we are validating encoding, not price
      deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
      nativeInput: launch.nativeQuote,
    })

    const sim = await simulateV4Swap(call, from)

    return NextResponse.json({
      router: v4RouterAddress(),
      launch: { token: launch.token, phase: launch.phase, nativeQuote: launch.nativeQuote },
      poolKey,
      zeroForOne,
      amountInWei: amountIn.toString(),
      calldataBytes: (call.data.length - 2) / 2,
      valueWei: call.value.toString(),
      simulation: sim,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
