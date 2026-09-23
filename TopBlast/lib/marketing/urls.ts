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

/**
 * Chain identity, client-safe.
 *
 * Duplicated from lib/pons/contracts.ts on purpose: that module is
 * `server-only`, and the number has to reach the UI that tells someone where
 * to send money. Keep the two in step — a wrong id here sends funds to a
 * network nobody is watching.
 */
export const CHAIN_ID = 4663
export const CHAIN_ID_TESTNET = 46630
export const CHAIN_LABEL = `${CHAIN_NAME} · Chain ID ${CHAIN_ID}`
/** The sentence that has to appear anywhere we ask for a deposit. */
export const CHAIN_DEPOSIT_WARNING =
  `Only send on ${CHAIN_NAME} (chain ID ${CHAIN_ID}). ` +
  'ETH sent on Ethereum mainnet, Base, Arbitrum or any other network will be lost and cannot be recovered.'
