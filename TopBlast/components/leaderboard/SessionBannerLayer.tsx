'use client'

import { useState } from 'react'

interface SessionBannerLayerProps {
  bannerUrl: string | null | undefined
  /** When true, apply a dimming scrim for overlay readability. */
  dimmed?: boolean
}

/**
 * DexScreener header art (native ~600×200) filling a 3:1 frame.
 */
export function SessionBannerLayer({ bannerUrl, dimmed = true }: SessionBannerLayerProps) {
  const [failed, setFailed] = useState(false)
  if (!bannerUrl || failed) return null

  return (
    <div className="absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
      <img
        src={bannerUrl}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          dimmed ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.45)_100%)]" />
      </div>
    </div>
  )
}
