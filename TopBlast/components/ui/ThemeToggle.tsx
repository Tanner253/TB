'use client'

import { motion } from 'framer-motion'
import { useTheme } from '@/hooks/useTheme'
import { playPop } from '@/hooks/useSoundEffects'

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" strokeLinecap="round" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88, rotate: dark ? -30 : 30 }}
      onClick={() => {
        toggle()
        playPop()
      }}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-ink-2 hover:text-ink hover:bg-ink/[0.06] transition-colors ${className}`}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </motion.button>
  )
}
