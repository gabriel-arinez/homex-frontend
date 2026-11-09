/** Reglas de entrada compartidas por clientes y proformas.
 * La validación del servidor sigue siendo autoritativa.
 */
export const CLIENT_LIMITS = {
  nombres: 25,
  apellidos: 50,
  empresa: 100,
  celular: 8,
  direccion: 100,
  observaciones: 250,
  search: 60,
} as const

export const QUOTE_LIMITS = {
  titulo: 180,
  plazo_entrega: 45,
  observaciones: 250,
  validez_oferta: 100,
} as const

export type InputRule = 'name' | 'digits' | 'decimal' | 'search' | 'delivery'

export function cleanInput(value: string, rule?: InputRule, maxLength?: number): string {
  let text = value
  if (rule === 'name') text = text.replace(/[^\p{L}\p{M} '\u2019-]/gu, '')
  if (rule === 'digits') text = text.replace(/\D/g, '')
  if (rule === 'delivery') text = text.replace(/[^\p{L}\p{M}0-9 '\u2019]/gu, '')
  if (rule === 'decimal') {
    text = text.replace(/[^\d.,]/g, '').replace(',', '.')
    const dot = text.indexOf('.')
    if (dot >= 0) text = text.slice(0, dot + 1) + text.slice(dot + 1).replace(/\./g, '')
  }
  if (rule === 'search') text = text.replace(/[\p{Cc}]/gu, '')
  return maxLength === undefined ? text : Array.from(text).slice(0, maxLength).join('')
}

const namePattern = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u
type ClientFields = 'nombres' | 'apellidos' | 'empresa' | 'celular' | 'direccion' | 'observaciones'
export type ClientData = Record<ClientFields, string>

export function validateClientField(
  field: ClientFields,
  value: string,
  company: boolean,
  previous?: string | null,
): string {
  if (previous != null && previous === value) return ''
  const text = value.trim()
  const limit = CLIENT_LIMITS[field]
  if (Array.from(value).length > limit) return 'Máximo ' + limit + ' caracteres.'
  if (field === 'nombres' || field === 'apellidos') {
    if (!text) return field === 'nombres' ? 'Ingresa los nombres.' : 'Ingresa los apellidos.'
    if (!namePattern.test(text)) return 'Utiliza letras, tildes, espacios, apóstrofes o guiones.'
  }
  if (field === 'empresa' && company && !text) return 'Ingresa la razón social o empresa.'
  if (field === 'celular' && text && !/^\d{8}$/.test(text)) {
    return 'El celular debe tener exactamente 8 dígitos.'
  }
  return ''
}

export function validateClient(
  data: ClientData,
  company: boolean,
  previous?: Partial<Record<ClientFields, string | null | undefined>>,
): Record<string, string> {
  return Object.fromEntries(
    (Object.keys(CLIENT_LIMITS) as Array<keyof typeof CLIENT_LIMITS>)
      .filter((field): field is ClientFields => field !== 'search')
      .filter((field) => company || field !== 'empresa')
      .map((field) => [field, validateClientField(field, data[field], company, previous?.[field])])
      .filter(([, error]) => Boolean(error)),
  )
}

export type QuoteConditions = {
  titulo: string
  porcentaje_adelanto: string
  validez_oferta: string
  plazo_entrega: string
  observaciones: string
}

export function validateQuoteConditions(
  data: QuoteConditions,
  options?: { forEmission?: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {}
  const forEmission = Boolean(options?.forEmission)

  if (Array.from(data.titulo).length > QUOTE_LIMITS.titulo) {
    errors.titulo = `Máximo ${QUOTE_LIMITS.titulo} caracteres.`
  }

  const delivery = data.plazo_entrega.trim()
  if (Array.from(data.plazo_entrega).length > QUOTE_LIMITS.plazo_entrega) {
    errors.plazo_entrega = `Máximo ${QUOTE_LIMITS.plazo_entrega} caracteres.`
  } else if (!delivery) {
    if (forEmission) errors.plazo_entrega = 'Ingresa el plazo de entrega.'
  } else if (!/^[\p{L}\p{M}0-9 '\u2019]+$/u.test(delivery)) {
    errors.plazo_entrega = 'Usa solo letras, números y espacios (máximo 45 caracteres).'
  }

  const advance = data.porcentaje_adelanto.trim()
  const numAdvance = Number(advance)
  if (!advance) {
    if (forEmission) errors.porcentaje_adelanto = 'Ingresa el porcentaje de adelanto (0 a 100 %).'
  } else if (
    !/^\d{1,3}(?:\.0+)?$/.test(advance) ||
    isNaN(numAdvance) ||
    numAdvance < 0 ||
    numAdvance > 100
  ) {
    errors.porcentaje_adelanto = 'El adelanto debe ser un número entero entre 0 y 100.'
  }

  const validity = data.validez_oferta.trim()
  if (!validity) {
    if (forEmission) errors.validez_oferta = 'Ingresa los días de validez de la oferta (1 a 100).'
  } else if (!/^\d{1,3}$/.test(validity) || Number(validity) < 1 || Number(validity) > 100) {
    errors.validez_oferta = 'Ingresa un plazo de validez entre 1 y 100 días.'
  }

  if (Array.from(data.observaciones).length > QUOTE_LIMITS.observaciones) {
    errors.observaciones = `Máximo ${QUOTE_LIMITS.observaciones} caracteres.`
  }

  return errors
}
