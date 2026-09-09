'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { HOLDER_HERO } from '@/lib/marketing/holderCopy'
import { Blasty } from '@/components/mascot/Blasty'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { useTenantCatalog } from '@/hooks/useTenantCatalog'

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: 'easeOut' as const },
  }
}

export function HomeHero() {
  const reduceMotion = useReducedMotion()
  const { tenants, loading } = useTenantCatalog()

  const liveSessions = tenants.filter(t => t.status === 'active').length
  const totalPaidUsd = tenants.reduce((sum, t) => sum + (t.total_distributed_usd ?? 0), 0)
  const eligibleNow = tenants.reduce((sum, t) => sum + (t.payout_eligible_count ?? 0), 0)

  const stats: { label: string; value: number; prefix?: string; loaded: boolean }[] = [
    { label: 'paid to holders', value: totalPaidUsd, prefix: '$', loaded: !loading },
    { label: 'live sessions', value: liveSessions, loaded: !loading },
    { label: 'eligible right now', value: eligibleNow, loaded: !loading },
  ]

  const m = (delay: number) => (reduceMotion ? {} : fadeUp(delay))

  return (
    <header className="mb-14 md:mb-20">
      <div className="flex flex-col-reverse items-center gap-6 md:flex-row md:items-center md:justify-between md:gap-10">
        <div className="max-w-2xl text-center md:text-left">
          <motion.p
            {...m(0)}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink-2 backdrop-blur"
          >
            <span className="live-dot shrink-0" aria-hidden />
            {HOLDER_HERO.eyebrow}
          </motion.p>

          <motion.h1
            {...m(0.08)}
            className="mt-4 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-ink leading-[1.04] text-balance"
          >
            Down bad?{' '}
            <span className="gradient-text-accent">Get blasted up.</span>
          </motion.h1>

          <motion.p
            {...m(0.16)}
            className="mt-5 text-base sm:text-lg text-ink-2 leading-relaxed text-balance"
          >
            {HOLDER_HERO.subhead}
          </motion.p>

          <motion.div
            {...m(0.24)}
            className="mt-7 flex flex-wrap items-center justify-center gap-3 md:justify-start"
          >
            <Link
              href={HOLDER_HERO.primaryCta.href}
              className="inline-flex items-center gap-2 rounded-xl bg-sol-purple px-5 py-3 text-sm sm:text-base font-bold text-white shadow-rh-glow-sm transition-all hover:scale-[1.03] hover:bg-sol-purple-dark active:scale-95"
            >
              {HOLDER_HERO.primaryCta.label} →
            </Link>
            <Link
              href={HOLDER_HERO.secondaryCta.href}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-card/70 px-5 py-3 text-sm sm:text-base font-semibold text-ink backdrop-blur transition-colors hover:border-sol-purple/40 hover:text-sol-purple"
            >
              {HOLDER_HERO.secondaryCta.label}
            </Link>
          </motion.div>

          <motion.dl
            {...m(0.32)}
            className="mt-9 flex flex-wrap items-stretch justify-center gap-x-8 gap-y-4 md:justify-start"
          >
            {stats.map(stat => (
              <div key={stat.label} className="text-center md:text-left">
                <dd className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink tabular-nums">
                  {stat.loaded ? (
                    <AnimatedNumber
                      value={stat.value}
                      prefix={stat.prefix}
                      decimals={0}
                    />
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </dd>
                <dt className="mt-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  {stat.label}
                </dt>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, type: 'spring', bounce: 0.4 }}
          className="shrink-0"
        >
          <Blasty size={170} className="md:hidden" />
          <Blasty size={230} className="hidden md:inline-block" />
        </motion.div>
      </div>
    </header>
  )
}
