'use client'

import { motion } from 'framer-motion'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'rectangular' | 'circular'
  width?: string | number
  height?: string | number
  animate?: boolean
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animate = true,
}: SkeletonProps) {
  const baseClasses = 'bg-white/5'
  const variantClasses = {
    text: 'rounded',
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
  }

  const style: React.CSSProperties = {
    width: width,
    height: height,
  }

  if (!animate) {
    return <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} style={style} />
  }

  return (
    <motion.div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      animate={{
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

// Skeleton for leaderboard cards
export function LeaderboardCardSkeleton() {
  return (
    <div className="bg-[#12121a] border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="text-right space-y-2">
          <Skeleton width={80} height={16} />
          <Skeleton width={60} height={20} />
        </div>
      </div>
      <Skeleton width="60%" height={40} className="mb-4" />
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton width={60} height={14} />
          <Skeleton width={80} height={14} />
        </div>
        <div className="flex justify-between">
          <Skeleton width={60} height={14} />
          <Skeleton width={80} height={14} />
        </div>
      </div>
    </div>
  )
}

// Skeleton for table rows
export function TableRowSkeleton({ columns = 7 }: { columns?: number }) {
  return (
    <tr className="border-b border-white/5">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton width="80%" height={16} />
        </td>
      ))}
    </tr>
  )
}

// Skeleton for stats cards
export function StatsCardSkeleton() {
  return (
    <div className="glass-panel rounded-xl p-6">
      <Skeleton width={100} height={14} className="mb-3" />
      <Skeleton width={150} height={32} className="mb-2" />
      <Skeleton width={80} height={14} />
    </div>
  )
}

// Full page loading skeleton
export function PageSkeleton() {
  return (
    <div className="min-h-screen p-4 md:p-8 animate-pulse">
      <div className="max-w-6xl mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Skeleton variant="rectangular" width={40} height={40} />
            <Skeleton width={120} height={24} />
          </div>
          <div className="flex gap-4">
            <Skeleton width={60} height={20} />
            <Skeleton width={60} height={20} />
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <LeaderboardCardSkeleton />
          <LeaderboardCardSkeleton />
          <LeaderboardCardSkeleton />
        </div>
      </div>
    </div>
  )
}

