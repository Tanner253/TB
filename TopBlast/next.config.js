/** @type {import('next').NextConfig} */

/**
 * The app moved from topblasted.fun to topblast.family. The old domain is
 * still owned and still in bios, tweets and bookmarks, so it permanently
 * redirects here — path and query preserved, so an old /slug/leaderboard
 * link lands on the same page. Keyed on the request host, so it can never
 * fire for the new domain.
 */
const LEGACY_HOSTS = ['topblasted.fun', 'www.topblasted.fun']
const CANONICAL_ORIGIN = 'https://www.topblast.family'

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return LEGACY_HOSTS.map(host => ({
      source: '/:path*',
      has: [{ type: 'host', value: host }],
      destination: `${CANONICAL_ORIGIN}/:path*`,
      permanent: true,
    }))
  },
}

module.exports = nextConfig
