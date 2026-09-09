'use client'

/**
 * Full-screen payout celebration: Blasty rockets up through the page with a
 * coin-confetti burst and a synth fanfare. Mount once (in the root layout);
 * fire it from anywhere with triggerCelebration().
 * Transform/opacity animations only — cheap on mobile GPUs.
 */

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BlastyWhale } from './BlastyWhale'
import { CELEBRATE_EVENT, type CelebrationDetail } from './celebrate'
import { playPayoutFanfare } from '@/hooks/useSoundEffects'

const CONFETTI_COUNT = 60
const COLORS = ['#fbbf24', '#f59e0b', '#a78bfa', '#34d399', '#f472b6', '#38bdf8']

interface Particle {
  left: number
  delay: number
  duration: number
  size: number
  color: string
  drift: number
  coin: boolean
}

function makeParticles(): Particle[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    left: 8 + Math.random() * 84,
    delay: Math.random() * 4,
    duration: 2.6 + Math.random() * 2.0,
    size: 10 + Math.random() * 14,
    color: COLORS[i % COLORS.length],
    drift: (Math.random() - 0.5) * 120,
    coin: i % 3 === 0,
  }))
}

export function PayoutCelebration() {
  const [active, setActive] = useState<CelebrationDetail | null>(null)
  const reduceMotion = useReducedMotion()
  const particles = useMemo(() => (active ? makeParticles() : []), [active])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null
    const onCelebrate = (e: Event) => {
      const detail = (e as CustomEvent<CelebrationDetail>).detail ?? {}
      playPayoutFanfare()
      setActive(detail)
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => setActive(null), 9000)
    }
    window.addEventListener(CELEBRATE_EVENT, onCelebrate)
    return () => {
      window.removeEventListener(CELEBRATE_EVENT, onCelebrate)
      if (timeout) clearTimeout(timeout)
    }
  }, [])

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key="celebration"
          className="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          aria-live="polite"
        >
          {/* soft flash */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(circle at 50% 70%, rgb(var(--tb-gold) / 0.18), transparent 60%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 8, times: [0, 0.15, 1] }}
          />

          {/* confetti */}
          {!reduceMotion
            ? particles.map((p, i) => (
                <motion.span
                  key={i}
                  className="absolute top-full will-change-transform"
                  style={{
                    left: `${p.left}%`,
                    width: p.size,
                    height: p.coin ? p.size : p.size * 0.45,
                    borderRadius: p.coin ? '50%' : 2,
                    background: p.color,
                    boxShadow: p.coin ? 'inset 0 0 0 2px rgba(0,0,0,0.12)' : undefined,
                  }}
                  initial={{ y: 0, rotate: 0, opacity: 1 }}
                  animate={{
                    y: `-${70 + Math.random() * 40}vh`,
                    x: p.drift,
                    rotate: 360 + Math.random() * 360,
                    opacity: [1, 1, 0],
                  }}
                  transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
                />
              ))
            : null}

          {/* Blasty rockets in, hovers center-stage like a max win, then blasts off */}
          <motion.div
            className="absolute left-1/2 will-change-transform"
            initial={{ y: '110vh', x: '-50%', rotate: -14 }}
            animate={
              reduceMotion
                ? { y: '32vh' }
                : {
                    y: ['110vh', '36vh', '33vh', '37vh', '33vh', '36vh', '-140vh'],
                    rotate: [-14, -6, -11, -5, -11, -6, -16],
                  }
            }
            transition={
              reduceMotion
                ? { duration: 0.4 }
                : {
                    duration: 8.4,
                    times: [0, 0.14, 0.32, 0.5, 0.66, 0.8, 1],
                    ease: ['easeOut', 'easeInOut', 'easeInOut', 'easeInOut', 'easeInOut', 'easeIn'],
                  }
            }
            style={{ top: 0 }}
          >
            <BlastyWhale pose="rocket" size={230} still />
          </motion.div>

          {/* label */}
          <div className="absolute inset-x-0 top-[18%] flex flex-col items-center gap-1 px-4 text-center">
            <motion.p
              className="text-3xl sm:text-5xl font-extrabold tracking-tight text-ink drop-shadow-sm"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.6, 1.08, 1], opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.4 }}
            >
              {active.label ?? 'PAYOUT!'}
            </motion.p>
            {active.sublabel ? (
              <motion.p
                className="text-sm sm:text-base font-medium text-ink-2"
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.55 }}
              >
                {active.sublabel}
              </motion.p>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
