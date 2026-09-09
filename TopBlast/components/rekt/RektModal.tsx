'use client'

/**
 * Rekt Report Card popup (GMGN-style share modal) — mounted once in the root
 * layout, opened from anywhere via openRektModal(wallet?). Renders the card
 * to canvas so the preview is pixel-identical to the downloaded/copied PNG.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BlastyWhale } from '@/components/mascot/BlastyWhale'
import { playPayoutFanfare, playPop } from '@/hooks/useSoundEffects'
import type { RektReportData } from '@/lib/rekt/rektReport'
import {
  renderRektCard,
  REKT_VARIANTS,
  type RektCardVariant,
} from './rektCardCanvas'

export const REKT_OPEN_EVENT = 'tb-open-rekt'

export function openRektModal(wallet?: string, opts?: { autoScan?: boolean }) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(REKT_OPEN_EVENT, { detail: { wallet, autoScan: opts?.autoScan } })
  )
}

const SCAN_LINES = [
  'Diving into the wallet…',
  'Counting the bags…',
  'Measuring the depth…',
  'Consulting the buy history…',
  'Judging silently…',
]

export function RektModal() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<RektReportData | null>(null)
  const [variant, setVariant] = useState<RektCardVariant>('depths')
  const [showWins, setShowWins] = useState(true)
  const [showUsd, setShowUsd] = useState(true)
  const [cardUrl, setCardUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const scanLineRef = useRef(SCAN_LINES[0])
  /** Latest scan fn, so the mount-once open listener can call it. */
  const scanRef = useRef<((wallet?: string) => Promise<void>) | null>(null)

  // open/close plumbing
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ wallet?: string; autoScan?: boolean }>).detail
      const wallet = detail?.wallet
      if (wallet) setInput(wallet)
      setOpen(true)
      // One-click entry points (leaderboard / Hall of Fame rows) scan straight
      // away — pass the wallet explicitly since setInput hasn't flushed yet.
      if (wallet && detail?.autoScan) void scanRef.current?.(wallet)
    }
    window.addEventListener(REKT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(REKT_OPEN_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const scan = useCallback(async (walletOverride?: string) => {
    const wallet = (walletOverride ?? input).trim()
    if (!wallet || loading) return
    scanLineRef.current = SCAN_LINES[Math.floor(Math.random() * SCAN_LINES.length)]
    setLoading(true)
    setError(null)
    setReport(null)
    setCardUrl(null)
    try {
      const res = await fetch(`/api/rekt/${encodeURIComponent(wallet)}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Scan failed')
      setReport(json.data.report as RektReportData)
      playPayoutFanfare()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setLoading(false)
    }
  }, [input, loading])

  useEffect(() => {
    scanRef.current = scan
  }, [scan])

  // re-render the card image when the report or options change
  useEffect(() => {
    let cancelled = false
    if (!report) return
    renderRektCard(report, { variant, showWins, showUsd })
      .then(canvas => {
        if (cancelled) return
        canvasRef.current = canvas
        setCardUrl(canvas.toDataURL('image/png'))
      })
      .catch(() => setError('Could not render the card'))
    return () => {
      cancelled = true
    }
  }, [report, variant, showWins, showUsd])

  const shareText = report
    ? [
        `My Rekt Score: ${report.rektScore}/100 — ${report.grade} 🐳`,
        showWins && report.wins.cyclesWon > 0
          ? `TopBlast paid me ${report.wins.cyclesWon}× for losing.`
          : null,
        'Get your card → topblasted.fun',
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  async function download() {
    if (!canvasRef.current || !report) return
    const a = document.createElement('a')
    a.download = `rekt-${report.wallet.slice(0, 6)}.png`
    a.href = canvasRef.current.toDataURL('image/png')
    a.click()
    playPop()
  }

  async function copyImage() {
    if (!canvasRef.current) return
    try {
      const blob: Blob | null = await new Promise(resolve =>
        canvasRef.current!.toBlob(resolve, 'image/png')
      )
      if (!blob) throw new Error('no blob')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true)
      playPop()
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy not supported here — use Download instead')
    }
  }

  const toggleChip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
      on
        ? 'border-sol-purple/50 bg-sol-purple/10 text-sol-purple'
        : 'border-line text-ink-3 hover:text-ink'
    }`

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Rekt Report Card"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ y: 24, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, scale: 0.96 }}
            className="relative w-full max-w-md max-h-[92vh] overflow-y-auto no-scrollbar rounded-3xl border border-line bg-card shadow-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BlastyWhale size={40} still noShadow />
                <h2 className="text-lg font-extrabold tracking-tight">
                  REKT <span className="gradient-text-accent">REPORT CARD</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 hover:text-ink hover:bg-ink/[0.06]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault()
                scan()
              }}
              className="flex gap-2 mb-4"
            >
              <input
                value={input}
                onChange={e => setInput(e.target.value.trim())}
                placeholder="Solana wallet address…"
                className="flex-1 min-w-0 rounded-xl bg-card-2/70 border border-line px-3 py-2.5 font-mono text-xs focus:border-sol-purple/50 outline-none"
                aria-label="Wallet address"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-sol-purple px-4 py-2.5 text-sm font-bold text-white hover:bg-sol-purple-dark transition-colors disabled:opacity-50"
              >
                {loading ? '…' : 'Scan'}
              </button>
            </form>

            {loading ? (
              <div className="text-center py-8">
                <motion.div
                  animate={{ rotate: [0, -6, 6, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="inline-block"
                >
                  <BlastyWhale pose="idle" size={80} />
                </motion.div>
                <p className="text-sm text-ink-2 animate-pulse mt-1">{scanLineRef.current}</p>
              </div>
            ) : null}

            {error ? (
              <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400 text-center">
                {error}
              </p>
            ) : null}

            {report ? (
              <>
                {/* card preview = exact PNG */}
                <div className="rounded-2xl overflow-hidden border border-line bg-black/40 mb-3">
                  {cardUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cardUrl} alt="Rekt report card" className="w-full h-auto" />
                  ) : (
                    <div className="aspect-[4/5] flex items-center justify-center text-xs text-ink-3">
                      Rendering…
                    </div>
                  )}
                </div>

                {/* variants */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
                  {REKT_VARIANTS.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setVariant(v.id)
                        playPop()
                      }}
                      className={toggleChip(variant === v.id)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>

                {/* toggles */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                  {report.wins.cyclesWon > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowWins(v => !v)}
                      className={toggleChip(showWins)}
                    >
                      🏆 wins {showWins ? 'on' : 'off'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowUsd(v => !v)}
                    className={toggleChip(showUsd)}
                  >
                    💵 $ {showUsd ? 'on' : 'off'}
                  </button>
                </div>

                {/* actions */}
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-sol-purple px-3 py-2.5 text-center text-xs font-bold text-white hover:bg-sol-purple-dark transition-colors"
                  >
                    Share to 𝕏
                  </a>
                  <button
                    type="button"
                    onClick={download}
                    className="rounded-xl border border-line bg-card-2/70 px-3 py-2.5 text-xs font-semibold hover:border-sol-purple/40 transition-colors"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={copyImage}
                    className="rounded-xl border border-line bg-card-2/70 px-3 py-2.5 text-xs font-semibold hover:border-sol-purple/40 transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy image'}
                  </button>
                </div>
                <p className="mt-2 text-center text-[0.65rem] text-ink-3">
                  Tip: attach the downloaded card to your post — X strips pasted text formatting, not
                  images.
                </p>
              </>
            ) : !loading ? (
              <p className="text-center text-xs text-ink-3 py-4">
                Paste any wallet. Blasty grades how underwater it is — and if it ever won TopBlast
                payouts, you can flex those too.
              </p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
