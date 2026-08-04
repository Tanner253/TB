'use client'

import Image from 'next/image'

type TopBlastLogoProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = {
  sm: 32,
  md: 40,
  lg: 64,
  xl: 96,
}

/** TopBlast rocket logo — Robinhood green brand */
export function TopBlastLogo({ size = 'md', className = '' }: TopBlastLogoProps) {
  const px = SIZES[size]
  return (
    <Image
      src="/logo.png"
      alt="TopBlast"
      width={px}
      height={px}
      className={`object-contain ${className}`}
      priority={size === 'xl'}
    />
  )
}
