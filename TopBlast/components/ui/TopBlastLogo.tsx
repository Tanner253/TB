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

/** TopBlast whale mark */
export function TopBlastLogo({ size = 'md', className = '' }: TopBlastLogoProps) {
  const px = SIZES[size]
  return (
    <Image
      src="/logo.png"
      alt="TopBlast"
      width={px}
      height={px}
      className={`object-contain rounded-lg ${className}`}
      priority={size === 'xl'}
    />
  )
}
