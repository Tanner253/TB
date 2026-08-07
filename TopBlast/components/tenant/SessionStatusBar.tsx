'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { SessionChecklist, SessionChecklistItem, ChecklistItemStatus } from '@/lib/tenant/sessionChecklist'
import { ExternalToolsEligibilityNote } from '@/components/tenant/ExternalToolsEligibilityNote'

const statusIcon: Record<ChecklistItemStatus, { symbol: string; className: string }> = {
  met: { symbol: '✓', className: 'bg-rh-green/20 text-rh-lime border-rh-green/30' },
  pending: { symbol: '○', className: 'bg-white/5 text-gray-400 border-white/10' },
  blocked: { symbol: '✕', className: 'bg-red-500/15 text-red-300 border-red-500/30' },
  info: { symbol: '·', className: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
}

const overallStyles: Record<SessionChecklist['overall'], string> = {
  ready: 'border-rh-green/30 bg-rh-green/5',
  waiting: 'border-amber-500/25 bg-amber-950/20',
  blocked: 'border-red-500/30 bg-red-950/20',
  loading: 'border-blue-500/25 bg-blue-950/15',
}

function ChecklistRow({ item }: { item: SessionChecklistItem }) {
  const style = statusIcon[item.status]
  return (
    <li className="flex gap-3 py-2.5 border-b border-white/[0.06] last:border-0">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${style.className}`}
        aria-hidden
      >
        {style.symbol}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-medium text-white">{item.label}</p>
        {item.detail ? <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p> : null}
      </div>
    </li>
  )
}

interface SessionStatusBarProps {
  checklist?: SessionChecklist | null
  eligibleCount?: number
  timerStatus?: string
}

export function SessionStatusBar({
  checklist,
  eligibleCount = 0,
  timerStatus,
}: SessionStatusBarProps) {
  const [open, setOpen] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const prevEligible = useRef<number | undefined>(undefined)
  const panelId = 'session-status-panel'

  useEffect(() => {
    if (eligibleCount === undefined) return
    const prev = prevEligible.current
    if (prev === 0 && eligibleCount > 0 && timerStatus === 'active') {
      setFlash('Payout timer started')
      setOpen(true)
      const t = window.setTimeout(() => setFlash(null), 4000)
      return () => window.clearTimeout(t)
    }
    prevEligible.current = eligibleCount
  }, [eligibleCount, timerStatus])

  if (!checklist) return null

  const sessionItems = checklist.items.filter(i => i.group === 'session')
  const winnerItems = checklist.items.filter(i => i.group === 'winner')
  const barStyle = overallStyles[checklist.overall]

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`w-full text-left rounded-xl border px-4 py-3 transition-colors hover:bg-white/[0.03] ${barStyle}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <motion.span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                checklist.overall === 'ready'
                  ? 'bg-rh-green'
                  : checklist.overall === 'blocked'
                    ? 'bg-red-400'
                    : checklist.overall === 'loading'
                      ? 'bg-blue-400'
                      : 'bg-amber-400'
              }`}
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.65, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {flash ?? checklist.headline}
              </p>
              <p className="text-xs text-gray-500 truncate">{checklist.summary}</p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-medium text-gray-400 flex items-center gap-1">
            {open ? 'Hide' : 'Requirements'}
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              ▾
            </motion.span>
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-white/10 bg-black/50 backdrop-blur-sm p-4 sm:p-5">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    Session setup
                  </p>
                  <ul>
                    {sessionItems.map(item => (
                      <ChecklistRow key={item.id} item={item} />
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    Winner requirements
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Holders must pass every rule. Top 3 eligible losers by drawdown % win SOL from the pool.
                  </p>
                  <ul>
                    {winnerItems.map(item => (
                      <ChecklistRow key={item.id} item={item} />
                    ))}
                  </ul>
                </div>
              </div>

              {checklist.blockers.length > 0 ? (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-amber-400/90 mb-2">
                    Blocking holders right now
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {checklist.blockers.map(b => (
                      <span
                        key={b.reason}
                        className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-200 border border-amber-500/20"
                      >
                        {b.count}× {b.reason}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <ExternalToolsEligibilityNote className="mt-4" />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
