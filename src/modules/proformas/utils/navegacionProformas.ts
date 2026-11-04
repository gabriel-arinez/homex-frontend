/** Sólo se permite retornar a la bandeja y sus filtros, nunca a un destino externo. */
export function retornoAProformas(value: unknown): string {
  if (typeof value !== 'string') return '/proformas'
  if (value === '/proformas' || value.startsWith('/proformas?')) return value
  return '/proformas'
}
