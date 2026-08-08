/** Canonical public URLs (fixed — not env-configurable). */

/** Main TopBlast application (catalog, launch, tenant sessions). */
export const APP_URL = 'https://topblasted.fun'

/** Docs / whitepaper site. */
export const WHITEPAPER_URL = 'https://topblastx100.vercel.app'

/** Host only, for inline hints e.g. "topblasted.fun/your-slug" */
export const APP_HOSTNAME = 'topblasted.fun'

export function appHostname(): string {
  return APP_HOSTNAME
}
