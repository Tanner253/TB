'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type TokenAvatarSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<TokenAvatarSize, string> = {
  sm: 'h-8 w-8 text-[0.65rem] rounded-lg',
  md: 'h-9 w-9 text-xs rounded-lg',
  lg: 'h-11 w-11 text-sm rounded-xl',
}

const PREVIEW_PX = 128

interface TokenAvatarProps {
  symbol: string
  iconUrl?: string | null
  size?: TokenAvatarSize
  highlighted?: boolean
  className?: string
  /** Show a larger floating preview on hover (catalog). */
  previewOnHover?: boolean
}

export function TokenAvatar({
  symbol,
  iconUrl,
  size = 'md',
  highlighted = false,
  className = '',
  previewOnHover = false,
}: TokenAvatarProps) {
  const [failed, setFailed] = useState(false)
  const [preview, setPreview] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const previewId = useId()

  const sizeClass = SIZE_CLASS[size]
  const fallbackLabel = symbol.slice(0, 2).toUpperCase() || '?'
  const frameClass = highlighted
    ? 'border-sol-mint/30 bg-sol-mint/10'
    : 'border-white/10 bg-white/5 text-gray-300'

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePreviewPosition = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 10
    const box = PREVIEW_PX + 24 // image + padding + label
    let top = rect.top - gap - box
    if (top < 8) {
      top = rect.bottom + gap
    }
    const left = rect.left + rect.width / 2
    setPreview({ top, left })
  }, [])

  const showPreview = useCallback(() => {
    updatePreviewPosition()
  }, [updatePreviewPosition])

  const hidePreview = useCallback(() => {
    setPreview(null)
  }, [])

  useEffect(() => {
    if (!preview) return
    const onScrollOrResize = () => updatePreviewPosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [preview, updatePreviewPosition])

  const thumb =
    iconUrl && !failed ? (
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${sizeClass} shrink-0 object-cover border ${frameClass}`}
      />
    ) : (
      <div
        className={`${sizeClass} shrink-0 flex items-center justify-center font-bold border ${frameClass}`}
        aria-hidden
      >
        {fallbackLabel}
      </div>
    )

  if (!previewOnHover || !iconUrl || failed) {
    if (iconUrl && !failed) {
      return (
        <img
          src={iconUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
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

  return (
    <span
      ref={rootRef}
      className={`relative inline-flex shrink-0 ${className}`}
      onMouseEnter={showPreview}
      onMouseLeave={hidePreview}
      onFocus={showPreview}
      onBlur={hidePreview}
    >
      {thumb}
      {mounted && preview
        ? createPortal(
            <div
              id={previewId}
              role="presentation"
              className="pointer-events-none fixed z-[9999]"
              style={{
                top: preview.top,
                left: preview.left,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="rounded-2xl border border-white/25 bg-black/95 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.75)]">
                <img
                  src={iconUrl}
                  alt=""
                  width={PREVIEW_PX}
                  height={PREVIEW_PX}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="block rounded-xl object-cover"
                  style={{ width: PREVIEW_PX, height: PREVIEW_PX, aspectRatio: '1 / 1' }}
                />
                <div className="mt-1.5 text-center text-[0.7rem] font-semibold text-white">
                  ${symbol}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </span>
  )
}
