'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ALTERNATIVES_COMPARISON,
  CHART_VOLUME_ENGINE,
  HOME_CHART_VOLUME,
  HOME_LAUNCH_STEPS,
  HOME_VS_CASHBACK,
} from '@/lib/marketing/devValueProp'
import {
  DEV_FEE_PCT,
  FLYWHEEL_BURN_STATUS,
  FLYWHEEL_TREE,
  PLATFORM_BUYBACK_PCT_OF_POOL,
  PLATFORM_OPS_PCT_OF_POOL,
} from '@/lib/platform/flywheel'
import { HomeSection } from '@/components/platform/HomeSection'

type FlowTab = 'deployers' | 'volume' | 'getstarted' | 'session' | 'platform' | 'compare'

const TABS: { id: FlowTab; label: string; hint: string }[] = [
  { id: 'deployers', label: 'Why not cashback', hint: 'Skip the cashback bot' },
  { id: 'volume', label: 'Chart volume', hint: 'Buys on your mint' },
  { id: 'getstarted', label: 'Get started', hint: 'List in four steps' },
  { id: 'session', label: 'Payout cycle', hint: 'Timer & splits' },
  { id: 'platform', label: 'Protocol fee', hint: 'Platform flywheel' },
  { id: 'compare', label: 'Why TopBlast', hint: 'vs cashback & dev tax' },
]

const EASE = [0.22, 1, 0.36, 1] as const

