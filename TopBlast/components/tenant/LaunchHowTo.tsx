'use client'

import { HOW_TO_RUN_LISTING, LAUNCH_FLOW } from '@/lib/tenant/launchHelp'
import { EligibilityRequirements } from '@/components/tenant/EligibilityRequirements'

type LaunchHowToSection = 'setup' | 'after' | 'skipped'

interface LaunchHowToProps {
  className?: string
  /** Which blocks to render — default all (legacy single-page layout). */
  sections?: LaunchHowToSection[] | 'all'
}

function sectionVisible(sections: LaunchHowToSection[] | 'all', id: LaunchHowToSection): boolean {
  return sections === 'all' || sections.includes(id)
}

export function LaunchSetupChecklist({ className = '' }: { className?: string }) {
  return (
    <section className={`rounded-2xl border border-rh-green/20 bg-rh-green/5 p-6 ${className}`}>
      <h2 className="text-lg font-bold text-rh-lime mb-4">{HOW_TO_RUN_LISTING.title}</h2>
      <ol className="space-y-4">
        {HOW_TO_RUN_LISTING.steps.map(step => (
          <li key={step.n} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rh-green/20 text-sm font-bold text-rh-lime">
              {step.n}
            </span>
            <div>
              <p className="font-semibold text-white">{step.title}</p>
              <p className="text-sm text-gray-400 mt-0.5">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function LaunchAfterSubmitFlow({ className = '' }: { className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-black/40 p-6 ${className}`}>
      <h2 className="text-lg font-bold mb-4">{LAUNCH_FLOW.title}</h2>
      <ul className="space-y-4">
        {LAUNCH_FLOW.steps.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="text-gray-500 font-mono text-sm pt-0.5">{i + 1}.</span>
            <div>
              <p className="font-medium text-white">{step.title}</p>
              <p className="text-sm text-gray-400 mt-0.5">{step.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function LaunchSkippedCyclesNote({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-lg font-bold text-amber-400 mb-2">When nobody wins a cycle</h2>
      <p className="text-sm text-gray-400">
        TopBlast skips payout for that cycle and shows why — empty pool, still indexing, all holders in profit, or
        holders not meeting eligibility yet. Fix funding or wait for market conditions.
      </p>
    </div>
  )
}

export function LaunchHowTo({ className = '', sections = 'all' }: LaunchHowToProps) {
  const showSetup = sectionVisible(sections, 'setup')
  const showAfter = sectionVisible(sections, 'after')
  const showSkipped = sectionVisible(sections, 'skipped')

  return (
    <div className={`space-y-8 ${className}`}>
      {showSetup ? <LaunchSetupChecklist /> : null}
      {showAfter ? <LaunchAfterSubmitFlow /> : null}
      {showSkipped ? (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-6 space-y-4">
          <LaunchSkippedCyclesNote />
          <EligibilityRequirements variant="compact" />
        </section>
      ) : null}
    </div>
  )
}
