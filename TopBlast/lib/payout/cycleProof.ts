/**
 * Round proof — what a cycle can actually demonstrate, not what it intended.
 *
 * A payout history is only worth anything if a holder can check it, so the
 * numbers here are deliberately conservative:
 *
 *   - Only WINNER payouts count as recipients. The protocol fee is a transfer
 *     to the treasury, not someone being paid, and folding it in would pad
 *     the ratio.
 *   - A payment counts as evidenced only when it both succeeded AND carries a
 *     transaction hash. A success with no hash is real money we cannot point
 *     at, and it is reported as exactly that rather than rounded up.
 *   - `complete` requires every recipient paid AND every payment evidenced.
 *     The strong claim ("every payment has an on-chain record") is only ever
 *     made when it is literally true.
 *
 * This exists because the alternative — a confident "100%" badge that is
 * sometimes wrong — is worse than no badge at all.
 */

export interface CycleProofInput {
  payouts: Array<{
    type: 'dev_fee' | 'winner'
    status: 'success' | 'failed'
    tx_hash: string | null
  }>
  success_count?: number
  failed_count?: number
}

export interface CycleProof {
  /** Winner payouts the cycle set out to make. */
  recipients: number
  /** Winner payouts that landed. */
  paid: number
  /** Paid AND linkable to a transaction. */
  evidenced: number
  /** Winner payouts that never landed. */
  notSent: number
  /** 0–100, rounded. 100 only when every recipient was paid. */
  pct: number
  /** Every recipient paid and every payment evidenced. */
  complete: boolean
  /** One sentence, safe to render verbatim. */
  summary: string
}

export function deriveCycleProof(cycle: CycleProofInput): CycleProof | null {
  const winners = cycle.payouts.filter(p => p.type === 'winner')
  if (winners.length === 0) return null

  const paidRows = winners.filter(p => p.status === 'success')
  const recipients = winners.length
  const paid = paidRows.length
  const evidenced = paidRows.filter(p => Boolean(p.tx_hash)).length
  const notSent = recipients - paid
  const pct = Math.round((paid / recipients) * 100)
  const complete = paid === recipients && evidenced === recipients

  return {
    recipients,
    paid,
    evidenced,
    notSent,
    pct,
    complete,
    summary: summarize({ recipients, paid, evidenced, notSent, complete }),
  }
}

function summarize(p: {
  recipients: number
  paid: number
  evidenced: number
  notSent: number
  complete: boolean
}): string {
  const noun = p.recipients === 1 ? 'recipient' : 'recipients'

  if (p.complete) {
    return `All ${p.recipients} ${noun} paid — every payment has an on-chain record.`
  }

  if (p.paid === p.recipients) {
    // Everyone got paid, but we cannot link all of it.
    const missing = p.recipients - p.evidenced
    return `All ${p.recipients} ${noun} paid — ${p.evidenced} with an on-chain record, ${missing} still indexing.`
  }

  if (p.paid === 0) {
    return `No ${noun} paid this cycle — ${p.notSent} did not land.`
  }

  return `${p.paid} of ${p.recipients} ${noun} paid — ${p.evidenced} with an on-chain record, ${p.notSent} did not land.`
}