function DeployersTab() {
  const { title, subtitle, cashback, topblast } = HOME_VS_CASHBACK
  const reduceMotion = useReducedMotion()

  return (
    <div className="space-y-5">
      <div>
        <p className="home-section-label text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 mb-2">
          For deployers
        </p>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <motion.article
          initial={reduceMotion ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="rounded-lg border border-white/[0.08] home-vs-negative p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{cashback.label}</p>
          <ul className="space-y-2.5">
            {cashback.points.map(point => (
              <li key={point} className="flex gap-2.5 text-sm text-gray-500 leading-relaxed">
                <span className="text-red-400/80 shrink-0 mt-0.5" aria-hidden>
                  −
                </span>
                {point}
              </li>
            ))}
          </ul>
        </motion.article>
        <motion.article
          initial={reduceMotion ? false : { opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.06, ease: EASE }}
          className="rounded-lg border border-sol-mint/20 home-vs-positive p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-sol-mint mb-3">{topblast.label}</p>
          <ul className="space-y-2.5">
            {topblast.points.map(point => (
              <li key={point} className="flex gap-2.5 text-sm text-gray-300 leading-relaxed">
                <span className="text-sol-mint shrink-0 mt-0.5" aria-hidden>
                  +
                </span>
                {point}
              </li>
            ))}
          </ul>
        </motion.article>
      </div>
    </div>
  )
}

function ChartVolumeTab() {
  const copy = HOME_CHART_VOLUME
  const reduceMotion = useReducedMotion()

  return (
    <div className="space-y-6">
      <div>
        <p className="home-section-label text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 mb-2">
          {copy.eyebrow}
        </p>
        <p className="text-base sm:text-lg font-semibold text-white leading-snug">{copy.title}</p>
        <p className="text-sm text-gray-400 mt-2 max-w-4xl leading-relaxed">{copy.lead}</p>
      </div>

      <div className="hidden lg:flex items-stretch gap-2">
        {copy.flow.map((step, index) => (
          <div key={step.title} className="flex items-stretch flex-1 min-w-0">
            <motion.article
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05, ease: EASE }}
              className="flex-1 rounded-lg border border-sol-mint/15 bg-sol-mint/[0.04] p-3 min-w-0"
            >
              <span className="text-[10px] font-mono uppercase tracking-wider text-sol-mint/80">
                Step {index + 1}
              </span>
              <p className="text-sm font-medium text-white mt-1">{step.title}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{step.body}</p>
            </motion.article>
            {index < copy.flow.length - 1 ? (
              <span className="flex items-center px-1 text-sol-mint/40 shrink-0" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {copy.flow.map((step, index) => (
          <li
            key={step.title}
            className="rounded-lg border border-sol-mint/15 bg-sol-mint/[0.04] p-4"
          >
            <span className="text-[10px] font-mono uppercase tracking-wider text-sol-mint/80">
              Step {index + 1}
            </span>
            <p className="text-sm font-medium text-white mt-1">{step.title}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-3">
        {copy.callouts.map(item => (
          <div
            key={item.label}
            className="rounded-lg border border-white/[0.08] bg-black/30 px-4 py-3 text-center"
          >
            <p className="text-[0.65rem] uppercase tracking-wider text-gray-500">{item.label}</p>
            <p className="text-sm text-gray-300 mt-1 leading-snug">{item.value}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600 border-t border-white/[0.06] pt-4 max-w-4xl leading-relaxed">
        {copy.notThis}
      </p>

      <Link
        href="/catalog"
        className="inline-block text-sm font-medium text-sol-mint hover:text-white transition-colors"
      >
        See Gen volume on live listings →
      </Link>
    </div>
  )
}

function GetStartedTab() {
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-400 max-w-3xl leading-relaxed">
        No custom contract. Point creator fees at TopBlast and the protocol handles rankings, buybacks, and
        airdrops.
      </p>
      <ol className="grid gap-4 sm:grid-cols-2">
        {HOME_LAUNCH_STEPS.map((step, index) => (
          <li
            key={step.title}
            className="group flex gap-4 rounded-lg border border-white/[0.06] bg-black/20 p-4 h-full"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/50 text-xs font-mono text-gray-500 transition-colors group-hover:border-sol-mint/35 group-hover:text-sol-mint">
              {index + 1}
            </span>
            <div className="pt-0.5 min-w-0">
              <p className="text-sm font-medium text-white">{step.title}</p>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link
        href="/launch"
        className="inline-block text-sm font-medium text-sol-mint hover:text-white transition-colors"
      >
        Open list page →
      </Link>
    </div>
  )
}

function SessionTab() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400 max-w-3xl leading-relaxed">
        Each listing runs on the payout schedule you pick when listing. When the first eligible underwater holder
        appears, the timer starts — no manual trigger. See the{' '}
        <span className="text-gray-300">Chart volume</span> tab for how Jupiter buys feed your chart each cycle.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: 'Pool usage',
            body: '~99% of your funded payout wallet SOL is used each cycle.',
          },
          {
            title: 'Winner pool',
            body: '88% swaps into your token via Jupiter, then airdrops to eligible losers (3–10 per listing).',
          },
          {
            title: 'Split',
            body: 'Descending by rank — biggest loser gets the largest share each cycle.',
          },
          {
            title: 'Protocol fee',
            body: `${DEV_FEE_PCT}% to platform treasury — see Protocol fee tab.`,
          },
        ].map(item => (
          <article
            key={item.title}
            className="rounded-lg border border-white/[0.08] bg-black/25 p-4 h-full"
          >
            <p className="text-sm font-medium text-white">{item.title}</p>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.body}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function PlatformTab() {
  return (
    <div className="space-y-5 max-w-3xl">
      <p className="text-sm text-gray-400 leading-relaxed">
        Every listing pays a flat {DEV_FEE_PCT}% protocol fee from the payout pool each cycle. This is
        independent of the Jupiter buyback that funds holder rewards.
      </p>
      <div className="rounded-lg border border-sol-purple/15 bg-black/40 p-4 font-mono text-xs text-gray-400 space-y-2">
        <p className="text-gray-300">{FLYWHEEL_TREE.root}</p>
        <p>
          <span className="text-sol-mint/70">├─ </span>
          {PLATFORM_BUYBACK_PCT_OF_POOL}% of pool — {FLYWHEEL_TREE.buyback}
        </p>
        <p>
          <span className="text-sol-purple/60">└─ </span>
          {PLATFORM_OPS_PCT_OF_POOL}% of pool — {FLYWHEEL_TREE.ops}
        </p>
        {FLYWHEEL_BURN_STATUS === 'planned' ? (
          <p className="text-gray-600 pt-1">{FLYWHEEL_TREE.burn} (roadmap)</p>
        ) : null}
      </div>
    </div>
  )
}

function CompareTab() {
  return (
    <div className="overflow-x-auto">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 mb-4">
        TopBlast vs cashback &amp; dev tax
      </p>
      <table className="w-full text-sm min-w-[520px]">
        <thead>
          <tr className="border-b border-white/10 text-left text-gray-500">
            <th className="pb-3 pr-4 font-medium">Model</th>
            <th className="pb-3 pr-4 font-medium">What holders do</th>
            <th className="pb-3 pr-4 font-medium">Chart impact</th>
            <th className="pb-3 font-medium">Dev optics</th>
          </tr>
        </thead>
        <tbody>
          {ALTERNATIVES_COMPARISON.map(row => (
            <tr
              key={row.id}
              className={
                row.tone === 'positive'
                  ? 'border-t border-sol-mint/15 bg-sol-mint/[0.03] border-l-2 border-l-sol-mint/50'
                  : 'border-t border-white/[0.06]'
              }
            >
              <td className="py-3 pr-4 text-white font-medium">{row.name}</td>
              <td className="py-3 pr-4 text-gray-500">{row.holderBehavior}</td>
              <td className={`py-3 pr-4 ${row.tone === 'positive' ? 'text-gray-300' : 'text-gray-600'}`}>
                {row.chartEffect}
              </td>
              <td className={`py-3 ${row.tone === 'positive' ? 'text-gray-400' : 'text-gray-600'}`}>
                {row.devOptics}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-600 mt-5 max-w-3xl leading-relaxed">{CHART_VOLUME_ENGINE.footer}</p>
    </div>
  )
}

function TabPanel({ tab }: { tab: FlowTab }) {
  switch (tab) {
    case 'deployers':
      return <DeployersTab />
    case 'volume':
      return <ChartVolumeTab />
    case 'getstarted':
      return <GetStartedTab />
    case 'session':
      return <SessionTab />
    case 'platform':
      return <PlatformTab />
    case 'compare':
      return <CompareTab />
  }
}

export function TopBlastFlowDiagram() {
  const [tab, setTab] = useState<FlowTab>('volume')
  const reduceMotion = useReducedMotion()

  return (
    <HomeSection
      label="How it works"
      title="One cycle, end to end"
      description="Tap a tab — how chart volume works on your mint, why TopBlast vs cashback, and how each payout cycle runs."
      className="mb-14 md:mb-16"
    >
      <div className="home-flow-panel rounded-xl border border-white/[0.08] backdrop-blur-md overflow-hidden">
        <div className="flex gap-4 sm:gap-5 px-5 pt-4 border-b border-white/[0.06] overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative shrink-0 pb-3 text-left transition-colors cursor-pointer min-w-[7rem] ${
                tab === t.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="block text-sm font-medium">{t.label}</span>
              <span
                className={`block text-[0.65rem] mt-0.5 transition-colors ${
                  tab === t.id ? 'text-sol-mint/80' : 'text-gray-600'
                }`}
              >
                {t.hint}
              </span>
              {tab === t.id ? (
                <motion.span
                  layoutId="home-flow-tab"
                  className="absolute left-0 right-0 -bottom-px h-0.5 bg-sol-mint"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              ) : null}
            </button>
          ))}
        </div>

        <div className="p-5 md:p-6 min-h-[280px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <TabPanel tab={tab} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </HomeSection>
  )
}
