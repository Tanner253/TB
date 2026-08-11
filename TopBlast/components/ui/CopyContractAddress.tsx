'use client'

import { useCallback, useState } from 'react'

function formatAddress(address: string) {
  if (address.length <= 14) return address
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function formatWalletAddress(address: string) {
  if (address.length <= 16) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function solscanTokenUrl(mint: string): string {
  return `https://solscan.io/token/${mint}`
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
  const [copied, setCopied] = useState(false)
  const resolvedExplorer = explorerUrl ?? solscanTokenUrl(address)

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }, [address])

  if (variant === 'footer') {
    return (
      <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs ${className}`}>
        <span className="text-gray-600">Pool wallet</span>
        <button
          type="button"
          onClick={onCopy}
          className="group inline-flex items-center gap-1 font-mono text-gray-500 hover:text-rh-lime transition-colors"
          title={`${address}\nCopy public address to send SOL to the reward pool`}
          aria-label="Copy payout pool wallet address"
        >
          <span>{formatWalletAddress(address)}</span>
          <span className="font-sans text-[10px] text-gray-500 group-hover:text-rh-lime">
            {copied ? 'Copied!' : 'Copy'}
          </span>
        </button>
        {resolvedExplorer ? (
          <a
            href={resolvedExplorer}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-gray-500 hover:text-rh-lime transition-colors"
            title="View wallet on Solscan"
            aria-label="View pool wallet on Solscan"
          >
            ↗
          </a>
        ) : null}
        <span className="text-gray-600">· live on-chain</span>
      </span>
    )
  }

  if (variant === 'inline') {
    return (
      <div className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
        <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0">CA</span>
        <button
          type="button"
          onClick={onCopy}
          className="group inline-flex items-center gap-1.5 max-w-full rounded-lg border border-white/25 bg-black/85 px-2 py-1 font-mono text-xs text-rh-lime shadow-[0_2px_8px_rgba(0,0,0,0.65)] hover:border-rh-green/60 hover:bg-black/95 transition-colors"
          title={address}
          aria-label="Copy contract address"
        >
          <span className="truncate">{formatAddress(address)}</span>
          <span className="shrink-0 text-[10px] font-sans text-gray-400 group-hover:text-rh-green">
            {copied ? 'Copied!' : 'Copy'}
          </span>
        </button>
        <a
          href={resolvedExplorer}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[10px] text-gray-500 hover:text-rh-green transition-colors"
          title="View on Solscan"
        >
          ↗
        </a>
      </div>
    )
  }

  return (
    <div
      className={`inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-rh-green/25 bg-black/40 px-4 py-2.5 backdrop-blur-sm ${className}`}
    >
      <span className="text-xs uppercase tracking-wider text-gray-500">${symbol} CA</span>
      <button
        type="button"
        onClick={onCopy}
        className="group flex items-center gap-2 font-mono text-sm text-rh-lime hover:text-rh-green transition-colors"
        title={address}
        aria-label="Copy contract address"
      >
        <span>{formatAddress(address)}</span>
        <span className="text-xs text-gray-500 group-hover:text-rh-green">
          {copied ? 'Copied!' : 'Copy'}
        </span>
      </button>
      <a
        href={resolvedExplorer}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-500 hover:text-rh-green transition-colors"
      >
        Solscan ↗
      </a>
    </div>
  )
}
