'use client'

/**
 * One-click Rekt Card for any wallet shown in a list (leaderboard rows,
 * Hall of Fame). Opens the shared modal pre-filled and auto-scans.
 */

import { motion } from 'framer-motion'
import { openRektModal } from './RektModal'
import { playPop } from '@/hooks/useSoundEffects'

interface RektShareButtonProps {
  wallet: string
  className?: string
  /** Compact icon (default) or icon + label. */
  variant?: 'icon' | 'labeled'
}

export function RektShareButton({
  wallet,
  className = '',
  variant = 'icon',
}: RektShareButtonProps) {
  const open = (e: React.MouseEvent) => {
    // Rows are often wrapped in links — don't navigate.
    e.preventDefault()
    e.stopPropagation()
    playPop()
    openRektModal(wallet, { autoScan: true })
  }

  if (variant === 'labeled') {
    return (
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={open}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-line bg-card/70 px-2.5 py-1.5 text-xs font-semibold text-ink-2 hover:border-sol-purple/40 hover:text-sol-purple transition-colors ${className}`}
        title="Get this wallet's Rekt Card"
      >
        📉 Rekt Card
      </motion.button>
    )
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      onClick={open}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-card/70 text-sm text-ink-3 hover:border-sol-purple/40 hover:text-sol-purple transition-colors ${className}`}
      title="Get this wallet's Rekt Card"
      aria-label="Get this wallet's Rekt Card"
    >
      📉
    </motion.button>
  )
}
