import type { PropuestaConfigurador } from '@/generated/api'

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The legacy confirmation DTO only accepts V1 axes with string values. */
export function hasUnsupportedLegacyDimensions(value: unknown): boolean {
  if (value == null) return false
  const axes = new Set(['ancho', 'alto', 'profundidad', 'largo', 'diametro'])
  return (
    !record(value) ||
    Object.entries(value).some(
      ([axis, dimension]) => !axes.has(axis) || typeof dimension !== 'string',
    )
  )
}

/** Keep scoped technical data; duplicate legacy fields must have identical representations. */
export function reviewProjection(projection: PropuestaConfigurador) {
  const technical: unknown = JSON.parse(JSON.stringify(projection.especificacion.datos_tecnicos))
  if (!record(technical))
    throw new Error('La propuesta estructurada no contiene datos técnicos válidos.')
  const general = record(technical.caracteristicas_generales)
    ? technical.caracteristicas_generales
    : {}
  const dimensions: Record<string, unknown> = {}
  if (record(general.dimensiones)) {
    for (const [axis, value] of Object.entries(general.dimensiones)) {
      if (typeof value === 'string') dimensions[axis] = value
      else if (
        record(value) &&
        (typeof value.valor === 'string' ||
          (typeof value.valor === 'number' && Number.isFinite(value.valor))) &&
        typeof value.unidad === 'string' &&
        value.unidad.trim() !== '' &&
        Object.keys(value).every((key) => key === 'valor' || key === 'unidad')
      ) {
        dimensions[axis] = `${value.valor} ${value.unidad}`
      } else {
        // Preserve metadata and unresolved shapes identically in both HITL representations.
        dimensions[axis] = value
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
