#!/usr/bin/env node
/**
 * Proof-of-life against a deployed TopBlast URL (prod or preview).
 * Safe by default — does not run tenant cycles unless you pass --execute.
 */
import { resolveAppUrl } from './resolveAppUrl.mjs'

const args = process.argv.slice(2)
const execute = args.includes('--execute')

const rawUrl = process.env.TOPBLAST_APP_URL || process.env.APP_URL || ''
const secret = process.env.CRON_SECRET || ''

function fail(message) {
  console.error(`[proof-of-life] FAIL: ${message}`)
  process.exit(1)
}

function pass(message) {
  console.log(`[proof-of-life] OK: ${message}`)
}

if (!rawUrl) {
  fail('Set TOPBLAST_APP_URL (use https://www.topblasted.fun if apex redirects)')
}

const appUrl = await resolveAppUrl(rawUrl)

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options)
  let body
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { res, body }
}

async function main() {
  console.log(`[proof-of-life] Target: ${appUrl}`)
  console.log(`[proof-of-life] Mode: ${execute ? 'full worker cycle' : 'read-only checks only'}`)
  console.log('')

  // 1. Public leaderboard — app is up
  {
    const { res, body } = await fetchJson(`${appUrl}/api/leaderboard?limit=1`)
    if (!res.ok) {
      fail(`GET /api/leaderboard → ${res.status}`)
    }
    if (!body?.success) {
      fail(`GET /api/leaderboard returned success=false: ${body?.error ?? 'unknown'}`)
    }
    pass(`GET /api/leaderboard → ${res.status}`)
    const readOnly = body?.data?.read_only_poll
    if (readOnly === true) {
      console.log('  → read_only_poll=true (WORKER_OWNS_INDEXING already enabled on target)')
    } else if (readOnly === false) {
      console.log('  → read_only_poll=false (client polls still trigger Helius on target)')
    } else {
      console.log('  → read_only_poll not in response (deploy worker-mode code first)')
    }
  }

  // 2. Cron auth — requires CRON_SECRET on prod
  if (!secret) {
    console.log('')
    console.warn('[proof-of-life] SKIP: CRON_SECRET not set — cannot verify worker auth')
    if (execute) fail('--execute requires CRON_SECRET')
    console.log('[proof-of-life] Done (partial — set CRON_SECRET for full check)')
    return
  }

  {
    const res = await fetch(`${appUrl}/api/cron/health`, {
      headers: { Authorization: `Bearer wrong-secret` },
    })
    if (res.status === 404) {
      fail('GET /api/cron/health → 404 (deploy worker-mode code to target first)')
    }
    if (res.status !== 401) {
      fail(`GET /api/cron/health with bad secret → ${res.status} (expected 401)`)
    }
    pass('GET /api/cron/health rejects bad secret → 401')
  }

  {
    const { res, body } = await fetchJson(`${appUrl}/api/cron/health`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    if (!res.ok) {
      fail(`GET /api/cron/health → ${res.status} ${JSON.stringify(body)}`)
    }
    if (!body?.ok) {
      fail('GET /api/cron/health returned ok=false')
    }
    pass(`GET /api/cron/health → ${res.status}`)
    console.log(`  → worker_owns_indexing=${body.worker_owns_indexing}`)
    console.log(`  → execute_payouts=${body.execute_payouts}`)
  }

  if (!execute) {
    console.log('')
    console.log('[proof-of-life] All read-only checks passed.')
    console.log('[proof-of-life] Run with --execute to POST /api/cron/tenants once (indexes + may payout).')
    return
  }

  // 3. Full worker cycle (same as Render cron)
  {
    const { res, body } = await fetchJson(`${appUrl}/api/cron/tenants`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    })
    const text = body ? JSON.stringify(body).slice(0, 400) : await res.text().catch(() => '')
    if (!res.ok) {
      fail(`POST /api/cron/tenants → ${res.status} ${text}`)
    }
    pass(`POST /api/cron/tenants → ${res.status}`)
    if (body?.data?.processed != null) {
      console.log(`  → processed ${body.data.processed} tenant(s)`)
    }
  }

  console.log('')
  console.log('[proof-of-life] Full worker cycle succeeded. Safe to deploy Render + enable WORKER_OWNS_INDEXING.')
}

main().catch(err => {
  console.error('[proof-of-life] Error:', err)
  process.exit(1)
})
