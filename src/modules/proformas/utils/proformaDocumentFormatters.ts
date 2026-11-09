import type { DatosTecnicos, ComponenteTecnico, AtributoTecnico } from '../services/muebleTecnico'
import { leerDatosTecnicos } from '../services/muebleTecnico'

export interface DimensionField {
  label: string
  value: string
}

export interface ComponentField {
  nombre: string
  detalle: string
}

export interface SpecSheetData {
  dimensiones: DimensionField[]
  materiales: string[]
  colores: string[]
  acabados: string[]
  componentes: ComponentField[]
  accesorios: string[]
  observaciones: string | null
  otrosAtributos: DimensionField[]
}

const DIMENSION_KEYS = new Set([
  'ancho',
  'alto',
  'profundidad',
  'largo',
  'diametro',
  'diámetro',
  'lado_1',
  'lado_2',
  'altura_total',
  'ancho_meson',
  'ancho_mesón',
  'espesor',
])

function capitalize(text: string): string {
  if (!text) return ''
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1)
}

function labelFor(key: string): string {
  const normalized = key.trim().toLocaleLowerCase('es').replace(/[_-]+/g, ' ')
  return capitalize(normalized)
}

/** Formatea número boliviano: comas decimales y puntos de mil, preservando ceros significativos en dimensiones */
export function formatBolivianNumber(val: number | string | null | undefined): string {
  if (val == null || val === '') return ''
  const strVal = String(val).trim()
  // Si ya tiene formato con coma o punto, detectamos los decimales originales
  const match = strVal.match(/^[+-]?\d+(?:[.,](\d+))?$/)
  const num = typeof val === 'number' ? val : Number(strVal.replace(',', '.'))
  if (!Number.isFinite(num)) return strVal

  const decimals = match && match[1] ? match[1].length : (num % 1 !== 0 ? 2 : 0)

  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, 2),
  }).format(num)
}

/**
 * Limpia frases truncadas o colgantes producidas por segmentaciones NLP
 * Ej: "2 tomacorrientes al centro de" -> "2 tomacorrientes al centro"
 */
export function cleanHangingPhrases(text: string): string {
  if (!text) return ''
  let cleaned = text.trim()
  // Limpiar conectores finales colgantes
  cleaned = cleaned.replace(/\s+(?:de|del|en|con|a|por|para|y|o)$/i, '').trim()
  // Limpiar puntuaciones extrañas al final
  cleaned = cleaned.replace(/[,;:\-_]+$/, '').trim()
  return cleaned
}

/** Formatea dimensiones respetando las convenciones bolivianas (coma decimal, ej: 0,80 m) */
export function formatRawDimension(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'string' || typeof raw === 'number') {
    const str = String(raw).trim()
    if (!str) return null
    // Si viene como número con unidad pegada (ej: "2.4m" o "2.4 m")
    const match = str.match(/^([\d.,]+)\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ°]+)?$/)
    if (match) {
      const numPart = match[1]
      const unitPart = match[2]
      const formattedNum = formatBolivianNumber(numPart)
      return unitPart ? `${formattedNum} ${unitPart}` : formattedNum
    }
    return str
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>
    const valor = record.valor != null ? String(record.valor).trim() : ''
    const unidad = record.unidad != null ? String(record.unidad).trim() : ''
    if (!valor) return null
    const formattedValor = formatBolivianNumber(valor)
    return unidad ? `${formattedValor} ${unidad}` : formattedValor
  }
  return null
}

/**
 * Filtra de la descripción u observaciones los datos que ya están estructurados
 * para evitar redundancia evidente, sin perder datos no cubiertos.
 */
function cleanRedundantObservation(
  obs: string,
  structuredParts: string[],
): string | null {
  const cleaned = cleanHangingPhrases(obs)
  if (!cleaned) return null

  // Si la observación es idéntica o prácticamente idéntica a un material, color o dimensión ya listada
  const lower = cleaned.toLowerCase()
  const isRedundant = structuredParts.some(
    (part) => part && part.toLowerCase().trim() === lower,
  )
  if (isRedundant) return null

  return cleaned
}

