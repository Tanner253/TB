import { getTenantSlug } from './context'

/** Mongo filter scoped to the active tenant (includes legacy rows without tenantSlug). */
export function tenantFilter<T extends Record<string, unknown>>(extra: T = {} as T) {
  const slug = getTenantSlug()
  if (slug === '_legacy') {
    return {
      ...extra,
      $or: [{ tenantSlug: '_legacy' }, { tenantSlug: { $exists: false } }],
    }
  }
  return { ...extra, tenantSlug: slug }
}

export function tenantFields() {
  return { tenantSlug: getTenantSlug() }
}
