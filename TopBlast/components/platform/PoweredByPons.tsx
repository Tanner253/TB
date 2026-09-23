'use client'

/**
 * "A Pons SaaS" — the relationship strip.
 *
 * TopBlast is a rewards layer, not a launchpad: tokens are deployed on Pons,
 * the fees we claim are Pons creator fees, and the buys land on the Pons
 * curve. Saying so plainly is both accurate and the point — creators arrive
 * from Pons and need to know nothing about their launch changes.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { POWERED_BY_PONS } from '@/lib/marketing/devValueProp'

export function PoweredByPons() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="mb-14 md:mb-20" aria-labelledby="pons-heading">
      <div className="relative overflow-hidden rounded-2xl border border-sol-purple/25 bg-card/70 p-6 sm:p-8 backdrop-blur">
        {/* accent bloom behind the Pons mark */}
        <div
          className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full border border-sol-purple/40 bg-sol-purple/10 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-sol-purple">
            {POWERED_BY_PONS.eyebrow}
          </p>

          <h2
            id="pons-heading"
            className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink text-balance"
          >
            {POWERED_BY_PONS.title}
          </h2>

          <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-ink-2 text-balance">
            {POWERED_BY_PONS.lead}
          </p>

          <ul className="mt-7 grid gap-4 sm:grid-cols-3">
            {POWERED_BY_PONS.points.map((point, i) => (
              <motion.li
                key={point.title}
                initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: 'easeOut' }}
                className="rounded-xl border border-line bg-card-2/60 p-4"
              >
                <h3 className="text-sm font-bold text-ink">{point.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{point.body}</p>
              </motion.li>
            ))}
          </ul>

          <a
            href={POWERED_BY_PONS.cta.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-on-accent shadow-rh-glow-sm transition-all hover:scale-[1.03] hover:bg-accent-hover active:scale-95"
          >
            {POWERED_BY_PONS.cta.label}
          </a>
        </div>
      </div>
    </section>
  )
}
