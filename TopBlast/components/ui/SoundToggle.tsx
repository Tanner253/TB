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

/**
 * The two icons differ only by a path deep in a 16px SVG, in the same colour,
 * so toggling changed nothing a person could see and the button read as
 * broken. State is now carried by colour and a dot, matching MusicToggle
 * beside it — and muting, which plays no confirmation sound by definition,
 * is the state that most needed to be visible.
 */
export function SoundToggle({ className = '' }: { className?: string }) {
  const { enabled, toggle } = useSoundEnabled()

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={toggle}
      aria-pressed={enabled}
      className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
        enabled ? 'text-sol-purple hover:bg-sol-purple/10' : 'text-ink-3 hover:text-ink-2 hover:bg-ink/[0.06]'
      } ${className}`}
      title={enabled ? 'Sound on — click to mute' : 'Sound muted — click to unmute'}
      aria-label={enabled ? 'Mute sounds' : 'Unmute sounds'}
    >
      {enabled ? <SoundOnIcon /> : <SoundOffIcon />}
      {enabled ? (
        <motion.span
          className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sol-purple"
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          aria-hidden
        />
      ) : null}
    </motion.button>
  )
}
