'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * Per-field help behind an (i), instead of a paragraph under every input.
 *
 * The listing form has real explaining to do — what a cycle length commits you
 * to, why the payout currency changes what holders see on the chart — but
 * printing all of it at once turned the page into a wall of grey text that
 * people scroll past. Same words, available on demand.
 *
 * Kept as a toggle rather than a hover tooltip: hover help is unreachable on
 * touch, and this is exactly the content someone on a phone needs most.
 */
export function FieldHelp({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  // Horizontal offset from the icon, in px. Anchoring to either edge is not
  // enough: at phone width a 320px panel does not fit on either side of an
  // icon sitting mid-row, so the offset is clamped to keep the panel inside
  // the viewport wherever the icon happens to be.
  const [offset, setOffset] = useState(0)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const rect = wrapRef.current?.getBoundingClientRect()
    if (rect) {
      const margin = 12
      const panel = Math.min(320, window.innerWidth - margin * 2)
      const ideal = rect.left
      const clamped = Math.min(Math.max(margin, ideal), window.innerWidth - panel - margin)
      setOffset(Math.round(clamped - rect.left))
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`What is ${title}?`}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[0.6rem] font-bold leading-none transition-colors ${
          open
            ? 'border-sol-purple bg-sol-purple text-on-accent'
            : 'border-ink-3/50 text-ink-3 hover:border-sol-purple hover:text-sol-purple'
        }`}
      >
        i
      </button>

      <AnimatePresence>
        {open ? (
          <motion.span
            role="note"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            // Width-capped and offset-clamped, so it never leaves the viewport
            // and never widens the page.
            style={{ left: offset }}
            className="absolute top-6 z-20 block w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-sol-purple/30 bg-card p-3 text-xs leading-relaxed text-ink-2 shadow-card" 
          >
            <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wider text-sol-purple">
              {title}
            </span>
            {children}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  )
}

/** Label + optional help toggle, so every field reads the same way. */
export function FieldLabel({
  children,
  help,
  helpTitle,
}: {
  children: React.ReactNode
  help?: React.ReactNode
  helpTitle?: string
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-sm font-medium text-ink-2">{children}</span>
      {help ? <FieldHelp title={helpTitle ?? String(children)}>{help}</FieldHelp> : null}
    </span>
  )
}
