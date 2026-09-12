'use client'

/**
 * Platform-wide buyback pool.
 *
 * The point of this panel is that the flywheel is checkable, so it draws a
 * hard line between two things a reader would otherwise conflate: fees the
 * protocol has collected, and supply it has actually destroyed. Burned supply
 * counts confirmed burns only.
 *
 * It also states plainly whether buybacks are running automatically. Claiming
 * a live flywheel while fees sit in a treasury waiting for someone to press a
 * button is the exact thing this panel exists to disprove.
 */

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface FlywheelData {
  feesCollectedEth: number
  feesCollectedUsd: number
  spentEth: number
  tokensBurned: number
  purchases: number
  pendingBurns: number
  lastPurchaseAt: string | null
  live: boolean
  automated: boolean
  token: { symbol: string; mint: string | null }
  rates: { feePct: number; buybackPctOfPool: number; opsPctOfPool: number }
}

function fmtEth(n: number): string {
  if (n <= 0) return '0'
  if (n < 0.000001) return '<0.000001'
  return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
}

function fmtTokens(n: number): string {
  if (n <= 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(2)
}

function fmtUsd(n: number): string {
  if (n <= 0) return '$0'
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

export function FlywheelPool() {
  const [data, setData] = useState<FlywheelData | null>(null)
  const [failed, setFailed] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    let alive = true
    fetch('/api/flywheel')
      .then(r => r.json())
      .then(json => {
        if (alive && json?.success) setData(json.data)
        else if (alive) setFailed(true)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  if (failed || !data) return null

  const symbol = data.token.symbol || 'TOPBLAST'

  const metrics = [
    // USD only: this total spans the Solana era and Robinhood Chain, so no
    // single native unit describes it honestly.
    { label: 'Fees collected', value: fmtUsd(data.feesCollectedUsd), sub: 'all sessions, all time' },
    { label: 'Spent on buybacks', value: `${fmtEth(data.spentEth)} ETH`, sub: `${data.purchases} purchase${data.purchases === 1 ? '' : 's'}` },
    { label: 'Supply burned', value: `${fmtTokens(data.tokensBurned)} $${symbol}`, sub: data.live ? 'confirmed on-chain' : 'no burns yet' },
  ]

  return (
    <section className="mb-14 md:mb-20" aria-labelledby="flywheel-heading">
      <div className="relative overflow-hidden rounded-2xl border border-sol-purple/25 bg-card/70 p-6 sm:p-8 backdrop-blur">
        <div
          className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <div className="flex flex-wrap items-center gap-3">
            <p className="inline-flex items-center gap-2 rounded-full border border-sol-purple/40 bg-sol-purple/10 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-sol-purple">
              🔥 Platform-wide buyback pool
            </p>
            {/* Never imply automation that isn't switched on. */}
            <span
              className={`text-[0.7rem] font-semibold uppercase tracking-[0.14em] ${
                data.automated ? 'text-sol-mint' : 'text-tb-amber'
              }`}
            >
              {data.automated ? '● Automated every cycle' : '● Manual — automation staged'}
            </span>
          </div>

          <h2
            id="flywheel-heading"
            className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink text-balance"
          >
            Every listing buys back ${symbol}
          </h2>

          <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-ink-2 text-balance">
            Each payout cycle pays a flat {data.rates.feePct}% protocol fee.{' '}
            {data.rates.buybackPctOfPool}% of the pool market-buys ${symbol} and burns it; the other{' '}
            {data.rates.opsPctOfPool}% funds ops and infrastructure. Every listing feeds the same pool —
            burned supply is gone, not held in a treasury.
          </p>

          <dl className="mt-7 grid gap-4 sm:grid-cols-3">
            {metrics.map((m, i) => (
              <motion.div
                key={m.label}
                initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: 'easeOut' }}
                className="rounded-xl border border-line bg-card-2/60 p-4"
              >
                <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  {m.label}
                </dt>
                <dd className="mt-1.5 text-xl font-extrabold tabular-nums text-ink">{m.value}</dd>
                <dd className="mt-0.5 text-xs text-ink-3 tabular-nums">{m.sub}</dd>
              </motion.div>
            ))}
          </dl>

          {data.pendingBurns > 0 ? (
            <p className="mt-4 text-xs text-tb-amber">
              {data.pendingBurns} round{data.pendingBurns === 1 ? '' : 's'} bought but not yet burned — a
              buy and a burn are separate transactions, and only confirmed burns are counted above.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
