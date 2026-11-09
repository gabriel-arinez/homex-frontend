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
])

function capitalize(text: string): string {
  if (!text) return ''
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1)
}

function labelFor(key: string): string {
  const normalized = key.trim().toLocaleLowerCase('es').replace(/[_-]+/g, ' ')
  return capitalize(normalized)
}

function formatRawDimension(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'string' || typeof raw === 'number') {
    const str = String(raw).trim()
    return str ? str : null
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>
    const valor = record.valor != null ? String(record.valor).trim() : ''
    const unidad = record.unidad != null ? String(record.unidad).trim() : ''
    if (!valor) return null
    return unidad ? `${valor} ${unidad}` : valor
  }
  return null
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
    generales.dimensiones && typeof generales.dimensiones === 'object' && !Array.isArray(generales.dimensiones)
      ? (generales.dimensiones as Record<string, unknown>)
      : {}

  for (const [key, val] of Object.entries(rawDims)) {
    const formatted = formatRawDimension(val)
    if (formatted) {
      dimensiones.push({ label: labelFor(key), value: formatted })
    }
  }

  // Si no había objeto dimensiones pero hay atributos con nombres de dimensión en generales
  for (const [key, val] of Object.entries(generales)) {
    if (key === 'dimensiones' || key === 'atributos') continue
    const norm = key.trim().toLocaleLowerCase('es')
    if (DIMENSION_KEYS.has(norm)) {
      const formatted = formatRawDimension(val)
      if (formatted && !dimensiones.some((d) => d.label.toLowerCase() === labelFor(key).toLowerCase())) {
        dimensiones.push({ label: labelFor(key), value: formatted })
      }
    }
  }

  // 2. Atributos generales
  const rawAttrs = Array.isArray(generales.atributos) ? (generales.atributos as AtributoTecnico[]) : []
  for (const attr of rawAttrs) {
    if (!attr || !attr.nombre || !attr.valor) continue
    const norm = attr.nombre.trim().toLocaleLowerCase('es')
    const val = attr.unidad ? `${attr.valor} ${attr.unidad}` : String(attr.valor)

    if (DIMENSION_KEYS.has(norm)) {
      if (!dimensiones.some((d) => d.label.toLowerCase() === attr.nombre.toLowerCase())) {
        dimensiones.push({ label: capitalize(attr.nombre), value: val })
      }
    } else if (norm.includes('material')) {
      materiales.push(val)
    } else if (norm.includes('color')) {
      colores.push(val)
    } else if (norm.includes('acabado')) {
      acabados.push(val)
    } else {
      otrosAtributos.push({ label: capitalize(attr.nombre), value: val })
    }
  }

  // 3. Componentes
  const comps = Array.isArray(dt.componentes) ? (dt.componentes as ComponenteTecnico[]) : []
  for (const c of comps) {
    if (!c.nombre) continue
    const parts: string[] = []
    if (c.cantidad_interna && c.cantidad_interna > 1) {
      parts.push(`${c.cantidad_interna} pzas`)
    }
    if (c.material) parts.push(c.material)
    if (c.espesor) parts.push(`Espesor ${c.espesor}`)
    if (c.color) parts.push(c.color)
    if (c.dimensiones) parts.push(c.dimensiones)
    if (c.acabado) parts.push(c.acabado)

    componentes.push({
      nombre: c.nombre,
      detalle: parts.join(' · '),
    })

    if (c.material && !materiales.includes(c.material)) materiales.push(c.material)
    if (c.color && !colores.includes(c.color)) colores.push(c.color)
    if (c.acabado && !acabados.includes(c.acabado)) acabados.push(c.acabado)
  }

  // 4. Accesorios
  if (Array.isArray(dt.accesorios)) {
    for (const acc of dt.accesorios) {
      if (typeof acc === 'string' && acc.trim()) {
        accesorios.push(acc.trim())
      }
    }
  }

  // 5. Observaciones
  const obsLines: string[] = []
  if (observacionesLine && observacionesLine.trim()) {
    obsLines.push(observacionesLine.trim())
  }
  if (typeof dt.descripcion_original === 'string' && dt.descripcion_original.trim()) {
    if (!obsLines.includes(dt.descripcion_original.trim())) {
      obsLines.push(dt.descripcion_original.trim())
    }
  }
  if (Array.isArray(dt.advertencias)) {
    for (const adv of dt.advertencias) {
      if (typeof adv === 'string' && adv.trim() && !obsLines.includes(adv.trim())) {
        obsLines.push(adv.trim())
      }
    }
  }

  return {
    dimensiones,
    materiales: [...new Set(materiales)],
    colores: [...new Set(colores)],
    acabados: [...new Set(acabados)],
    componentes,
    accesorios: [...new Set(accesorios)],
    observaciones: obsLines.length ? obsLines.join(' · ') : null,
    otrosAtributos,
  }
}

export function formatDocCurrency(value: number | string | null | undefined, currencyCode = 'BOB'): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num)) return String(value)
  try {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    return `${currencyCode} ${num.toFixed(2)}`
  }
}

export function formatDocDate(fecha: string | null | undefined): string {
  if (!fecha) return new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const clean = fecha.split('T')[0] || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return fecha
  return new Intl.DateTimeFormat('es-BO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${clean}T12:00:00Z`))
}
