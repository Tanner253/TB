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

/** Pons — the launchpad every listed token deploys on. */
export const PONS_URL = 'https://ponsfamily.com'

/** Pons protocol docs (curve, fees, graduation). */
export const PONS_DOCS_URL = 'https://docs.ponsfamily.com'

/** Chain the whole platform runs on. */
export const CHAIN_NAME = 'Robinhood Chain'
