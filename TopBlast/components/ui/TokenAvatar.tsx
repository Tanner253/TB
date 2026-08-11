'use client'

type TokenAvatarSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<TokenAvatarSize, string> = {
  sm: 'h-8 w-8 text-[0.65rem] rounded-lg',
  md: 'h-9 w-9 text-xs rounded-lg',
  lg: 'h-11 w-11 text-sm rounded-xl',
}

interface TokenAvatarProps {
  symbol: string
  iconUrl?: string | null
  size?: TokenAvatarSize
  highlighted?: boolean
  className?: string
}

export function TokenAvatar({
  symbol,
  iconUrl,
  size = 'md',
  highlighted = false,
  className = '',
}: TokenAvatarProps) {
  const sizeClass = SIZE_CLASS[size]
  const fallbackLabel = symbol.slice(0, 2).toUpperCase() || '?'
  const frameClass = highlighted
    ? 'border-sol-mint/30 bg-sol-mint/10'
    : 'border-white/10 bg-white/5 text-gray-300'

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={`${sizeClass} shrink-0 object-cover border ${frameClass} ${className}`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} shrink-0 flex items-center justify-center font-bold border ${frameClass} ${className}`}
      aria-hidden
    >
      {fallbackLabel}
    </div>
  )
}
