import { getTenantSlug } from './context'

export function getTimerKey(): string {
  const slug = getTenantSlug()
  if (slug === '_legacy') return 'payout_timer'
  return `${slug}:payout_timer`
}

export function getRankingsKey(): string {
  const slug = getTenantSlug()
  if (slug === '_legacy') return 'current_rankings'
  return `${slug}:current_rankings`
}
