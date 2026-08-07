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
          'purple-dark': '#7A2FD4',
          'purple-deep': '#5B21B6',
          mint: '#14F195',
          'mint-bright': '#19FB9B',
          black: '#0a0a0a',
        },
        rh: {
          green: '#9945FF',
          'green-dark': '#7A2FD4',
          'green-bright': '#14F195',
          lime: '#14F195',
          black: '#0a0a0a',
        },
      },
      boxShadow: {
        'rh-glow': '0 0 20px rgba(153, 69, 255, 0.35), 0 0 60px rgba(20, 241, 149, 0.12)',
        'sol-glow': '0 0 20px rgba(153, 69, 255, 0.35), 0 0 60px rgba(20, 241, 149, 0.12)',
      },
      backgroundImage: {
        'sol-gradient': 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)',
      },
    },
  },
  plugins: [],
}
