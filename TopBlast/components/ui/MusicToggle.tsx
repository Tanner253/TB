'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MUSIC_STATE_EVENT, musicEngine } from '@/lib/audio/musicEngine'

function NoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

/**
 * Header music control: click toggles the loop, the popover holds a volume
 * slider. Playback state lives in the shared engine (root-layout provider),
 * so navigating between pages never interrupts the music.
 */
export function MusicToggle({ className = '' }: { className?: string }) {
  const [playing, setPlaying] = useState(false)
  const [open, setOpen] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPlaying(musicEngine.playing)
    setVolume(musicEngine.getVolume())
    const onState = (e: Event) => {
      setPlaying((e as CustomEvent<{ playing: boolean }>).detail?.playing ?? musicEngine.playing)
    }
    window.addEventListener(MUSIC_STATE_EVENT, onState)
    return () => window.removeEventListener(MUSIC_STATE_EVENT, onState)
  }, [])

  useEffect(() => {
    if (!open) return
    const onAway = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onAway)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onAway)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    musicEngine.setWanted(!playing)
    setPlaying(!playing)
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        onClick={() => setOpen(v => !v)}
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
          playing ? 'text-sol-purple bg-sol-purple/10' : 'text-ink-2 hover:text-ink hover:bg-ink/[0.06]'
        }`}
        title="Music"
        aria-label="Music controls"
        aria-expanded={open}
      >
        <NoteIcon />
        {playing ? (
          <motion.span
            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sol-purple"
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            aria-hidden
          />
        ) : null}
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 z-[70] w-52 rounded-xl border border-line bg-card p-3 shadow-card"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Music
              </span>
              <button
                type="button"
                onClick={toggle}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                  playing
                    ? 'bg-sol-purple/15 text-sol-purple hover:bg-sol-purple/25'
                    : 'bg-ink/[0.06] text-ink-2 hover:text-ink'
                }`}
              >
                {playing ? '⏸ Pause' : '▶ Play'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink-3 text-xs" aria-hidden>
                🔈
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={e => {
                  const v = Number(e.target.value) / 100
                  setVolume(v)
                  musicEngine.setVolume(v)
                }}
                className="w-full accent-[rgb(var(--tb-purple))]"
                aria-label="Music volume"
              />
              <span className="text-ink-3 text-xs" aria-hidden>
                🔊
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
