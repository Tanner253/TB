import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

/**
 * Dev-only sink for scripts/brand/generate.html.
 *
 * The brand assets are drawn on a canvas in the browser; this is how the
 * resulting PNGs get onto disk. Never available in production — regenerating
 * branding is a local, deliberate act.
 */
const ALLOWED = new Set(['icon.png', 'logo.png', 'banner.png', 'og-image.png', 'favicon-src.png'])

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const { name, dataUrl } = (await request.json()) as { name?: string; dataUrl?: string }
  if (!name || !ALLOWED.has(name)) {
    return NextResponse.json({ error: `name must be one of ${[...ALLOWED].join(', ')}` }, { status: 400 })
  }
  // JPEG is allowed because the wide assets (banner, OG) are photographic
  // gradients — PNG makes them 5x larger for no visible gain.
  const prefix = ['data:image/png;base64,', 'data:image/jpeg;base64,'].find(p => dataUrl?.startsWith(p))
  if (!dataUrl || !prefix) {
    return NextResponse.json({ error: 'dataUrl must be a base64 PNG or JPEG' }, { status: 400 })
  }

  const bytes = Buffer.from(dataUrl.slice(prefix.length), 'base64')
  const dest = path.join(process.cwd(), 'public', name)
  await writeFile(dest, bytes)

  return NextResponse.json({ ok: true, name, bytes: bytes.length, dest })
}
