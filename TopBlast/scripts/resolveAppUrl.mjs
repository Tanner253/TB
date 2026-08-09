/**
 * Resolve final app URL — apex domains that 308→www drop Authorization on redirect.
 */
export async function resolveAppUrl(input) {
  const base = (input || '').replace(/\/$/, '')
  if (!base) return base

  try {
    const res = await fetch(`${base}/api/cron/health`, {
      method: 'GET',
      redirect: 'manual',
    })
    if (res.status === 301 || res.status === 308 || res.status === 302 || res.status === 307) {
      const location = res.headers.get('location')
      if (location) {
        const resolved = location.replace(/\/api\/cron\/health\/?.*$/, '').replace(/\/$/, '')
        if (resolved && resolved !== base) {
          console.warn(`[Worker] ${base} redirects → using ${resolved}`)
          return resolved
        }
      }
    }
  } catch {
    // fall through to original URL
  }

  return base
}
