/**
 * Stream endpoint - Returns status only
 * NOTE: SSE/WebSocket streaming disabled for Vercel serverless compatibility
 * Use polling via /api/leaderboard instead
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Return a simple status response instead of streaming
  // Vercel serverless functions have a 10s timeout and can't maintain persistent connections
  return NextResponse.json({
    success: true,
    message: 'Streaming disabled on serverless. Use polling via /api/leaderboard instead.',
    poll_interval_ms: 5000,
  })
}
