'use client'

import { useCallback, useEffect, useState } from 'react'

export type ThemeName = 'light' | 'dark'

const STORAGE_KEY = 'tb-theme'
export const THEME_EVENT = 'tb-themechange'

export function readTheme(): ThemeName {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function applyTheme(theme: ThemeName) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* private mode — theme just won't persist */
  }
  window.dispatchEvent(new CustomEvent<ThemeName>(THEME_EVENT, { detail: theme }))
}

/** Current theme + toggle. The initial class is set pre-paint by the layout script. */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>('dark')

  useEffect(() => {
    setTheme(readTheme())
    const onChange = (e: Event) => {
      setTheme((e as CustomEvent<ThemeName>).detail ?? readTheme())
    }
    window.addEventListener(THEME_EVENT, onChange)
    return () => window.removeEventListener(THEME_EVENT, onChange)
  }, [])

  const toggle = useCallback(() => {
    const next: ThemeName = readTheme() === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }, [])

  return { theme, toggle }
}
