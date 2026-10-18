export type FieldErrors = Record<string, string[]>
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: 'http' | 'network' | 'timeout' | 'invalid_response',
    readonly fields: FieldErrors = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
export function normalizeApiError(status: number, body: unknown): ApiError {
  if (!body || typeof body !== 'object')
    return new ApiError('La solicitud no pudo completarse.', status, 'http')
  const data = body as Record<string, unknown>
  const detail = typeof data.detail === 'string' ? data.detail : undefined
  const fields: FieldErrors = {}
  function registrar(ruta: string, valor: unknown) {
    if (typeof valor === 'string') {
      fields[ruta] = [...(fields[ruta] ?? []), valor]
    } else if (Array.isArray(valor)) {
      if (valor.every((item) => typeof item === 'string')) {
        fields[ruta] = [...(fields[ruta] ?? []), ...valor]
      } else {
        valor.forEach((item, index) => registrar(`${ruta}[${index}]`, item))
      }
    } else if (valor !== null && typeof valor === 'object') {
      for (const [clave, contenido] of Object.entries(valor)) {
        registrar(ruta ? `${ruta}.${clave}` : clave, contenido)
      }
    }
  }
  for (const [field, value] of Object.entries(data)) {
    if (field !== 'detail') registrar(field, value)
  }
  return new ApiError(
    detail ?? Object.values(fields)[0]?.[0] ?? 'Revisa los datos enviados.',
    status,
    'http',
    fields,
  )
}
