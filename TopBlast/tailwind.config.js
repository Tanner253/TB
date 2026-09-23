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
        'tb-amber': 'rgb(var(--tb-amber) / <alpha-value>)',
        // Brand accent. Named `sol.*` for historical reasons — the values are
        // Heritage Violet, theme-aware via CSS vars. Anything placed ON an
        // accent fill uses `text-on-accent`, which resolves to white.
        accent: {
          DEFAULT: 'rgb(var(--tb-accent-fill) / <alpha-value>)',
          hover: 'rgb(var(--tb-accent-hover) / <alpha-value>)',
        },
        'on-accent': 'rgb(var(--tb-on-accent) / <alpha-value>)',
        sol: {
          purple: 'rgb(var(--tb-purple) / <alpha-value>)',
          'purple-dark': 'rgb(var(--tb-purple-dark) / <alpha-value>)',
          'purple-deep': 'rgb(var(--tb-purple-deep) / <alpha-value>)',
          mint: 'rgb(var(--tb-mint) / <alpha-value>)',
          'mint-bright': 'rgb(var(--tb-mint-bright) / <alpha-value>)',
          black: 'rgb(var(--tb-card) / <alpha-value>)',
        },
        // Legacy rh-* tokens → brand accent (keeps existing class names working)
        rh: {
          green: 'rgb(var(--tb-purple) / <alpha-value>)',
          'green-dark': 'rgb(var(--tb-purple-dark) / <alpha-value>)',
          'green-bright': 'rgb(var(--tb-mint) / <alpha-value>)',
          lime: 'rgb(var(--tb-mint) / <alpha-value>)',
          black: 'rgb(var(--tb-card) / <alpha-value>)',
        },
      },
      boxShadow: {
        // A soft violet bloom under the primary buttons.
        'rh-glow': '0 8px 24px rgb(var(--tb-accent-fill) / 0.28), 0 0 60px rgb(var(--tb-accent-fill) / 0.10)',
        'rh-glow-sm': '0 4px 14px rgb(var(--tb-accent-fill) / 0.28)',
        'sol-glow': '0 8px 24px rgb(var(--tb-accent-fill) / 0.28), 0 0 60px rgb(var(--tb-accent-fill) / 0.10)',
        card: '0 1px 2px rgb(var(--tb-ink) / 0.04), 0 8px 24px rgb(var(--tb-ink) / 0.05)',
      },
      backgroundImage: {
        // Both stops clear AA against white — these carry `text-on-accent`.
        'sol-gradient': 'linear-gradient(135deg, rgb(var(--tb-accent-fill)) 0%, rgb(var(--tb-accent-fill-2)) 100%)',
        'accent-gradient': 'linear-gradient(135deg, rgb(var(--tb-accent-fill)) 0%, rgb(var(--tb-accent-fill-2)) 100%)',
      },
    },
  },
  plugins: [],
}
