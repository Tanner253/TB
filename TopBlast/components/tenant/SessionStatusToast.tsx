'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { SessionStatus, SessionStatusTone } from '@/lib/tenant/sessionStatus'

const toneStyles: Record<
  SessionStatusTone,
  { border: string; bg: string; text: string; dot: string }
> = {
  neutral: {
    border: 'border-white/15',
    bg: 'bg-black/90',
    text: 'text-gray-200',
    dot: 'bg-gray-400',
  },
  success: {
    border: 'border-rh-green/40',
    bg: 'bg-rh-green/10',
    text: 'text-rh-lime',
    dot: 'bg-rh-green',
  },
  warning: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-950/80',
    text: 'text-amber-200',
    dot: 'bg-amber-400',
  },
  error: {
    border: 'border-red-500/40',
    bg: 'bg-red-950/80',
    text: 'text-red-200',
    dot: 'bg-red-400',
  },
  loading: {
    border: 'border-blue-500/30',
    bg: 'bg-black/90',
    text: 'text-blue-200',
    dot: 'bg-blue-400',
  },
}

interface SessionStatusToastProps {
  status?: SessionStatus | null
  eligibleCount?: number
  timerStatus?: string
}

export function SessionStatusToast({
  status,
  eligibleCount = 0,
  timerStatus,
}: SessionStatusToastProps) {
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const [ephemeral, setEphemeral] = useState<SessionStatus | null>(null)
  const prevEligible = useRef<number | undefined>(undefined)

  useEffect(() => {
    setDismissedKey(null)
  }, [status?.message])

  useEffect(() => {
    if (eligibleCount === undefined) return
    const prev = prevEligible.current
    if (prev === 0 && eligibleCount > 0 && timerStatus === 'active') {
      setEphemeral({
        tone: 'success',
        message: 'Payout timer started',
        persistent: false,
      })
    }
    prevEligible.current = eligibleCount
  }, [eligibleCount, timerStatus])

  useEffect(() => {
    if (!ephemeral || ephemeral.persistent) return
    const timer = window.setTimeout(() => setEphemeral(null), 5000)
    return () => window.clearTimeout(timer)
  }, [ephemeral])

  const active = ephemeral ?? status
  const visible = active && dismissedKey !== active.message
  const styles = active ? toneStyles[active.tone] : toneStyles.neutral

  return (
    <AnimatePresence>
      {visible && active ? (
        <motion.div
          key={active.message}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className={`fixed bottom-6 left-1/2 z-50 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2.5 shadow-lg backdrop-blur-md ${styles.border} ${styles.bg}`}
        >
          <motion.span
            className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`}
            animate={{ scale: [1, 1.25, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <p className={`text-sm font-medium ${styles.text}`}>{active.message}</p>
          <button
            type="button"
            onClick={() => setDismissedKey(active.message)}
            className="ml-1 shrink-0 rounded-full p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Dismiss"
          >
            ×
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
