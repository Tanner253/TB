'use client'

import { useCallback, useState } from 'react'

function formatAddress(address: string) {
  if (address.length <= 14) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

type CopyContractAddressProps = {
  address: string
  symbol?: string
  explorerUrl?: string
  className?: string
}

export function CopyContractAddress({
  address,
  symbol = 'TopBlast',
  explorerUrl,
  className = '',
}: CopyContractAddressProps) {
  const [copied, setCopied] = useState(false)

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // writeText rejects on an unfocused document, among others. Fall back to
      // the legacy path rather than leaving the button silently dead.
      try {
        const el = document.createElement('textarea')
        el.value = address
        el.setAttribute('readonly', '')
        el.style.position = 'fixed'
        el.style.opacity = '0'
        document.body.appendChild(el)
        el.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(el)
        if (ok) {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        }
      } catch {
        // nothing more to try; the address stays selectable in the title
      }
    }
  }, [address])

  // Robinhood Chain runs Blockscout; the chain.robinhood.com redirect drops
  // the path, so link the canonical host directly. A legacy base58 mint still
  // belongs on Solscan.
  const isEvm = /^0x[0-9a-fA-F]{40}$/.test(address.trim())
  const explorer =
    explorerUrl ??
    (isEvm
      ? `https://robinhoodchain.blockscout.com/token/${address}`
      : `https://solscan.io/token/${address}`)

  return (
    <div
      className={`inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-rh-green/25 bg-black/40 px-4 py-2.5 backdrop-blur-sm ${className}`}
    >
      <span className="text-xs uppercase tracking-wider text-gray-500">${symbol} CA</span>
      <button
        type="button"
        onClick={onCopy}
        className="group flex items-center gap-2 font-mono text-sm text-rh-lime hover:text-rh-green transition-colors"
        title="Click to copy contract address"
        aria-label="Copy contract address"
      >
        <span>{formatAddress(address)}</span>
        <span className="text-xs text-gray-500 group-hover:text-rh-green">
          {copied ? 'Copied!' : 'Copy'}
        </span>
      </button>
      <a
        href={explorer}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-500 hover:text-rh-green transition-colors"
      >
        Explorer ↗
      </a>
    </div>
  )
}
