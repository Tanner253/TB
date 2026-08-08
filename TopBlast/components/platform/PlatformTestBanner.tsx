'use client'

import type { PlatformTestBanner as PlatformTestBannerData } from '@/lib/platform/testBanner'

export function PlatformTestBanner({ banner }: { banner: PlatformTestBannerData }) {
  return (
    <div
      role="alert"
      className="relative z-50 border-b-2 border-red-500 bg-gradient-to-r from-red-950 via-red-900/95 to-red-950 shadow-[0_0_40px_rgba(239,68,68,0.35)]"
    >
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[repeating-linear-gradient(-45deg,#fff,#fff_8px,transparent_8px,transparent_16px)]" />
      <div className="relative max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-4 text-center">
          <span className="inline-flex items-center justify-center self-center px-4 py-1.5 rounded-md bg-red-500 text-black font-black text-lg sm:text-xl tracking-[0.2em] uppercase shadow-lg ring-2 ring-red-300/80 animate-pulse">
            {banner.label}
          </span>
          <p className="text-red-100 font-semibold text-sm sm:text-base max-w-4xl leading-snug">
            {banner.message}
          </p>
        </div>
      </div>
    </div>
  )
}
