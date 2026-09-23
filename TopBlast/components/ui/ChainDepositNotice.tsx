'use client'

import { CHAIN_DEPOSIT_WARNING, CHAIN_ID, CHAIN_NAME } from '@/lib/marketing/urls'

/**
 * Where the money has to be sent, stated next to the address.
 *
 * Every deposit prompt on the site previously said "send ETH" without naming
 * the network. ETH exists on a dozen chains and the payout wallet is an
 * ordinary 0x address that looks identical on all of them, so a creator
 * funding a pool from the wrong network loses the funds outright — there is no
 * recovery path and no error to react to. This is deliberately loud.
 */
export function ChainDepositNotice({
  variant = 'block',
  className = '',
}: {
  /** block = full callout beside an address; inline = one line under a field. */
  variant?: 'block' | 'inline'
  className?: string
}) {
  if (variant === 'inline') {
    return (
      <p className={`text-xs text-tb-amber ${className}`}>
        <span aria-hidden>⚠ </span>
        {CHAIN_NAME} only (chain ID {CHAIN_ID}) — funds sent on another network are lost.
      </p>
    )
  }

  return (
    <div
      className={`rounded-xl border border-tb-amber/40 bg-tb-amber/10 px-3 py-2.5 ${className}`}
      role="note"
    >
      <p className="flex items-start gap-2 text-xs leading-relaxed text-tb-amber">
        <span aria-hidden className="mt-px shrink-0">
          ⚠
        </span>
        <span>
          <strong className="font-semibold">
            {CHAIN_NAME} only · chain ID {CHAIN_ID}
          </strong>
          <br />
          {CHAIN_DEPOSIT_WARNING}
        </span>
      </p>
    </div>
  )
}
