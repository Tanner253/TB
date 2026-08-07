import type { LivePriceSnapshot } from '@/lib/solana/dexscreenerShared'
import {
  DEXSCREENER_TOKEN_API,
  JUPITER_PRICE_API,
  dexScreenerPairWsUrl,
  extractPairFromWsPayload,
  selectBestSolanaPair,
  snapshotFromDexPair,
} from '@/lib/solana/dexscreenerShared'

export type LivePriceConnection = 'connecting' | 'websocket' | 'polling' | 'error'

const PAIR_RECHECK_MS = 15_000
const REST_POLL_MS = 1_000

async function fetchDexScreenerSnapshot(mint: string): Promise<LivePriceSnapshot | null> {
  const res = await fetch(`${DEXSCREENER_TOKEN_API}/${mint}`, { cache: 'no-store' })
  if (!res.ok) return null
  const json = await res.json()
  const best = selectBestSolanaPair(json.pairs ?? [], mint)
  if (!best) return null
  return snapshotFromDexPair(mint, best, 'dexscreener-rest')
}

async function fetchJupiterSnapshot(mint: string): Promise<LivePriceSnapshot | null> {
  const res = await fetch(`${JUPITER_PRICE_API}?ids=${encodeURIComponent(mint)}`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  const json = await res.json()
  const entry = json?.[mint]
  const price = entry?.usdPrice
  if (!price || !Number.isFinite(price)) return null
  return {
    mint,
    price,
    marketCap: null,
    volume24h: null,
    priceChange24h: entry.priceChange24h ?? null,
    dexId: null,
    pairAddress: null,
    migrationStage: null,
    source: 'jupiter-rest',
  }
}

async function resolveSnapshot(mint: string): Promise<LivePriceSnapshot | null> {
  return (await fetchDexScreenerSnapshot(mint)) ?? (await fetchJupiterSnapshot(mint))
}

export interface LivePriceStreamHandle {
  close: () => void
}

/**
 * Real-time price stream from the browser:
 * 1. DexScreener WebSocket on the active pair (same feed as dexscreener.com charts)
 * 2. 1s DexScreener REST fallback if WS blocked
 * 3. Re-resolves pair every 15s for Pump.fun → PumpSwap migration
 */
export function startLivePriceStream(
  mint: string,
  callbacks: {
    onUpdate: (snapshot: LivePriceSnapshot) => void
    onConnectionChange: (state: LivePriceConnection) => void
    onError?: (message: string) => void
  }
): LivePriceStreamHandle {
  let closed = false
  let ws: WebSocket | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pairCheckTimer: ReturnType<typeof setInterval> | null = null
  let activePairAddress: string | null = null
  let wsConnected = false

  const cleanupWs = () => {
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      ws = null
    }
    wsConnected = false
  }

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const startPolling = () => {
    if (pollTimer || closed) return
    callbacks.onConnectionChange('polling')

    const tick = async () => {
      if (closed) return
      const snap = await resolveSnapshot(mint)
      if (snap) {
        callbacks.onUpdate(snap)
        if (snap.pairAddress && snap.pairAddress !== activePairAddress) {
          activePairAddress = snap.pairAddress
          connectWs(snap.pairAddress)
        }
      }
    }

    void tick()
    pollTimer = setInterval(() => void tick(), REST_POLL_MS)
  }

  const connectWs = (pairAddress: string) => {
    if (closed) return
    cleanupWs()
    callbacks.onConnectionChange('connecting')

    try {
      ws = new WebSocket(dexScreenerPairWsUrl(pairAddress))
    } catch {
      startPolling()
      return
    }

    const failToPolling = () => {
      cleanupWs()
      startPolling()
    }

    ws.onopen = () => {
      wsConnected = true
      stopPolling()
      callbacks.onConnectionChange('websocket')
    }

    ws.onmessage = event => {
      if (closed) return
      const raw = typeof event.data === 'string' ? event.data : ''
      if (raw === 'ping') {
        ws?.send('pong')
        return
      }

      try {
        const payload = JSON.parse(raw)
        const pair = extractPairFromWsPayload(payload, mint)
        if (!pair) return
        const snap = snapshotFromDexPair(mint, pair, 'dexscreener-ws')
        if (snap) callbacks.onUpdate(snap)
      } catch {
        /* ignore malformed frames */
      }
    }

    ws.onerror = () => {
      if (!wsConnected) failToPolling()
    }

    ws.onclose = () => {
      if (closed) return
      failToPolling()
    }

    // If WS never opens, fall back quickly
    setTimeout(() => {
      if (!closed && !wsConnected) failToPolling()
    }, 4_000)
  }

  const bootstrap = async () => {
    callbacks.onConnectionChange('connecting')
    const snap = await resolveSnapshot(mint)
    if (closed) return

    if (!snap) {
      callbacks.onConnectionChange('error')
      callbacks.onError?.('Price not indexed yet — common for brand-new Pump.fun tokens')
      startPolling()
      return
    }

    callbacks.onUpdate(snap)
    activePairAddress = snap.pairAddress

    if (snap.pairAddress) {
      connectWs(snap.pairAddress)
    } else {
      startPolling()
    }
  }

  void bootstrap()

  pairCheckTimer = setInterval(async () => {
    if (closed) return
    const snap = await fetchDexScreenerSnapshot(mint)
    if (!snap?.pairAddress) return
    if (snap.pairAddress !== activePairAddress) {
      activePairAddress = snap.pairAddress
      callbacks.onUpdate(snap)
      connectWs(snap.pairAddress)
    }
  }, PAIR_RECHECK_MS)

  return {
    close: () => {
      closed = true
      cleanupWs()
      stopPolling()
      if (pairCheckTimer) clearInterval(pairCheckTimer)
    },
  }
}
