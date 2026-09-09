'use client'

/** Cross-component celebration bus — any page can fire the whale-rocket overlay. */

export const CELEBRATE_EVENT = 'tb-celebrate'

export interface CelebrationDetail {
  label?: string
  sublabel?: string
}

export function triggerCelebration(detail: CelebrationDetail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<CelebrationDetail>(CELEBRATE_EVENT, { detail }))
}
