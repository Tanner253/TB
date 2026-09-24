'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import type { TokenPayoutHighlights } from '@/lib/payout/payoutHighlights'

const POLL_MS = 60_000

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86_400)}d ago`
}

function useTokenPayoutHighlights(mint: string | null, refreshKey?: unknown) {
  const [data, setData] = useState<TokenPayoutHighlights | null>(null)

  useEffect(() => {
    if (!mint) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/payout-highlights?mint=${encodeURIComponent(mint)}`)
        const json = await res.json()
        if (!cancelled && json.success) setData(json.data)
      } catch {
        // keep the last good figures on a failed poll
      }
    }
    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // refreshKey: refetch the moment the session rolls to a new cycle
  }, [mint, refreshKey])

  return data?.token_mint.toLowerCase() === mint?.toLowerCase() ? data : null
}

/**
 * The token's payout record, pinned above the leaderboard: the single biggest
 * blast and everything paid out so far. Proof the pot actually pays, for THIS
 * token only — a holder deciding whether to stay in wants that before rules.
 */
export function PayoutHighlights({
  mint,
  symbol,
  refreshKey,
  className = '',
}: {
  mint: string | null
  symbol: string
  refreshKey?: unknown
  className?: string
}) {
  const h = useTokenPayoutHighlights(mint, refreshKey)
  if (!h) return null

  if (!h.largest) {
    return (
      <div
        className={`rounded-2xl border border-dashed border-sol-purple/30 bg-sol-purple/[0.04] px-5 py-4 text-center ${className}`}
      >
        <p className="text-sm text-ink-2">
          <span className="mr-1.5" aria-hidden>🏆</span>
          No blasts yet for <span className="font-semibold text-sol-purple">${symbol}</span>. The first
          payout lands when the timer hits zero, and its biggest winner gets pinned right here.
        </p>
      </div>
    )
  }

  const big = h.largest

  return (
    <motion.div
      initial={{ opacity: 0.6, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`payout-highlights relative overflow-hidden rounded-2xl border border-sol-purple/35 bg-gradient-to-br from-sol-purple/20 via-sol-purple/[0.07] to-transparent ${className}`}
    >
      {/* slow sheen, so the record reads as a trophy rather than another stat box */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent skew-x-[-20deg]"
        animate={{ x: ['0%', '450%'] }}
        transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
      />
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-sol-purple/25 blur-3xl" />

      <div className="relative grid gap-px sm:grid-cols-[1.15fr_1fr]">
        {/* Biggest blast */}
        <div className="p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sol-purple">
            <motion.span
              aria-hidden
              className="text-base"
              animate={{ rotate: [0, -12, 12, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 4 }}
            >
              🏆
            </motion.span>
            Biggest blast · ${symbol}
          </div>
          <div className="text-4xl font-bold leading-none text-ink sm:text-5xl tabular-nums">
            <AnimatedNumber value={big.amount_usd} format="currency" />
          </div>
          <div className="mt-2 font-mono text-sm text-ink-2 tabular-nums">
            {big.amount} {big.amount_unit === 'tokens' ? `$${symbol}` : big.amount_unit}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-3">
            {big.explorer_url ? (
              <a
                href={big.explorer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-ink-2 underline decoration-sol-purple/40 underline-offset-2 hover:text-sol-purple"
                title="View the payout transaction"
              >
                {big.wallet_display} ↗
              </a>
            ) : (
              <span className="font-mono text-ink-2">{big.wallet_display}</span>
            )}
            {big.drawdown_pct != null && big.drawdown_pct > 0 ? (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-400">
                was down {big.drawdown_pct.toFixed(1)}%
              </span>
            ) : null}
            <span>
              cycle {big.cycle} · {timeAgo(big.paid_at)}
            </span>
          </div>
        </div>

        {/* All-time total */}
        <div className="border-t border-sol-purple/20 p-5 sm:border-l sm:border-t-0 sm:p-6">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-sol-purple">
            Total blasted to holders
          </div>
          <div className="text-4xl font-bold leading-none text-ink sm:text-5xl tabular-nums">
            <AnimatedNumber value={h.total_paid_usd} format="currency" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ['Payouts', h.winner_payouts],
              ['Wallets', h.wallets_paid],
              ['Cycles', h.cycles_paid],
            ].map(([label, n]) => (
              <div key={label as string} className="rounded-lg bg-paper/40 px-2 py-1.5 ring-1 ring-sol-purple/15">
                <span className="block font-mono text-base font-bold text-ink tabular-nums">{n}</span>
                <span className="block text-[10px] uppercase tracking-wide text-ink-3">{label}</span>
              </div>
            ))}
          </div>
          {h.last_paid_at ? (
            <p className="mt-3 text-xs text-ink-3">Last payout {timeAgo(h.last_paid_at)}</p>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}
