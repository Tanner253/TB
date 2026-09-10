/** Canonical public URLs (fixed — not env-configurable). */

/** Main TopBlast application (catalog, launch, tenant sessions). */
export const APP_URL = 'https://topblast.family'

/** Docs / whitepaper site. */
export const WHITEPAPER_URL = 'https://whitepaper.topblast.family'

/** Host only, for inline hints e.g. "topblast.family/your-slug" */
export const APP_HOSTNAME = 'topblast.family'

export function appHostname(): string {
  return APP_HOSTNAME
}
