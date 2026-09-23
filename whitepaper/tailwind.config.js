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
          purple: '#9945FF',
          'purple-dark': '#7a2fd4',
          'purple-deep': '#5b21b6',
          // The violet carries white text.
          'on-accent': '#ffffff',
          mint: '#30d158',
          'mint-bright': '#4ade70',
          black: '#140e1e',
        },
        // Tailwind's gray-500/600 fail AA on a near-black page; these are the
        // lifted equivalents used everywhere muted text appears.
        gray: { 500: '#949ba6', 600: '#8b929c' },
        rh: {
          green: '#9945FF',
          'green-dark': '#7a2fd4',
          'green-bright': '#30d158',
          lime: '#30d158',
          black: '#140e1e',
        },
      },
      boxShadow: {
        // A soft violet bloom under the primary surfaces.
        'rh-glow': '0 8px 24px rgba(153, 69, 255, 0.28), 0 0 60px rgba(153, 69, 255, 0.10)',
        'rh-glow-sm': '0 4px 14px rgba(153, 69, 255, 0.28)',
        'sol-glow': '0 8px 24px rgba(153, 69, 255, 0.28), 0 0 60px rgba(153, 69, 255, 0.10)',
      },
      backgroundImage: {
        // Both stops clear AA against white — these carry white text.
        'sol-gradient': 'linear-gradient(135deg, #9945FF 0%, #6d28d9 100%)',
      },
    },
  },
  plugins: [],
}
