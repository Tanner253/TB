/** Platform token catalog configuration (env-driven, server-safe) */

export function getPlatformTenantSlug(): string {
  return (process.env.PLATFORM_TENANT_SLUG || 'topblast').trim().toLowerCase()
}

export function getPlatformTokenMint(): string {
  return (process.env.PLATFORM_TOKEN_MINT || process.env.TOKEN_MINT_ADDRESS || '').trim()
}

export function getPlatformTokenSymbol(): string {
  return (process.env.PLATFORM_TOKEN_SYMBOL || process.env.TOKEN_SYMBOL || 'TopBlast').trim()
}

export function isPlatformTenantSlug(slug: string): boolean {
  return slug.trim().toLowerCase() === getPlatformTenantSlug()
}
