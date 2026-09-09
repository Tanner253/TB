'use client'

/**
 * Renders the shareable Rekt Report Card as a canvas image (GMGN-style):
 * what you preview is exactly the PNG you download/copy. Blasty stars on
 * every variant — dedicated card art, not the banner/icon assets.
 */

import {
  WHALE_HAPPY_SVG,
  WHALE_IDLE_SVG,
  WHALE_ROCKET_SVG,
  loadSprite,
} from '@/lib/game/whaleSprites'
import type { RektReportData } from '@/lib/rekt/rektReport'

export type RektCardVariant = 'depths' | 'moon' | 'chart'

export const REKT_VARIANTS: Array<{ id: RektCardVariant; label: string }> = [
  { id: 'depths', label: '🌊 Depths' },
  { id: 'moon', label: '🚀 Moon' },
  { id: 'chart', label: '📉 Chart' },
]

export interface RektCardOptions {
  variant: RektCardVariant
  showWins: boolean
  showUsd: boolean
}

const W = 1000
const H = 1250

function fmtUsd(n: number, hide: boolean): string {
  if (hide) return '•••'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`
  return `${sign}$${abs.toFixed(4)}`
}

function shortWallet(w: string): string {
  return w.length > 12 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w
}

function rng(i: number, salt: number): number {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return v - Math.floor(v)
}

function roundRect(x: CanvasRenderingContext2D, a: number, b: number, w: number, h: number, r: number) {
  x.beginPath()
  x.moveTo(a + r, b)
  x.arcTo(a + w, b, a + w, b + h, r)
  x.arcTo(a + w, b + h, a, b + h, r)
  x.arcTo(a, b + h, a, b, r)
  x.arcTo(a, b, a + w, b, r)
  x.closePath()
}

function drawBackground(x: CanvasRenderingContext2D, variant: RektCardVariant) {
  const g = x.createLinearGradient(0, 0, 0, H)
  if (variant === 'depths') {
    g.addColorStop(0, '#1d0f3d')
    g.addColorStop(0.55, '#150a2e')
    g.addColorStop(1, '#060312')
  } else if (variant === 'moon') {
    g.addColorStop(0, '#0b0518')
    g.addColorStop(0.6, '#1c0f38')
    g.addColorStop(1, '#2a1653')
  } else {
    g.addColorStop(0, '#170a2e')
    g.addColorStop(1, '#241047')
  }
  x.fillStyle = g
  x.fillRect(0, 0, W, H)

  if (variant === 'depths') {
    // rising bubbles
    for (let i = 0; i < 26; i++) {
      x.beginPath()
      x.arc(rng(i, 3) * W, rng(i, 7) * H, 3 + rng(i, 11) * 10, 0, Math.PI * 2)
      x.strokeStyle = `rgba(125,211,252,${0.06 + rng(i, 13) * 0.12})`
      x.lineWidth = 2
      x.stroke()
    }
    // light rays from the surface
    for (let i = 0; i < 5; i++) {
      const cx = 100 + i * 200 + rng(i, 17) * 80
      const ray = x.createLinearGradient(cx, 0, cx - 120, H)
      ray.addColorStop(0, 'rgba(167,139,250,0.10)')
      ray.addColorStop(1, 'rgba(167,139,250,0)')
      x.fillStyle = ray
      x.beginPath()
      x.moveTo(cx - 30, 0)
      x.lineTo(cx + 30, 0)
      x.lineTo(cx - 90, H)
      x.lineTo(cx - 150, H)
      x.closePath()
      x.fill()
    }
  } else if (variant === 'moon') {
    // stars + moon
    for (let i = 0; i < 90; i++) {
      const s = 1 + rng(i, 5) * 3
      x.fillStyle = `rgba(255,255,255,${0.15 + rng(i, 9) * 0.5})`
      x.fillRect(rng(i, 3) * W, rng(i, 7) * H, s, s)
    }
    x.beginPath()
    x.arc(W - 160, 190, 90, 0, Math.PI * 2)
    x.fillStyle = '#e9e5f8'
    x.fill()
    x.beginPath()
    x.arc(W - 190, 165, 22, 0, Math.PI * 2)
    x.arc(W - 130, 210, 16, 0, Math.PI * 2)
    x.fillStyle = '#cfc7ec'
    x.fill()
  } else {
    // falling red candlesticks
    for (let i = 0; i < 14; i++) {
      const cx = 30 + i * 72
      const hgt = 90 + rng(i, 3) * 220
      const top = H - hgt - 40 - rng(i, 5) * 140
      const green = rng(i, 8) > 0.72
      x.fillStyle = green ? 'rgba(8,153,129,0.35)' : 'rgba(242,54,69,0.4)'
      x.fillRect(cx, top, 34, hgt)
      x.fillRect(cx + 15, top - 26, 4, hgt + 52)
    }
  }

  // vignette for text legibility
  const v = x.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, H)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.45)')
  x.fillStyle = v
  x.fillRect(0, 0, W, H)
}

/** Renders the card; returns the canvas (use .toDataURL / .toBlob on it). */
export async function renderRektCard(
  report: RektReportData,
  opts: RektCardOptions
): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([
      document.fonts.load('800 84px Inter'),
      document.fonts.load('700 34px "JetBrains Mono"'),
    ])
  } catch {
    /* fall back to system fonts */
  }

  const whaleSvg =
    opts.variant === 'moon'
      ? WHALE_ROCKET_SVG
      : report.rektScore >= 40
        ? WHALE_IDLE_SVG
        : WHALE_HAPPY_SVG
  const whale = await loadSprite(whaleSvg).catch(() => null)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const x = canvas.getContext('2d')!

  drawBackground(x, opts.variant)

  // header
  x.textAlign = 'left'
  x.textBaseline = 'alphabetic'
  x.font = '800 44px Inter, sans-serif'
  x.fillStyle = '#a78bfa'
  x.fillText('TOP', 60, 92)
  const tw = x.measureText('TOP').width
  x.fillStyle = '#ffffff'
  x.fillText('BLAST', 60 + tw, 92)
  x.font = '700 26px Inter, sans-serif'
  x.fillStyle = 'rgba(233,213,255,0.85)'
  x.fillText('REKT REPORT CARD', 62, 132)
  x.font = '700 30px "JetBrains Mono", monospace'
  x.fillStyle = 'rgba(255,255,255,0.6)'
  x.textAlign = 'right'
  x.fillText(shortWallet(report.wallet), W - 60, 100)

  // Blasty
  if (whale) {
    const ww = 460
    const wh = (ww * 250) / 320
    x.save()
    x.translate(W - ww / 2 - 40, 340)
    if (opts.variant === 'moon') x.rotate(-0.15)
    x.drawImage(whale, -ww / 2, -wh / 2, ww, wh)
    x.restore()
  }

  // score block
  x.textAlign = 'left'
  x.font = '800 190px Inter, sans-serif'
  x.fillStyle = report.rektScore >= 40 ? '#fb7185' : '#34d399'
  x.fillText(String(report.rektScore), 60, 420)
  const sw = x.measureText(String(report.rektScore)).width
  x.font = '800 60px Inter, sans-serif'
  x.fillStyle = 'rgba(255,255,255,0.45)'
  x.fillText('/100', 66 + sw, 420)

  // grade chip
  x.font = '800 46px Inter, sans-serif'
  const gw = x.measureText(report.grade).width
  x.fillStyle = 'rgba(153,69,255,0.35)'
  roundRect(x, 58, 452, gw + 56, 76, 20)
  x.fill()
  x.strokeStyle = 'rgba(167,139,250,0.8)'
  x.lineWidth = 3
  roundRect(x, 58, 452, gw + 56, 76, 20)
  x.stroke()
  x.fillStyle = '#ffffff'
  x.fillText(report.grade, 86, 506)

  // quip
  x.font = 'italic 600 30px Inter, sans-serif'
  x.fillStyle = 'rgba(233,213,255,0.9)'
  x.fillText(`“${report.quip}”`, 60, 578)

  // stat rows
  const rows: Array<[string, string, string]> = [
    ['Unrealized PnL', fmtUsd(report.totalPnlUsd, !opts.showUsd), report.totalPnlUsd < 0 ? '#fb7185' : '#34d399'],
    ['Cost basis', fmtUsd(report.totalCostUsd, !opts.showUsd), '#ffffff'],
    ['Bags value', fmtUsd(report.totalValueUsd, !opts.showUsd), '#ffffff'],
  ]
  const worst = report.bags.find(b => (b.drawdownPct ?? 1) < 0)
  if (worst && worst.drawdownPct != null) {
    rows.push([`Worst bag · $${worst.symbol}`, `${worst.drawdownPct.toFixed(1)}%`, '#fb7185'])
  }

  let ry = 660
  x.font = '600 32px Inter, sans-serif'
  for (const [label, value, color] of rows) {
    x.fillStyle = 'rgba(255,255,255,0.55)'
    x.textAlign = 'left'
    x.fillText(label, 60, ry)
    x.font = '800 34px "JetBrains Mono", monospace'
    x.fillStyle = color
    x.textAlign = 'right'
    x.fillText(value, W - 60, ry)
    x.font = '600 32px Inter, sans-serif'
    ry += 58
  }

  // wins flex
  if (opts.showWins && report.wins.cyclesWon > 0) {
    ry += 16
    roundRect(x, 56, ry - 44, W - 112, 108, 22)
    x.fillStyle = 'rgba(250,204,21,0.12)'
    x.fill()
    x.strokeStyle = 'rgba(250,204,21,0.55)'
    x.lineWidth = 3
    roundRect(x, 56, ry - 44, W - 112, 108, 22)
    x.stroke()
    x.textAlign = 'left'
    x.font = '800 36px Inter, sans-serif'
    x.fillStyle = '#fde047'
    x.fillText(
      `🏆 Paid ${report.wins.cyclesWon}× for losing${opts.showUsd ? ` · ${fmtUsd(report.wins.totalUsd, false)}` : ''}`,
      86,
      ry + 6
    )
    x.font = '600 26px Inter, sans-serif'
    x.fillStyle = 'rgba(255,255,255,0.7)'
    const tokens = report.wins.tokens
      .slice(0, 4)
      .map(t => `$${t.symbol} ×${t.cycles}`)
      .join('   ')
    x.fillText(tokens, 86, ry + 46)
    ry += 110
  }

  // footer
  x.textAlign = 'center'
  x.font = '700 30px Inter, sans-serif'
  x.fillStyle = '#e9d5ff'
  x.fillText('when you drawdown, we blast you up', W / 2, H - 96)
  x.font = '800 34px "JetBrains Mono", monospace'
  x.fillStyle = '#a78bfa'
  x.fillText('topblasted.fun', W / 2, H - 50)

  return canvas
}
