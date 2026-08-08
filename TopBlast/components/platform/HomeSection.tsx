'use client'

import { motion, useReducedMotion } from 'framer-motion'

const EASE = [0.22, 1, 0.36, 1] as const

export function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay, ease: EASE },
  }
}

interface HomeSectionProps {
  label: string
  title: string
  description?: string
  children: React.ReactNode
  delay?: number
  className?: string
}

export function HomeSection({
  label,
  title,
  description,
  children,
  delay = 0,
  className = '',
}: HomeSectionProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className={className}
    >
      <div className="mb-6">
        <p className="home-section-label text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 mb-2">
          {label}
        </p>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">{title}</h2>
        {description ? <p className="text-sm text-gray-500 mt-2 max-w-3xl leading-relaxed">{description}</p> : null}
      </div>
      {children}
    </motion.section>
  )
}

interface HomeRevealProps {
  children: React.ReactNode
  delay?: number
  className?: string
}

export function HomeReveal({ children, delay = 0, className = '' }: HomeRevealProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.45, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
