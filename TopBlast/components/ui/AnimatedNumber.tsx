'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  duration?: number
  format?: 'currency' | 'percent' | 'number' | 'compact'
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
  showChange?: boolean
}

export function AnimatedNumber({
  value,
  duration = 0.5,
  format = 'number',
  decimals = 2,
  prefix = '',
  suffix = '',
  className = '',
  showChange = false,
}: AnimatedNumberProps) {
  const [prevValue, setPrevValue] = useState(value)
  const [changeDirection, setChangeDirection] = useState<'up' | 'down' | null>(null)
  
  const spring = useSpring(value, {
    stiffness: 100,
    damping: 30,
    duration: duration * 1000,
  })

  const display = useTransform(spring, (current) => {
    return formatValue(current, format, decimals)
  })

  useEffect(() => {
    if (showChange && value !== prevValue) {
      setChangeDirection(value > prevValue ? 'up' : 'down')
      setTimeout(() => setChangeDirection(null), 1000)
    }
    setPrevValue(value)
    spring.set(value)
  }, [value, spring, prevValue, showChange])

  return (
    <motion.span
      className={`inline-flex items-center gap-1 ${className}`}
      animate={changeDirection ? {
        color: changeDirection === 'up' ? ['inherit', '#22c55e', 'inherit'] : ['inherit', '#ef4444', 'inherit'],
      } : {}}
      transition={{ duration: 0.5 }}
    >
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
      {showChange && changeDirection && (
        <motion.span
          initial={{ opacity: 0, y: changeDirection === 'up' ? 10 : -10 }}
          animate={{ opacity: [1, 0], y: 0 }}
          transition={{ duration: 1 }}
          className={changeDirection === 'up' ? 'text-green-400' : 'text-red-400'}
        >
          {changeDirection === 'up' ? '↑' : '↓'}
        </motion.span>
      )}
    </motion.span>
  )
}

function formatValue(value: number, format: string, decimals: number): string {
  if (isNaN(value)) return '0'

  switch (format) {
    case 'currency':
      if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
      if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
      if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
      return `$${value.toFixed(decimals)}`
    case 'percent':
      return `${value.toFixed(decimals)}%`
    case 'compact':
      if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
      return value.toFixed(0)
    default:
      return value.toLocaleString('en-US', { maximumFractionDigits: decimals })
  }
}

// Countdown timer with animated digits
interface CountdownProps {
  seconds: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabels?: boolean
  className?: string
}

export function Countdown({ seconds, size = 'lg', showLabels = true, className = '' }: CountdownProps) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
    xl: 'text-6xl',
  }

  return (
    <div className={`font-mono font-bold ${sizeClasses[size]} ${className}`}>
      <div className="flex items-center justify-center gap-1">
        {hours > 0 && (
          <>
            <CountdownDigit value={hours} />
            <span className="text-gray-500">:</span>
          </>
        )}
        <CountdownDigit value={minutes} />
        <span className="text-gray-500 animate-pulse">:</span>
        <CountdownDigit value={secs} />
      </div>
      {showLabels && (
        <div className="flex justify-center gap-8 text-xs text-gray-500 mt-1 font-sans font-normal">
          {hours > 0 && <span>hrs</span>}
          <span>min</span>
          <span>sec</span>
        </div>
      )}
    </div>
  )
}

function CountdownDigit({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="inline-block min-w-[2ch] text-center"
    >
      {value.toString().padStart(2, '0')}
    </motion.span>
  )
}

// Price ticker with live updates
interface PriceTickerProps {
  price: number | null
  change?: number | null
  symbol?: string
  size?: 'sm' | 'md' | 'lg'
}

export function PriceTicker({ price, change, symbol = '', size = 'md' }: PriceTickerProps) {
  const [flash, setFlash] = useState(false)
  const prevPrice = useRef(price)

  useEffect(() => {
    if (price !== prevPrice.current) {
      setFlash(true)
      setTimeout(() => setFlash(false), 300)
      prevPrice.current = price
    }
  }, [price])

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  }

  if (price === null) {
    return <span className="text-gray-500">Loading...</span>
  }

  const formattedPrice = price < 0.0001 
    ? `$${price.toPrecision(2)}` 
    : price < 1 
    ? `$${price.toFixed(6)}` 
    : `$${price.toFixed(2)}`

  return (
    <div className={`flex items-center gap-2 ${sizeClasses[size]}`}>
      {symbol && <span className="text-gray-400">{symbol}</span>}
      <motion.span
        className={`font-bold font-mono transition-colors ${
          flash ? 'text-cyan-400' : 'text-white'
        }`}
        animate={flash ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.2 }}
      >
        {formattedPrice}
      </motion.span>
      {change !== null && change !== undefined && (
        <span className={`text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </span>
      )}
    </div>
  )
}

