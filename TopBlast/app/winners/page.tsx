'use client'

/**
 * Hall of Fame — all-time biggest winners and payouts across every session.
 * Every row has a one-click Rekt Card so anyone can pull up (and share) the
 * report for that wallet.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { AppHeader } from '@/components/platform/AppHeader'
import { BlastyWhale } from '@/components/mascot/BlastyWhale'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { RektShareButton } from '@/components/rekt/RektShareButton'
import { getAddressExplorerUrl } from '@/lib/solana/explorer'
import type { GlobalLeaderboardData } from '@/lib/payout/globalLeaderboard'

type Tab = 'winners' | 'payouts'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function WinnersPage() {
  const [data, setData] = useState<GlobalLeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('winners')

  useEffect(() => {
    let cancelled = false
    fetch('/api/leaderboard/global?limit=25')
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        if (!json.success) throw new Error(json.error || 'Failed to load')
        setData(json.data as GlobalLeaderboardData)
      })
      .catch(err => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const stats = data?.stats

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader active="winners" />
      <main className="max-w-4xl mx-auto px-4 sm:px-5 py-10">
        <header className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <BlastyWhale pose="happy" size={110} />
          </div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-sol-purple mb-2">
            All sessions · all time
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            HALL OF <span className="gradient-text-accent">FAME</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-ink-2 max-w-lg mx-auto">
            The holders who got paid the most for being down bad. Every payout below really
            happened, on-chain.
          </p>
        </header>

        {/* global stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Paid to losers', value: stats?.totalDistributedUsd ?? 0, prefix: '$', accent: 'text-sol-mint' },
            { label: 'Payouts sent', value: stats?.totalPayouts ?? 0, accent: 'text-ink' },
            { label: 'Unique winners', value: stats?.uniqueWinners ?? 0, accent: 'text-ink' },
            { label: 'Sessions', value: stats?.sessions ?? 0, accent: 'text-sol-purple' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-line bg-card/70 p-4 text-center">
              <p className={`text-xl sm:text-2xl font-extrabold tabular-nums ${s.accent}`}>
                {loading ? (
                  <span className="text-ink-3">—</span>
                ) : (
                  <AnimatedNumber value={s.value} prefix={s.prefix} decimals={0} />
                )}
              </p>
              <p className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-3">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-ink/[0.04] border border-line mb-4 w-fit mx-auto">
          {(
            [
              ['winners', '🏆 Top winners'],
              ['payouts', '💥 Biggest hits'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                tab === id
                  ? 'bg-sol-purple/15 text-sol-purple border border-sol-purple/25 font-semibold'
                  : 'text-ink-2 hover:text-ink border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400 text-center">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl border border-line bg-card/40 animate-pulse" />
            ))}
          </div>
        ) : null}

        {data && tab === 'winners' ? (
          <div className="rounded-2xl border border-line bg-card/70 overflow-hidden">
            {data.topWinners.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-3">
                No winners yet — the first payout is still out there.
              </p>
            ) : (
              data.topWinners.map((row, i) => (
                <motion.div
                  key={row.wallet}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
                  className="flex items-center gap-3 border-b border-line last:border-0 px-3 sm:px-4 py-3 hover:bg-ink/[0.03] transition-colors"
                >
                  <span className="w-8 shrink-0 text-center text-lg">
                    {MEDALS[row.rank - 1] ?? (
                      <span className="font-mono text-sm text-ink-3">#{row.rank}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={getAddressExplorerUrl(row.wallet) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm font-semibold hover:text-sol-purple transition-colors"
                    >
                      {row.walletDisplay}
                    </a>
                    <p className="text-[0.7rem] text-ink-3 mt-0.5">
                      {row.cyclesWon}× won · {row.sessionsPlayed} session
                      {row.sessionsPlayed === 1 ? '' : 's'} · mostly{' '}
                      <Link
                        href={`/${row.topSessionSlug}/leaderboard`}
                        className="text-sol-purple hover:underline"
                      >
                        ${row.topSymbol}
                      </Link>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold tabular-nums text-sol-mint">{row.totalUsdFormatted}</p>
                    <p className="text-[0.65rem] text-ink-3">{timeAgo(row.lastWinAt)}</p>
                  </div>
                  <RektShareButton wallet={row.wallet} />
                </motion.div>
              ))
            )}
          </div>
        ) : null}

        {data && tab === 'payouts' ? (
          <div className="rounded-2xl border border-line bg-card/70 overflow-hidden">
            {data.biggestPayouts.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-3">No payouts yet.</p>
            ) : (
              data.biggestPayouts.map((row, i) => (
                <motion.div
                  key={`${row.wallet}-${row.cycle}-${row.rank}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
                  className="flex items-center gap-3 border-b border-line last:border-0 px-3 sm:px-4 py-3 hover:bg-ink/[0.03] transition-colors"
                >
                  <span className="w-8 shrink-0 text-center text-lg">
                    {MEDALS[row.rank - 1] ?? (
                      <span className="font-mono text-sm text-ink-3">#{row.rank}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={getAddressExplorerUrl(row.wallet) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm font-semibold hover:text-sol-purple transition-colors"
                    >
                      {row.walletDisplay}
                    </a>
                    <p className="text-[0.7rem] text-ink-3 mt-0.5">
                      <Link
                        href={`/${row.sessionSlug}/leaderboard`}
                        className="text-sol-purple hover:underline"
                      >
                        ${row.symbol}
                      </Link>{' '}
                      · cycle #{row.cycle} · {timeAgo(row.at)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right font-bold tabular-nums text-gold">
                    {row.usdFormatted}
                  </p>
                  <RektShareButton wallet={row.wallet} />
                </motion.div>
              ))
            )}
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-ink-3">
          Includes every session ever listed. Tap 📉 on any row for that wallet&apos;s Rekt Card.
        </p>
      </main>
    </div>
  )
}
