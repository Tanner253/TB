'use client'

import { useCallback, useState } from 'react'
import { explorerLabel, tokenExplorerUrl } from '@/lib/platform/explorer'
import { CHAIN_ID, CHAIN_NAME } from '@/lib/marketing/urls'

function formatAddress(address: string) {
  if (address.length <= 14) return address
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function formatWalletAddress(address: string) {
  if (address.length <= 16) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * Token page on whichever explorer the address belongs to — Blockscout for
 * Robinhood Chain, Solscan for the legacy chain. Kept under the old name so
 * existing imports keep working.
 */
export function solscanTokenUrl(mint: string): string {
  return tokenExplorerUrl(mint) ?? ''
}

/**
 * Copy that actually reports what happened.
 *
 * `navigator.clipboard.writeText` rejects in more cases than it looks —
 * an unfocused document is enough, and it throws NotAllowedError. Swallowing
 * that left the button silently dead, which is indistinguishable from a broken
 * address. So: try the async API, fall back to a hidden textarea + execCommand,
 * and only then admit failure in the label.
 */
async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    // fall through to the legacy path
  }
  try {
    const el = document.createElement('textarea')
    el.value = value
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.top = '-1000px'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    el.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

type CopyState = 'idle' | 'copied' | 'failed'

function copyLabel(state: CopyState): string {
  if (state === 'copied') return 'Copied!'
  if (state === 'failed') return 'Press ⌘/Ctrl+C'
  return 'Copy'
}

type CopyContractAddressProps = {
  address: string
  symbol?: string
  explorerUrl?: string | null
  className?: string
  /** pill = standalone row; inline = compact control for ticker bars; footer = pool wallet row */
  variant?: 'pill' | 'inline' | 'footer'
}

export function CopyContractAddress({
  address,
  symbol = 'Token',
  explorerUrl,
  className = '',
  variant = 'pill',
}: CopyContractAddressProps) {
  const [state, setState] = useState<CopyState>('idle')
  const resolvedExplorer = explorerUrl ?? tokenExplorerUrl(address)
  const label = explorerLabel(address)

  const onCopy = useCallback(async () => {
    // A failed copy still leaves the address selectable in the title, and the
    // label tells the reader to use the keyboard.
    const ok = await copyText(address)
    setState(ok ? 'copied' : 'failed')
    window.setTimeout(() => setState('idle'), ok ? 2000 : 4000)
  }, [address])

  if (variant === 'footer') {
    return (
      <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs ${className}`}>
        <span className="text-ink-3">Pool wallet</span>
        <button
          type="button"
          onClick={onCopy}
          className="group inline-flex items-center gap-1 font-mono text-ink-3 hover:text-sol-purple-dark transition-colors"
          title={`${address}\nCopy public address to send ETH to the reward pool.\n${CHAIN_NAME} only — chain ID ${CHAIN_ID}.`}
          aria-label="Copy payout pool wallet address"
        >
          <span>{formatWalletAddress(address)}</span>
          <span className="font-sans text-[10px] text-ink-3 group-hover:text-sol-purple-dark">
            {copyLabel(state)}
          </span>
        </button>
        {resolvedExplorer ? (
          <a
            href={resolvedExplorer}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-ink-3 hover:text-sol-purple-dark transition-colors"
            title={`View wallet on ${label}`}
            aria-label={`View pool wallet on ${label}`}
          >
            ↗
          </a>
        ) : null}
        <span className="text-ink-3">· {CHAIN_NAME} only</span>
      </span>
    )
  }

  if (variant === 'inline') {
    return (
      <div className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
        <span className="text-[10px] uppercase tracking-wider text-ink-3 shrink-0">CA</span>
        <button
          type="button"
          onClick={onCopy}
          className="group inline-flex items-center gap-1.5 max-w-full rounded-lg border border-line bg-card/90 px-2 py-1 font-mono text-xs text-sol-purple shadow-sm dark:border-white/25 dark:bg-black/85 dark:text-sol-purple dark:shadow-[0_2px_8px_rgba(0,0,0,0.65)] hover:border-rh-green/60 transition-colors"
          title={address}
          aria-label="Copy contract address"
        >
          <span className="truncate">{formatAddress(address)}</span>
          <span className="shrink-0 text-[10px] font-sans text-ink-2 group-hover:text-rh-green">
            {copyLabel(state)}
          </span>
        </button>
        {resolvedExplorer ? (
          <a
            href={resolvedExplorer}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[10px] text-ink-3 hover:text-rh-green transition-colors"
            title={`View on ${label}`}
          >
            ↗
          </a>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={`inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-rh-green/25 bg-card/70 px-4 py-2.5 backdrop-blur-sm ${className}`}
    >
      <span className="text-xs uppercase tracking-wider text-ink-3">${symbol} CA</span>
      <button
        type="button"
        onClick={onCopy}
        className="group flex items-center gap-2 font-mono text-sm text-sol-purple hover:text-rh-green transition-colors"
        title={address}
        aria-label="Copy contract address"
      >
        <span>{formatAddress(address)}</span>
        <span className="text-xs text-ink-3 group-hover:text-rh-green">{copyLabel(state)}</span>
      </button>
      {resolvedExplorer ? (
        <a
          href={resolvedExplorer}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-ink-3 hover:text-rh-green transition-colors"
        >
          {label} ↗
        </a>
      ) : null}
    </div>
  )
}
