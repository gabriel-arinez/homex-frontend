import type { PropuestaConfigurador } from '@/generated/api'

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Keep scoped technical data; duplicate legacy fields must have identical representations. */
export function reviewProjection(projection: PropuestaConfigurador) {
  const technical: unknown = JSON.parse(JSON.stringify(projection.especificacion.datos_tecnicos))
  if (!record(technical))
    throw new Error('La propuesta estructurada no contiene datos técnicos válidos.')
  const general = record(technical.caracteristicas_generales)
    ? technical.caracteristicas_generales
    : {}
  const dimensions: Record<string, string> = {}
  if (record(general.dimensiones)) {
    for (const [axis, value] of Object.entries(general.dimensiones)) {
      if (typeof value === 'string') dimensions[axis] = value
      else if (
        record(value) &&
        typeof value.valor === 'string' &&
        typeof value.unidad === 'string'
      ) {
        dimensions[axis] = `${value.valor} ${value.unidad}`
      }
    }
    // Only main-product dimensions enter the legacy correction; component data stays untouched.
    general.dimensiones = dimensions
  }
  return {
    technical,
    dimensions: Object.keys(dimensions).length ? dimensions : null,
    thickness: general.espesor ?? null,
    primaryColor: typeof general.color_principal === 'string' ? general.color_principal : '',
    secondaryColor: typeof general.color_secundario === 'string' ? general.color_secundario : '',
    accessories:
      Array.isArray(technical.accesorios) &&
      technical.accesorios.every((x) => typeof x === 'string')
        ? technical.accesorios
        : null,
  }
}
