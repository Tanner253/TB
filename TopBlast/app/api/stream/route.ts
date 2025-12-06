/**
 * Server-Sent Events endpoint for real-time data streaming
 * Maintains a persistent connection for live updates
 */

import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const connectMsg = `event: connected\ndata: ${JSON.stringify({ 
        timestamp: Date.now(),
        message: 'Connected to TopBlast stream'
      })}\n\n`
      controller.enqueue(encoder.encode(connectMsg))

      // Keep-alive ping every 30 seconds to prevent timeout
      const pingInterval = setInterval(() => {
        try {
          const pingMsg = `event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`
          controller.enqueue(encoder.encode(pingMsg))
        } catch {
          clearInterval(pingInterval)
        }
      }, 30000)

      // Clean up on abort
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
