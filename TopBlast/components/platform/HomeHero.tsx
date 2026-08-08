'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { DEV_HERO } from '@/lib/marketing/devValueProp'
import { fadeUp } from '@/components/platform/HomeSection'

export function HomeHero() {
  const reduceMotion = useReducedMotion()
  const motionProps = reduceMotion ? {} : fadeUp(0)

  return (
    <motion.header {...motionProps} className="mb-14 md:mb-16 max-w-2xl">
      <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-bold tracking-tight text-white leading-[1.08] text-balance">
        Creator fees become{' '}
        <span className="gradient-text-accent">on-chart volume</span>
      </h1>
      <p className="mt-4 text-base text-gray-400 leading-relaxed">{DEV_HERO.subhead}</p>
      <div
        className="mt-8 h-px w-full max-w-xs bg-gradient-to-r from-sol-mint/40 via-sol-purple/25 to-transparent"
        aria-hidden
      />
    </motion.header>
  )
}
