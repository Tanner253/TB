'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { CAN_I_GET_PAID, HOW_IT_WORKS_SIMPLE } from '@/lib/marketing/holderCopy'

export function HowItWorksSimple() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="mb-14 md:mb-20">
      <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-ink text-center mb-8">
        {HOW_IT_WORKS_SIMPLE.title}
      </h2>

      <div className="grid gap-4 md:grid-cols-3">
        {HOW_IT_WORKS_SIMPLE.steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, delay: i * 0.1 }}
            whileHover={reduceMotion ? undefined : { y: -4 }}
            className="relative rounded-2xl border border-line bg-card/85 p-6 text-center shadow-card backdrop-blur"
          >
            <span
              className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-sol-purple text-xs font-extrabold text-white"
              aria-hidden
            >
              {i + 1}
            </span>
            <motion.span
              className="block text-4xl mb-3"
              whileHover={reduceMotion ? undefined : { scale: 1.2, rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.4 }}
              aria-hidden
            >
              {step.emoji}
            </motion.span>
            <h3 className="text-lg font-bold text-ink">{step.title}</h3>
            <p className="mt-2 text-sm text-ink-2 leading-relaxed">{step.body}</p>
          </motion.div>
        ))}
      </div>

      {/* Can I get paid? */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.45, delay: 0.15 }}
        className="mt-10 rounded-2xl border border-line bg-card/85 p-6 sm:p-8 shadow-card backdrop-blur"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-extrabold tracking-tight text-ink">
              {CAN_I_GET_PAID.title}
            </h3>
            <p className="mt-1 text-sm text-ink-2">{CAN_I_GET_PAID.intro}</p>
          </div>
          <a
            href={CAN_I_GET_PAID.docsCta.href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-sm font-semibold text-sol-purple hover:underline"
          >
            {CAN_I_GET_PAID.docsCta.label} →
          </a>
        </div>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {CAN_I_GET_PAID.rules.map((rule, i) => (
            <motion.li
              key={rule.text}
              initial={reduceMotion ? false : { opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.07 }}
              className="flex items-center gap-3 rounded-xl border border-line bg-card-2/80 px-4 py-3"
            >
              <span className="text-xl" aria-hidden>
                {rule.emoji}
              </span>
              <span className="text-sm font-medium text-ink">{rule.text}</span>
            </motion.li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink-3">{CAN_I_GET_PAID.footnote}</p>
      </motion.div>

      {/* whitepaper pointer */}
      <p className="mt-8 text-center text-sm text-ink-2">
        {HOW_IT_WORKS_SIMPLE.docsNote}{' '}
        <a
          href={HOW_IT_WORKS_SIMPLE.docsCta.href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-sol-purple hover:underline"
        >
          {HOW_IT_WORKS_SIMPLE.docsCta.label} →
        </a>
      </p>
    </section>
  )
}
