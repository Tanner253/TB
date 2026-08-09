#!/usr/bin/env node
/**
 * Background worker — POST /api/cron/tenants on a schedule.
 * Render cron, GitHub Actions, or any scheduler can invoke this script.
 *
 * Env: TOPBLAST_APP_URL (e.g. https://topblasted.fun), CRON_SECRET
 */
const appUrl = (process.env.TOPBLAST_APP_URL || process.env.APP_URL || '').replace(/\/$/, '')
const secret = process.env.CRON_SECRET || ''

if (!appUrl) {
  console.error('[Worker] TOPBLAST_APP_URL or APP_URL is required')
  process.exit(1)
}

if (!secret) {
  console.error('[Worker] CRON_SECRET is required')
  process.exit(1)
}

const url = `${appUrl}/api/cron/tenants`

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  })
  const body = await res.text()
  if (!res.ok) {
    console.error(`[Worker] ${res.status} ${body}`)
    process.exit(1)
  }
  console.log(`[Worker] OK ${res.status}`, body.slice(0, 500))
} catch (err) {
  console.error('[Worker] Request failed:', err)
  process.exit(1)
}
