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
        rh: {
          green: '#00C805',
          'green-dark': '#009B04',
          'green-bright': '#00E806',
          lime: '#CCFF00',
          black: '#0a0a0a',
        },
      },
      boxShadow: {
        'rh-glow': '0 0 20px rgba(0, 200, 5, 0.35), 0 0 60px rgba(0, 200, 5, 0.12)',
      },
    },
  },
  plugins: [],
}
