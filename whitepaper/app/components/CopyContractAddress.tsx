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
      // clipboard unavailable
    }
  }, [address])

  const explorer =
    explorerUrl ?? `https://robinhoodchain.blockscout.com/address/${address}`

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
