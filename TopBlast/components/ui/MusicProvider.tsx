'use client'

import { useEffect } from 'react'
import { musicEngine } from '@/lib/audio/musicEngine'

/**
 * Lives in the root layout (persists across page navigations) and starts the
 * background music on the visitor's first tap/keypress — the earliest moment
 * browsers allow audio. Music is on by default; the header toggle mutes it.
 * Nothing here stops the engine on unmount, so route changes never cut the loop.
 */
export function MusicProvider() {
  useEffect(() => {
    if (!musicEngine.isWanted() || musicEngine.playing) return
    const resume = () => {
      if (musicEngine.isWanted()) musicEngine.setWanted(true)
      cleanup()
    }
    const cleanup = () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
    window.addEventListener('pointerdown', resume, { once: true })
    window.addEventListener('keydown', resume, { once: true })
    return cleanup
  }, [])

  return null
}
