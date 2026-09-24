import type { IdentidadActual } from '@/generated/api'

export const CAPABILITIES = ['comercial.operar', 'comercial.administrar'] as const
export type Capability = (typeof CAPABILITIES)[number]
export type SessionIdentity = Pick<IdentidadActual, 'id' | 'username' | 'display_name'>

export function isCapability(value: string): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value)
}
