/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        sol: {
          purple: '#d4fc50',
          'purple-dark': '#b5e63d',
          'purple-deep': '#8fbb27',
          // Pons puts dark text on the lime, never white.
          'on-accent': '#111111',
          mint: '#30d158',
          'mint-bright': '#4ade70',
          black: '#161616',
        },
        // Tailwind's gray-500/600 fail AA on a near-black page; these are the
        // lifted equivalents used everywhere muted text appears.
        gray: { 500: '#949ba6', 600: '#8b929c' },
        rh: {
          green: '#d4fc50',
          'green-dark': '#b5e63d',
          'green-bright': '#30d158',
          lime: '#30d158',
          black: '#161616',
        },
      },
      boxShadow: {
        // Pons puts a soft lime bloom under its primary surfaces.
        'rh-glow': '0 8px 24px rgba(212, 252, 80, 0.28), 0 0 60px rgba(212, 252, 80, 0.10)',
        'rh-glow-sm': '0 4px 14px rgba(212, 252, 80, 0.28)',
        'sol-glow': '0 8px 24px rgba(212, 252, 80, 0.28), 0 0 60px rgba(212, 252, 80, 0.10)',
      },
      backgroundImage: {
        'sol-gradient': 'linear-gradient(135deg, #d4fc50 0%, #30d158 100%)',
      },
    },
  },
  plugins: [],
}
