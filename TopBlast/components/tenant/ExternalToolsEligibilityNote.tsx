'use client'

import { useState } from 'react'
import { EXTERNAL_TOOLS_EXPLAINER } from '@/lib/tenant/externalToolsExplainer'

interface ExternalToolsEligibilityNoteProps {
  variant?: 'inline' | 'panel'
  defaultOpen?: boolean
  className?: string
}

export function ExternalToolsEligibilityNote({
  variant = 'panel',
  defaultOpen = false,
  className = '',
}: ExternalToolsEligibilityNoteProps) {
  const [open, setOpen] = useState(defaultOpen)
  const { title, summary, points } = EXTERNAL_TOOLS_EXPLAINER

  if (variant === 'inline') {
    return (
      <p className={`text-xs text-ink-3 leading-relaxed ${className}`}>
        {summary}{' '}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-ink-2 underline underline-offset-2 hover:text-sol-purple-dark transition-colors"
        >
          {open ? 'Hide details' : 'Why gmgn may differ'}
        </button>
        {open ? (
          <ul className="mt-2 space-y-1.5 list-disc pl-4 text-ink-3">
            {points.map(p => (
              <li key={p.label}>
                <span className="text-ink-2">{p.label}:</span> {p.body}
              </li>
            ))}
          </ul>
        ) : null}
      </p>
    )
  }

  return (
    <div
      className={`rounded-xl border border-line bg-ink/[0.02] ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-ink/[0.02] transition-colors rounded-xl"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-2">{title}</p>
          <p className="text-xs text-ink-3 mt-1 leading-relaxed">{summary}</p>
        </div>
        <span className="shrink-0 text-xs text-ink-3 pt-0.5">{open ? '−' : '+'}</span>
      </button>

      {open ? (
        <ul className="px-4 pb-4 space-y-3 border-t border-line pt-3">
          {points.map(p => (
            <li key={p.label} className="text-xs leading-relaxed">
              <p className="font-medium text-ink-2">{p.label}</p>
              <p className="text-ink-3 mt-0.5">{p.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