export function extractSpecSheetData(
  datosRaw: unknown,
  observacionesLine?: string | null,
): SpecSheetData {
  const dt: DatosTecnicos = leerDatosTecnicos(datosRaw)
  const dimensiones: DimensionField[] = []
  const materiales: string[] = []
  const colores: string[] = []
  const acabados: string[] = []
  const componentes: ComponentField[] = []
  const accesorios: string[] = []
  const otrosAtributos: DimensionField[] = []

  const generales = (dt.caracteristicas_generales ?? {}) as Record<string, unknown>

  // 1. Dimensiones generales
  const rawDims =
    generales.dimensiones &&
    typeof generales.dimensiones === 'object' &&
    !Array.isArray(generales.dimensiones)
      ? (generales.dimensiones as Record<string, unknown>)
      : {}

  for (const [key, val] of Object.entries(rawDims)) {
    const formatted = formatRawDimension(val)
    if (formatted) {
      dimensiones.push({ label: labelFor(key), value: formatted })
    }
  }

  // Atributos directos en generales que son dimensiones
  for (const [key, val] of Object.entries(generales)) {
    if (key === 'dimensiones' || key === 'atributos') continue
    const norm = key.trim().toLocaleLowerCase('es')
    if (DIMENSION_KEYS.has(norm)) {
      const formatted = formatRawDimension(val)
      if (
        formatted &&
        !dimensiones.some((d) => d.label.toLowerCase() === labelFor(key).toLowerCase())
      ) {
        dimensiones.push({ label: labelFor(key), value: formatted })
      }
    }
  }

  // 2. Atributos generales
  const rawAttrs = Array.isArray(generales.atributos)
    ? (generales.atributos as AtributoTecnico[])
    : []
  for (const attr of rawAttrs) {
    if (!attr || !attr.nombre || !attr.valor) continue
    const norm = attr.nombre.trim().toLocaleLowerCase('es')
    const valStr = attr.unidad ? `${formatBolivianNumber(String(attr.valor))} ${attr.unidad}` : String(attr.valor).trim()

    if (DIMENSION_KEYS.has(norm)) {
      if (!dimensiones.some((d) => d.label.toLowerCase() === attr.nombre.toLowerCase())) {
        dimensiones.push({ label: capitalize(attr.nombre), value: valStr })
      }
    } else if (norm.includes('material')) {
      materiales.push(valStr)
    } else if (norm.includes('color')) {
      colores.push(valStr)
    } else if (norm.includes('acabado')) {
      acabados.push(valStr)
    } else {
      otrosAtributos.push({ label: capitalize(attr.nombre), value: valStr })
    }
  }

  // 3. Componentes
  const comps = Array.isArray(dt.componentes) ? (dt.componentes as ComponenteTecnico[]) : []
  for (const c of comps) {
    if (!c.nombre) continue
    const parts: string[] = []
    if (c.cantidad_interna && c.cantidad_interna > 1) {
      parts.push(`${formatBolivianNumber(c.cantidad_interna)} pzas`)
    }
    if (c.material) parts.push(c.material.trim())
    if (c.espesor) {
      const espStr = formatRawDimension(c.espesor)
      parts.push(espStr?.toLowerCase().includes('espesor') ? espStr : `Espesor ${espStr}`)
    }
    if (c.color) parts.push(c.color.trim())
    if (c.dimensiones) parts.push(c.dimensiones.trim())
    if (c.acabado) parts.push(c.acabado.trim())

    componentes.push({
      nombre: capitalize(c.nombre.trim()),
      detalle: parts.join(' · '),
    })

    if (c.material && !materiales.includes(c.material.trim())) materiales.push(c.material.trim())
    if (c.color && !colores.includes(c.color.trim())) colores.push(c.color.trim())
    if (c.acabado && !acabados.includes(c.acabado.trim())) acabados.push(c.acabado.trim())
  }

  // 4. Accesorios (con sanitización de frases incompletas)
  if (Array.isArray(dt.accesorios)) {
    for (const acc of dt.accesorios) {
      if (typeof acc === 'string' && acc.trim()) {
        const cleaned = cleanHangingPhrases(acc)
        if (cleaned) accesorios.push(cleaned)
      }
    }
  }

  // 5. Observaciones depuradas (evita duplicar lo ya estructurado)
  const structuredParts = [
    ...materiales,
    ...colores,
    ...acabados,
    ...accesorios,
    ...dimensiones.map((d) => d.value),
  ]

  const obsLines: string[] = []
  if (observacionesLine && observacionesLine.trim()) {
    const cleaned = cleanRedundantObservation(observacionesLine, structuredParts)
    if (cleaned && !obsLines.includes(cleaned)) {
      obsLines.push(cleaned)
    }
  }

  if (Array.isArray(dt.advertencias)) {
    for (const adv of dt.advertencias) {
      if (typeof adv === 'string' && adv.trim()) {
        const cleaned = cleanHangingPhrases(adv)
        if (cleaned && !obsLines.includes(cleaned)) {
          obsLines.push(cleaned)
        }
      }
    }
  }

  // Nota: Si 'descripcion_original' es un texto largo que solo repite medidas y materiales,
  // no lo concatenamos ciegamente si ya tenemos componentes y dimensiones extraídas.
  // Solo se conserva si aporta información no representada.
  if (
    typeof dt.descripcion_original === 'string' &&
    dt.descripcion_original.trim() &&
    componentes.length === 0 &&
    dimensiones.length === 0
  ) {
    const cleanDesc = cleanHangingPhrases(dt.descripcion_original)
    if (cleanDesc && !obsLines.includes(cleanDesc)) {
      obsLines.push(cleanDesc)
    }
  }

  return {
    dimensiones,
    materiales: [...new Set(materiales.map((m) => cleanHangingPhrases(m)))],
    colores: [...new Set(colores.map((c) => cleanHangingPhrases(c)))],
    acabados: [...new Set(acabados.map((a) => cleanHangingPhrases(a)))],
    componentes,
    accesorios: [...new Set(accesorios)],
    observaciones: obsLines.length ? obsLines.join(' · ') : null,
    otrosAtributos,
  }
}

