'use client'

import { motion } from 'framer-motion'
import { useSoundEnabled } from '@/hooks/useSoundEffects'

function SoundOnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
    </svg>
  )
}

function SoundOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
      <path d="m16 9 6 6m0-6-6 6" strokeLinecap="round" />
    </svg>
  )
}

export function SoundToggle({ className = '' }: { className?: string }) {
  const { enabled, toggle } = useSoundEnabled()

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={toggle}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-ink-2 hover:text-ink hover:bg-ink/[0.06] transition-colors ${className}`}
      title={enabled ? 'Mute sounds' : 'Unmute sounds'}
      aria-label={enabled ? 'Mute sounds' : 'Unmute sounds'}
    >
      {enabled ? <SoundOnIcon /> : <SoundOffIcon />}
    </motion.button>
  )
}
