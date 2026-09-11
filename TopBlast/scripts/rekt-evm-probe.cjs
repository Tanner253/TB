/**
 * Can we discover an arbitrary wallet's ERC-20 bags on Robinhood Chain?
 *
 * There is no getTokenAccountsByOwner on EVM, so the plan is:
 *   1. eth_getLogs for Transfer events topic-filtered on the wallet (no
 *      address filter) -> the set of tokens it has ever received.
 *   2. balanceOf(wallet) per candidate -> current holdings.
 *
 * Step 1 is the unknown: does this RPC accept a topic-only query, how wide a
 * block range does it tolerate, and how long does it take? Measure before
 * building on it.
 *
 * Usage: node scripts/rekt-evm-probe.cjs <wallet> [blocks]
 */

const RPC = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com'
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

let nextId = 1
async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  })
  const body = await res.json()
  if (body.error) throw new Error(`${method}: ${body.error.message}`)
  return body.result
}

const topicFor = addr => '0x' + addr.toLowerCase().replace(/^0x/, '').padStart(64, '0')

async function main() {
  const wallet = process.argv[2]
  if (!wallet) throw new Error('pass a wallet address')
  const blocks = BigInt(process.argv[3] || '400000')

  const head = BigInt(await rpc('eth_blockNumber'))
  console.log('head block', head.toString())

  const from = head - blocks
  const walletTopic = topicFor(wallet)

  // --- step 1: topic-only scan, incoming transfers ---
  const t0 = Date.now()
  let logs
  try {
    logs = await rpc('eth_getLogs', [
      {
        fromBlock: '0x' + from.toString(16),
        toBlock: '0x' + head.toString(16),
        topics: [TRANSFER_TOPIC, null, walletTopic],
      },
    ])
  } catch (err) {
    console.log('TOPIC-ONLY SCAN REJECTED:', err.message)
    return
  }
  const elapsed = Date.now() - t0
  console.log(`topic-only scan over ${blocks} blocks: ${logs.length} logs in ${elapsed}ms`)

  const tokens = [...new Set(logs.map(l => l.address.toLowerCase()))]
  console.log('distinct tokens received:', tokens.length)
  console.log(tokens.slice(0, 10))

  // --- step 2: balanceOf each candidate ---
  const BALANCE_OF = '0x70a08231'
  const t1 = Date.now()
  const held = []
  for (const token of tokens.slice(0, 25)) {
    try {
      const data = BALANCE_OF + wallet.toLowerCase().replace(/^0x/, '').padStart(64, '0')
      const raw = await rpc('eth_call', [{ to: token, data }, 'latest'])
      const bal = BigInt(raw || '0x0')
      if (bal > 0n) held.push({ token, balance: bal.toString() })
    } catch (err) {
      console.log('  balanceOf failed', token, err.message)
    }
  }
  console.log(`balanceOf x${Math.min(tokens.length, 25)} in ${Date.now() - t1}ms — ${held.length} non-zero`)
  console.log(held.slice(0, 8))
}

main().catch(err => {
  console.error('FAILED:', err.message)
  process.exit(1)
})
