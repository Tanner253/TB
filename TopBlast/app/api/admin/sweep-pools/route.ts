import { NextRequest, NextResponse } from 'next/server'
import { formatEther, parseEther, type Address } from 'viem'
import { config } from '@/lib/config'
import { verifyCronSecret } from '@/lib/security/cronAuth'
import { requirePlatformDevWalletAddress } from '@/lib/platform/devWallet'
import { isEvmAddress } from '@/lib/pons/session'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Operator-only: move the ETH left in listing payout wallets to the dev wallet.
 *
 * Tenant payout keys only decrypt where TENANT_ENCRYPTION_KEY lives, so this
 * has to run inside the deployment rather than as a local script. The
 * destination is not a parameter: it is always DEV_WALLET_ADDRESS, so a leaked
 * CRON_SECRET cannot redirect pools anywhere else. Nothing moves unless the
 * body says `confirm: true`; without it the call only reports what it would do.
 *
 *   curl -X POST https://topblast.family/api/admin/sweep-pools \
 *     -H "Authorization: Bearer $CRON_SECRET" -H 'content-type: application/json' \
 *     -d '{"tenants":["blasty","pve"],"confirm":true}'
 */

type SweepRow = {
  tenant: string
  wallet: string | null
  balance_eth: number
  gas_reserve_eth: number
  sweep_eth: number
  tx_hash: string | null
  status: 'swept' | 'dry-run' | 'skipped' | 'failed'
  note: string | null
}

const SLUG = /^[a-z0-9-]{1,40}$/

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { tenants?: unknown; confirm?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON body required' }, { status: 400 })
  }
  const tenants = Array.isArray(body.tenants) ? body.tenants.filter((t): t is string => typeof t === 'string' && SLUG.test(t)) : []
  if (tenants.length === 0) {
    return NextResponse.json({ error: 'tenants: a non-empty list of listing slugs is required' }, { status: 400 })
  }
  const confirm = body.confirm === true

  const destination = requirePlatformDevWalletAddress()
  if (!isEvmAddress(destination)) {
    return NextResponse.json({ error: 'DEV_WALLET_ADDRESS is not a valid EVM address' }, { status: 500 })
  }

  const { resolveTenantRuntime } = await import('@/lib/tenant/service')
  const { runWithTenant } = await import('@/lib/tenant/context')
  const { runAuthorizedPayout } = await import('@/lib/payout/payoutAuthContext')
  const { publicClient } = await import('@/lib/pons/contracts')
  const { getPayoutWalletAddress, getWalletBalance, transfer } = await import('@/lib/pons/transfers')

  const rows: SweepRow[] = []

  for (const slug of tenants) {
    const row: SweepRow = {
      tenant: slug,
      wallet: null,
      balance_eth: 0,
      gas_reserve_eth: 0,
      sweep_eth: 0,
      tx_hash: null,
      status: 'skipped',
      note: null,
    }
    rows.push(row)

    let runtime: Awaited<ReturnType<typeof resolveTenantRuntime>> = null
    try {
      runtime = await resolveTenantRuntime(slug)
    } catch (e) {
      row.status = 'failed'
      row.note = `Could not load listing: ${e instanceof Error ? e.message : String(e)}`
      continue
    }
    if (!runtime) {
      row.note = 'No such listing'
      continue
    }

    await runWithTenant(runtime, () =>
      runAuthorizedPayout(async () => {
        const wallet = getPayoutWalletAddress()
        row.wallet = wallet
        if (!wallet) {
          row.status = 'failed'
          row.note = 'Payout key did not decrypt or is not an EVM key'
          return
        }
        if (wallet.toLowerCase() === destination.toLowerCase()) {
          row.note = 'Payout wallet is already the dev wallet'
          return
        }

        const bal = await getWalletBalance(wallet)
        if (!bal || bal.rpcError) {
          row.status = 'failed'
          row.note = `Balance read failed: ${bal?.rpcError ?? 'unknown'}`
          return
        }
        row.balance_eth = bal.sol

        // Leave enough for this one transfer, with headroom for fee movement
        // between the estimate and the send. Arbitrum-style chains add an L1
        // data component to estimateGas, so use that rather than a flat 21000.
        const client = publicClient()
        const balanceWei = parseEther(bal.sol.toFixed(18))
        const [gas, fees] = await Promise.all([
          client.estimateGas({ account: wallet as Address, to: destination as Address, value: 1n }),
          client.estimateFeesPerGas(),
        ])
        const perGas = fees.maxFeePerGas ?? fees.gasPrice ?? 0n
        const reserveWei = (gas * perGas * 3n) / 2n
        row.gas_reserve_eth = Number(formatEther(reserveWei))
        const sweepWei = balanceWei - reserveWei
        if (sweepWei <= 0n) {
          row.note = 'Balance does not cover gas; nothing to sweep'
          return
        }
        row.sweep_eth = Number(formatEther(sweepWei))

        if (!confirm) {
          row.status = 'dry-run'
          row.note = 'Pass confirm:true to send'
          return
        }
        if (!config.executePayouts) {
          row.status = 'failed'
          row.note = 'EXECUTE_PAYOUTS is off for this listing, so signing is disabled'
          return
        }

        const result = await transfer(destination, row.sweep_eth)
        row.tx_hash = result.txHash
        if (result.success) {
          row.status = 'swept'
          console.log(`[Sweep] ${slug}: ${row.sweep_eth} ETH → ${destination} (${result.txHash})`)
        } else {
          row.status = 'failed'
          row.note = result.error
          console.error(`[Sweep] ${slug} failed: ${result.error}`)
        }
      })
    )
  }

  const swept = rows.filter(r => r.status === 'swept').reduce((s, r) => s + r.sweep_eth, 0)
  return NextResponse.json({
    success: rows.every(r => r.status !== 'failed'),
    destination,
    confirmed: confirm,
    total_swept_eth: swept,
    rows,
  })
}
