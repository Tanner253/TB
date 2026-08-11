'use client'

interface SessionBannerLayerProps {
  bannerUrl: string | null | undefined
}

/** Faded DexScreener header — sits above candlesticks, below page UI. */
export function SessionBannerLayer({ bannerUrl }: SessionBannerLayerProps) {
  if (!bannerUrl) return null

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <img
        src={bannerUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.22] scale-105"
      />
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-y-0 left-0 w-24 sm:w-40 bg-gradient-to-r from-black/85 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-24 sm:w-40 bg-gradient-to-l from-black/70 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/95 to-transparent" />
    </div>
  )
}
