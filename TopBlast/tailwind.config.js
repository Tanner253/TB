/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Semantic theme tokens (light default / .dark overrides in globals.css)
        paper: 'rgb(var(--tb-paper) / <alpha-value>)',
        card: 'rgb(var(--tb-card) / <alpha-value>)',
        'card-2': 'rgb(var(--tb-card-2) / <alpha-value>)',
        ink: 'rgb(var(--tb-ink) / <alpha-value>)',
        'ink-2': 'rgb(var(--tb-ink-2) / <alpha-value>)',
        'ink-3': 'rgb(var(--tb-ink-3) / <alpha-value>)',
        line: 'rgb(var(--tb-line) / <alpha-value>)',
        gold: 'rgb(var(--tb-gold) / <alpha-value>)',
        // Solana brand palette — now theme-aware via CSS vars
        sol: {
          purple: 'rgb(var(--tb-purple) / <alpha-value>)',
          'purple-dark': 'rgb(var(--tb-purple-dark) / <alpha-value>)',
          'purple-deep': '#5B21B6',
          mint: 'rgb(var(--tb-mint) / <alpha-value>)',
          'mint-bright': 'rgb(var(--tb-mint-bright) / <alpha-value>)',
          black: 'rgb(var(--tb-card) / <alpha-value>)',
        },
        // Legacy rh-* tokens → Solana (keeps existing class names working)
        rh: {
          green: 'rgb(var(--tb-purple) / <alpha-value>)',
          'green-dark': 'rgb(var(--tb-purple-dark) / <alpha-value>)',
          'green-bright': 'rgb(var(--tb-mint) / <alpha-value>)',
          lime: 'rgb(var(--tb-mint) / <alpha-value>)',
          black: 'rgb(var(--tb-card) / <alpha-value>)',
        },
      },
      boxShadow: {
        'rh-glow': '0 0 20px rgb(var(--tb-purple) / 0.35), 0 0 60px rgb(var(--tb-mint) / 0.12)',
        'rh-glow-sm': '0 0 12px rgb(var(--tb-purple) / 0.3)',
        'sol-glow': '0 0 20px rgb(var(--tb-purple) / 0.35), 0 0 60px rgb(var(--tb-mint) / 0.12)',
        card: '0 1px 2px rgb(var(--tb-ink) / 0.04), 0 8px 24px rgb(var(--tb-ink) / 0.05)',
      },
      backgroundImage: {
        'sol-gradient': 'linear-gradient(135deg, rgb(var(--tb-purple)) 0%, rgb(var(--tb-mint)) 100%)',
      },
    },
  },
  plugins: [],
}
