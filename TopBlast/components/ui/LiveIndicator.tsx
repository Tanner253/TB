'use client'

import { motion } from 'framer-motion'

interface LiveIndicatorProps {
  label?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'success' | 'warning' | 'error' | 'info'
}

const sizeConfig = {
  sm: { dot: 'w-1.5 h-1.5', text: 'text-xs' },
  md: { dot: 'w-2 h-2', text: 'text-xs' },
  lg: { dot: 'w-2.5 h-2.5', text: 'text-sm' },
}

const variantConfig = {
  success: { bg: 'bg-emerald-400', text: 'text-emerald-400', glow: 'shadow-emerald-400/50' },
  warning: { bg: 'bg-amber-400', text: 'text-amber-400', glow: 'shadow-amber-400/50' },
  error: { bg: 'bg-red-400', text: 'text-red-400', glow: 'shadow-red-400/50' },
  info: { bg: 'bg-cyan-400', text: 'text-cyan-400', glow: 'shadow-cyan-400/50' },
}

export function LiveIndicator({ label = 'LIVE', size = 'md', variant = 'success' }: LiveIndicatorProps) {
  const sizeStyle = sizeConfig[size]
  const variantStyle = variantConfig[variant]

  return (
    <div className="flex items-center gap-1.5">
      <motion.div
        className={`${sizeStyle.dot} ${variantStyle.bg} rounded-full shadow-lg ${variantStyle.glow}`}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [1, 0.7, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {label && (
        <span className={`${sizeStyle.text} font-semibold tracking-wider uppercase ${variantStyle.text}`}>
          {label}
        </span>
      )}
    </div>
  )
}

interface ConnectionStatusProps {
  connected?: boolean
  connecting?: boolean
}

export function ConnectionStatus({ connected = true, connecting = false }: ConnectionStatusProps) {
  const state = connecting ? 'connecting' : connected ? 'connected' : 'disconnected'

  const stateConfig = {
    connected: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      text: 'text-emerald-400',
      dot: 'bg-emerald-400',
      label: 'Connected',
    },
    connecting: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      text: 'text-amber-400',
      dot: 'bg-amber-400',
      label: 'Connecting...',
    },
    disconnected: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      text: 'text-red-400',
      dot: 'bg-red-400',
      label: 'Disconnected',
    },
  }

  const config = stateConfig[state]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}
    >
      <motion.div
        className={`w-2 h-2 rounded-full ${config.dot}`}
        animate={
          state === 'connecting'
            ? { scale: [1, 1.3, 1] }
            : state === 'connected'
            ? { scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }
            : {}
        }
        transition={{
          duration: state === 'connecting' ? 0.8 : 1.5,
          repeat: Infinity,
        }}
      />
      {config.label}
    </motion.div>
  )
}

interface DataFreshnessProps {
  lastUpdated: Date | null
  staleThreshold?: number
}

export function DataFreshness({ lastUpdated, staleThreshold = 30 }: DataFreshnessProps) {
  if (!lastUpdated) return null

  const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
  const isStale = seconds > staleThreshold

  return (
    <motion.div
      className={`text-xs font-mono ${isStale ? 'text-amber-400' : 'text-gray-500'}`}
      animate={isStale ? { opacity: [1, 0.5, 1] } : {}}
      transition={{ duration: 1, repeat: isStale ? Infinity : 0 }}
    >
      {seconds}s ago
    </motion.div>
  )
}

// Activity pulse for showing data activity
export function ActivityPulse({ active = false }: { active?: boolean }) {
  if (!active) return null

  return (
    <motion.div
      className="w-2 h-2 bg-cyan-400 rounded-full"
      initial={{ scale: 0, opacity: 1 }}
      animate={{ scale: 2, opacity: 0 }}
      transition={{ duration: 0.5 }}
    />
  )
}