/** Formateo monetario boliviano estricto: Bs 7.300,00 */
export function formatDocCurrency(
  value: number | string | null | undefined,
  currencyCode = 'BOB',
): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num)) return String(value)

  const formattedNum = new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)

  if (currencyCode === 'BOB') {
    return `Bs ${formattedNum}`
  }
  if (currencyCode === 'USD') {
    return `$us ${formattedNum}`
  }
  return `${currencyCode} ${formattedNum}`
}

/** Formatea cantidades enteras y fraccionarias con unidades bolivianas */
export function formatDocQuantity(
  val: string | number | null | undefined,
  unidadLabel = 'pieza',
): string {
  if (val == null || val === '') return `1 ${unidadLabel}`
  const num = Number(val)
  if (!Number.isFinite(num)) return `${val} ${unidadLabel}`

  const isInteger = num === Math.trunc(num)
  const numStr = isInteger
    ? new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(num)
    : new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(num)

  const pluralUnidad = (n: number, unit: string) => {
    if (n === 1) return unit
    if (unit.toLowerCase() === 'pieza') return 'piezas'
    if (unit.toLowerCase() === 'unidad') return 'unidades'
    if (unit.toLowerCase() === 'global') return 'global'
    if (unit.toLowerCase() === 'metro' || unit.toLowerCase() === 'm') return 'metros'
    if (unit.toLowerCase() === 'juego') return 'juegos'
    return unit
  }

  return `${numStr} ${pluralUnidad(num, unidadLabel)}`
}

export function formatDocDate(fecha: string | null | undefined): string {
  if (!fecha)
    return new Intl.DateTimeFormat('es-BO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())
  const clean = fecha.split('T')[0] || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return fecha
  return new Intl.DateTimeFormat('es-BO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${clean}T12:00:00Z`))
}
