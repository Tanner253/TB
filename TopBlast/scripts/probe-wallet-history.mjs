/**
 * One-off: probe Helius history for a wallet + mint (run from TopBlast dir).
 * Usage: node scripts/probe-wallet-history.mjs <wallet> [mint]
 */
import 'dotenv/config'
import axios from 'axios'
import { parseWalletMintTransactions } from '../lib/solana/helius.ts'

const wallet = process.argv[2] || '98ZzbYBphzGgoEuWhihc4jFoJc9qidmbASPKv5YSwmnc'
const mint =
  process.argv[3] || 'GQgLqxiKWT2VVoe554oUJSkD2cfBE1QWC9bqKgCApump'
const apiKey = process.env.HELIUS_API_KEY
const rpcUrl =
  process.env.HELIUS_RPC_URL?.includes('api-key=')
    ? process.env.HELIUS_RPC_URL
    : `${process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com'}?api-key=${apiKey}`

if (!apiKey) {
  console.error('HELIUS_API_KEY missing')
  process.exit(1)
}

console.log('wallet', wallet)
console.log('mint  ', mint)
console.log('---')

async function probeEnhanced() {
  const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions`
  const res = await axios.get(url, {
    params: { 'api-key': apiKey, limit: 25 },
    validateStatus: () => true,
  })
  console.log('[enhanced] HTTP', res.status)
  if (res.status !== 200) {
    console.log('[enhanced] body', typeof res.data === 'string' ? res.data : res.data)
    return []
  }
  const raw = res.data || []
  console.log('[enhanced] raw tx count', raw.length)
  const types = [...new Set(raw.map(t => t.type))]
  console.log('[enhanced] tx types seen', types.join(', ') || '(none)')

  const withMint = raw.filter(t =>
    (t.tokenTransfers || []).some(x => x.mint === mint)
  )
  console.log('[enhanced] txs touching mint', withMint.length)

  for (const t of withMint.slice(0, 5)) {
    const transfers = (t.tokenTransfers || []).filter(x => x.mint === mint)
    console.log(
      JSON.stringify(
        {
          sig: String(t.signature || '').slice(0, 16) + '…',
          type: t.type,
          source: t.source,
          feePayer: t.feePayer,
          transfers: transfers.map(x => ({
            from: x.fromUserAccount?.slice(0, 8) + '…',
            to: x.toUserAccount?.slice(0, 8) + '…',
            amount: x.tokenAmount,
          })),
          nativeOut: (t.nativeTransfers || [])
            .filter(n => n.fromUserAccount === wallet)
            .reduce((s, n) => s + Number(n.amount || 0), 0),
        },
        null,
        2
      )
    )
  }

  const parsed = parseWalletMintTransactions(wallet, mint, raw)
  console.log('[enhanced] parsed events', parsed.length)
  for (const p of parsed) {
    console.log(
      `  ${p.type} tokens=${p.tokenAmount} sol=${p.solAmount} ts=${new Date(p.timestamp).toISOString()}`
    )
  }
  return parsed
}

async function probeRpcSignatures() {
  const body = {
    jsonrpc: '2.0',
    id: 'sigs',
    method: 'getSignaturesForAddress',
    params: [wallet, { limit: 10 }],
  }
  const res = await axios.post(rpcUrl, body, { validateStatus: () => true })
  console.log('[rpc] getSignaturesForAddress HTTP', res.status, res.data?.error?.message || 'ok')
  const sigs = res.data?.result || []
  console.log('[rpc] recent signatures', sigs.length)
  sigs.slice(0, 5).forEach(s =>
    console.log(`  ${s.signature.slice(0, 20)}… err=${s.err ?? 'null'}`)
  )
}

try {
  await probeRpcSignatures()
  console.log('---')
  await probeEnhanced()
} catch (e) {
  console.error('probe failed', e.message)
  process.exit(1)
}
