'use client'

/**
 * Interactive Blasty — tap them and they squeak and wiggle.
 * Every few taps triggers a bigger reaction; ten taps in a row
 * launches the rocket easter egg (with the full celebration).
 */

import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { BlastyWhale, type BlastyPose } from './BlastyWhale'
import { playWhaleCall, playPop } from '@/hooks/useSoundEffects'
import { triggerCelebration } from './celebrate'

interface BlastyProps {
  pose?: BlastyPose
  size?: number
  className?: string
  /** Disable tap interactions (decorative placements). */
  interactive?: boolean
}

export function Blasty({ pose = 'idle', size = 160, className = '', interactive = true }: BlastyProps) {
  const reduceMotion = useReducedMotion()
  const [reaction, setReaction] = useState<'none' | 'wiggle' | 'flip'>('none')
  const [tempPose, setTempPose] = useState<BlastyPose | null>(null)
  const tapCount = useRef(0)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleTap() {
    if (!interactive) return
    tapCount.current += 1
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => {
      tapCount.current = 0
    }, 2500)

    if (tapCount.current >= 10) {
      tapCount.current = 0
      triggerCelebration({ label: 'BLAST OFF!', sublabel: 'You found the secret launch button' })
      return
    }

    if (tapCount.current % 5 === 0) {
      playWhaleCall()
      setTempPose('happy')
      setReaction('flip')
    } else {
      if (tapCount.current % 2 === 0) playPop()
      else playWhaleCall()
      setTempPose('happy')
      setReaction('wiggle')
    }
  }

  const animate =
    reduceMotion || reaction === 'none'
      ? {}
      : reaction === 'flip'
        ? { rotate: [0, 360], scale: [1, 1.15, 1] }
        : { rotate: [0, -8, 8, -5, 0], scale: [1, 1.06, 1] }

  return (
    <motion.div
      className={`inline-block select-none ${interactive ? 'cursor-pointer' : ''} ${className}`}
      whileTap={interactive && !reduceMotion ? { scale: 0.94 } : undefined}
      animate={animate}
      transition={{ duration: reaction === 'flip' ? 0.7 : 0.45, ease: 'easeInOut' }}
      onAnimationComplete={() => {
        setReaction('none')
        setTempPose(null)
      }}
      onTap={handleTap}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? 'Blasty the whale — tap for a surprise' : undefined}
    >
      <BlastyWhale pose={tempPose ?? pose} size={size} />
    </motion.div>
  )
}
