'use client'

/**
 * Round proof strip for a payout cycle.
 *
 * A payout history is only useful if a holder can check it, so this leads
 * with the ratio that matters — how many intended recipients actually got
 * paid — and only makes the strong "every payment has an on-chain record"
 * claim when that is literally true. The wording comes from
 * lib/payout/cycleProof.ts; nothing is asserted here that isn't derived
 * from the payout rows themselves.
 */

import { deriveCycleProof, type CycleProofInput } from '@/lib/payout/cycleProof'

interface CycleProofProps {
  cycle: CycleProofInput
  className?: string
}

export function CycleProof({ cycle, className = '' }: CycleProofProps) {
  const proof = deriveCycleProof(cycle)
  if (!proof) return null

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-3">
          Round proof
        </span>
        <span className="text-xs font-mono tabular-nums text-ink-2">
          {proof.paid} / {proof.recipients} paid
          <span className={proof.complete ? 'text-sol-mint' : 'text-tb-amber'}> · {proof.pct}%</span>
        </span>
      </div>

      {/* Two-tone bar: what landed, and what did not. */}
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10"
        role="img"
        aria-label={proof.summary}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            proof.complete ? 'bg-sol-mint' : 'bg-tb-amber'
          }`}
          style={{ width: `${proof.pct}%` }}
        />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink-2">
        {proof.complete ? (
          <span className="text-sol-mint">✓ </span>
        ) : null}
        {proof.summary}
      </p>
    </div>
  )
}
