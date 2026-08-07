'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export function DocSection({
  id,
  children,
  className = '',
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={`doc-section ${className}`}>
      <div className="doc-section-inner">{children}</div>
    </section>
  )
}

export function DocHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description?: string
}) {
  return (
    <motion.header
      className="doc-header"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
    >
      <p className="doc-eyebrow">{eyebrow}</p>
      <h2 className="doc-title">{title}</h2>
      {description ? <p className="doc-lead">{description}</p> : null}
    </motion.header>
  )
}

export function DocCard({
  title,
  children,
  accent = 'default',
}: {
  title?: string
  children: ReactNode
  accent?: 'default' | 'mint' | 'amber' | 'purple'
}) {
  return (
    <div className={`doc-card doc-card--${accent}`}>
      {title ? <h3 className="doc-card-title">{title}</h3> : null}
      <div className="doc-card-body">{children}</div>
    </div>
  )
}

export function DocGrid({
  cols = 2,
  children,
}: {
  cols?: 2 | 3 | 4
  children: ReactNode
}) {
  return <div className={`doc-grid doc-grid--${cols}`}>{children}</div>
}

export function DocStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="doc-stat">
      <p className="doc-stat-label">{label}</p>
      <p className="doc-stat-value">{value}</p>
      {hint ? <p className="doc-stat-hint">{hint}</p> : null}
    </div>
  )
}

export function DocCode({ children }: { children: string }) {
  return <pre className="doc-code">{children}</pre>
}

export function DocList({ items }: { items: string[] }) {
  return (
    <ul className="doc-list">
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export function DocTable({
  headers,
  rows,
  highlightRow,
}: {
  headers: string[]
  rows: string[][]
  highlightRow?: number
}) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table">
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={highlightRow === i ? 'doc-table-row--highlight' : undefined}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DocCta({
  href,
  label,
  external = true,
  variant = 'primary',
}: {
  href: string
  label: string
  external?: boolean
  variant?: 'primary' | 'ghost'
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={variant === 'primary' ? 'doc-cta doc-cta--primary' : 'doc-cta doc-cta--ghost'}
    >
      {label}
    </a>
  )
}
