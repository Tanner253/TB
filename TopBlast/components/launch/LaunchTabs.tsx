'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Listing flow as a wizard rather than free tabs.
 *
 * Listing hands TopBlast an encrypted payout key and commits real ETH to rules
 * that lock at launch — winner count, cycle length, minimum balance. As plain
 * tabs, "Create listing" sat first and selectable, so the likeliest path was
 * filling the form having read none of it. The order is now the order someone
 * should learn it in, and the form stays locked until the three explainer steps
 * have actually been opened.
 *
 * It is a soft gate on purpose: it proves the information was served, not that
 * it was read, and a returning creator is not walked through it again. Once a
 * step has been seen it stays clickable, so this never becomes a maze for
 * someone who just wants to list a second token.
 */

export type LaunchTabId = 'setup' | 'payouts' | 'fees' | 'create'

const STEPS: { id: LaunchTabId; label: string; short: string }[] = [
  { id: 'setup', label: 'Setup guide', short: 'Setup' },
  { id: 'payouts', label: 'Payout rules', short: 'Rules' },
  { id: 'fees', label: 'Fees & trust', short: 'Fees' },
  { id: 'create', label: 'Create listing', short: 'Create' },
]

/** The explainers that must be served before the form opens. */
const REQUIRED: LaunchTabId[] = ['setup', 'payouts', 'fees']

const STORAGE_KEY = 'tb-launch-steps-seen'

export const LAUNCH_STEPS = STEPS

export interface LaunchWizard {
  activeTab: LaunchTabId
  setActiveTab: (id: LaunchTabId) => void
  seen: LaunchTabId[]
  /** Every explainer has been opened, so the form is unlocked. */
  canCreate: boolean
  next: () => void
  back: () => void
  isFirst: boolean
  isLast: boolean
}

export function useLaunchTabs(initial: LaunchTabId = 'setup'): LaunchWizard {
  const [activeTab, setActive] = useState<LaunchTabId>(initial)
  const [seen, setSeen] = useState<LaunchTabId[]>([initial])

  // A creator listing a second token should not be re-walked through the
  // explainers. Storage can throw or come back empty, and the wizard has to
  // work either way — an unreadable store just means they see it again.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const prior = JSON.parse(raw)
      if (Array.isArray(prior)) {
        setSeen(current => Array.from(new Set([...current, ...prior.filter(isStepId)])))
      }
    } catch {
      /* no persisted progress; the wizard simply starts fresh */
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen))
    } catch {
      /* progress just will not persist */
    }
  }, [seen])

  const canCreate = REQUIRED.every(id => seen.includes(id))

  const setActiveTab = useCallback(
    (id: LaunchTabId) => {
      // The gate is the only thing that can refuse a move.
      if (id === 'create' && !REQUIRED.every(step => seen.includes(step))) return
      setActive(id)
      setSeen(current => (current.includes(id) ? current : [...current, id]))
    },
    [seen]
  )

  const index = STEPS.findIndex(s => s.id === activeTab)
  const next = useCallback(() => {
    const target = STEPS[Math.min(index + 1, STEPS.length - 1)]
    if (target) setActiveTab(target.id)
  }, [index, setActiveTab])
  const back = useCallback(() => {
    const target = STEPS[Math.max(index - 1, 0)]
    if (target) setActiveTab(target.id)
  }, [index, setActiveTab])

  return {
    activeTab,
    setActiveTab,
    seen,
    canCreate,
    next,
    back,
    isFirst: index <= 0,
    isLast: index >= STEPS.length - 1,
  }
}

function isStepId(value: unknown): value is LaunchTabId {
  return typeof value === 'string' && STEPS.some(s => s.id === value)
}

interface LaunchTabsProps {
  activeTab: LaunchTabId
  onTabChange: (tab: LaunchTabId) => void
  seen?: LaunchTabId[]
  canCreate?: boolean
}

export function LaunchTabBar({ activeTab, onTabChange, seen = [], canCreate = true }: LaunchTabsProps) {
  return (
    <ol
      aria-label="Listing steps"
      className="flex gap-1 p-1 rounded-xl bg-ink/[0.04] border border-line overflow-x-auto"
    >
      {STEPS.map((step, i) => {
        const selected = activeTab === step.id
        const done = seen.includes(step.id) && !selected
        const locked = step.id === 'create' && !canCreate
        return (
          <li key={step.id} className="shrink-0">
            <button
              type="button"
              aria-current={selected ? 'step' : undefined}
              aria-disabled={locked}
              disabled={locked}
              onClick={() => onTabChange(step.id)}
              title={locked ? 'Read the three steps above first' : undefined}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                selected
                  ? 'bg-sol-purple/15 text-sol-purple border border-sol-purple/25 font-semibold'
                  : locked
                    ? 'text-ink-3 border border-transparent cursor-not-allowed opacity-60'
                    : 'text-ink-2 hover:text-ink border border-transparent'
              }`}
            >
              <span
                aria-hidden
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] font-bold ${
                  selected
                    ? 'bg-sol-purple text-on-accent'
                    : done
                      ? 'bg-sol-mint/20 text-sol-mint'
                      : 'bg-ink/[0.07] text-ink-3'
                }`}
              >
                {locked ? '🔒' : done ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.short}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** Continue / Back, so the wizard reads as a sequence rather than a menu. */
export function LaunchStepNav({
  wizard,
  nextLabel,
  className = '',
}: {
  wizard: LaunchWizard
  nextLabel?: string
  className?: string
}) {
  if (wizard.isLast) return null
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      {wizard.isFirst ? (
        <span />
      ) : (
        <button
          type="button"
          onClick={wizard.back}
          className="rounded-lg border border-line px-4 py-2 text-sm text-ink-2 hover:text-ink transition-colors"
        >
          ← Back
        </button>
      )}
      <button
        type="button"
        onClick={wizard.next}
        className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover transition-colors"
      >
        {nextLabel ?? 'Continue →'}
      </button>
    </div>
  )
}

interface LaunchTabPanelProps {
  tabId: LaunchTabId
  activeTab: LaunchTabId
  children: React.ReactNode
}

export function LaunchTabPanel({ tabId, activeTab, children }: LaunchTabPanelProps) {
  if (activeTab !== tabId) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabId}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
