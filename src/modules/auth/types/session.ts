import type { IdentidadActual } from '@/generated/api'

export const CAPABILITIES = [
  'comercial.operar',
  'comercial.administrar',
  'taller.operar',
  'catalogo.crear_producto',
] as const
export type Capability = (typeof CAPABILITIES)[number]
export type RoleProfile = 'ADMIN' | 'ENCARGADO_TIENDA' | 'JEFE_TALLER' | 'SIN_ROL'
export type SessionIdentity = Pick<IdentidadActual, 'id' | 'username' | 'display_name'>

export function isCapability(value: string): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value)
}

export function resolveRoleProfile(capabilities: readonly Capability[]): RoleProfile {
  if (capabilities.includes('comercial.administrar')) return 'ADMIN'
  if (capabilities.includes('comercial.operar') || capabilities.includes('catalogo.crear_producto'))
    return 'ENCARGADO_TIENDA'
  if (capabilities.includes('taller.operar')) return 'JEFE_TALLER'
  return 'SIN_ROL'
}

export function resolveRoleLabel(role: RoleProfile): string {
  if (role === 'ADMIN') return 'Administrador'
  if (role === 'ENCARGADO_TIENDA') return 'Encargado de tienda'
  if (role === 'JEFE_TALLER') return 'Jefe de taller'
  return 'Sin rol asignado'
}

export function resolveDefaultRouteName(
  capabilities: readonly Capability[],
): 'resumen' | 'productos' | 'forbidden' {
  if (capabilities.includes('comercial.operar') || capabilities.includes('taller.operar'))
    return 'resumen'
  if (capabilities.includes('catalogo.crear_producto')) return 'productos'
  return 'forbidden'
}
