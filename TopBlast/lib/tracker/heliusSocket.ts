/**
 * Helius WebSocket - DISABLED for Vercel serverless
 * WebSockets don't work in serverless environments
 * Using polling via API endpoints instead
 */

// No-op exports for compatibility
export function startHeliusWebSocket(): void {
  // Disabled for serverless
}

export function stopHeliusWebSocket(): void {
  // Disabled for serverless
}

export function getWebSocketStatus(): { connected: boolean; trackedCount: number } {
  return { connected: false, trackedCount: 0 }
}

export function isWebSocketConnected(): boolean {
  return false
}

export function updateCurrentPrice(price: number): void {
  // No-op
}
