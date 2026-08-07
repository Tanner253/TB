/** Canonical public URLs (fixed — not env-configurable). */

/** Main TopBlast application (catalog, launch, tenant sessions). */
export const APP_URL = 'https://www.topblastweb3.xyz'

/** Docs / whitepaper site. */
export const WHITEPAPER_URL = 'https://topblastx100.vercel.app'

/** Host only, for inline hints e.g. "www.topblastweb3.xyz/your-slug" */
export const APP_HOSTNAME = 'www.topblastweb3.xyz'

export function appHostname(): string {
  return APP_HOSTNAME
}
