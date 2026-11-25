export type PeriodPresetKey =
  'todo' | 'este_mes' | 'mes_anterior' | 'ultimos_30_dias' | 'ultimos_7_dias' | 'personalizado'

export interface PeriodRange {
  fecha_desde: string | null
  fecha_hasta: string | null
}

const currencyFormatters = new Map<string, Intl.NumberFormat>()

function getNumberFormatter(decimals: number): Intl.NumberFormat {
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function formatMoney(
  value: string | number | null | undefined,
  currency: string = 'BOB',
): string {
  const num = toNumber(value)
  if (num === null) return 'No disponible'
  const key = currency.toUpperCase()
  let fmt = currencyFormatters.get(key)
  if (!fmt) {
    fmt = getNumberFormatter(2)
    currencyFormatters.set(key, fmt)
  }
  const prefix = key === 'USD' ? '$us' : key === 'BOB' ? 'Bs' : key
  return `${prefix} ${fmt.format(num)}`
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No disponible'
  return getNumberFormatter(0).format(value)
}

export function formatQuantity(value: string | number | null | undefined): string {
  const num = toNumber(value)
  if (num === null) return 'No disponible'
  const hasFraction = Math.abs(num % 1) > 0.0001
  return getNumberFormatter(hasFraction ? 2 : 0).format(num)
}

export function formatPercent(value: string | number | null | undefined): string {
  const num = toNumber(value)
  if (num === null) return 'No aplicable'
  return `${getNumberFormatter(2).format(num)} %`
}

export function formatDateLaPaz(iso: string | null | undefined): string {
  if (!iso) return 'Sin fecha'
  const pureDate = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  const date = pureDate ? new Date(`${iso}T12:00:00-04:00`) : new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatTimeLaPaz(date: Date): string {
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days))
  return dt.toISOString().slice(0, 10)
}

export function buildPeriodPreset(preset: PeriodPresetKey, referenceIso: string): PeriodRange {
  if (preset === 'todo' || !/^\d{4}-\d{2}-\d{2}$/.test(referenceIso)) {
    return { fecha_desde: null, fecha_hasta: null }
  }
  const [y, m] = referenceIso.split('-').map(Number)
  if (preset === 'este_mes') {
    const start = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
    return { fecha_desde: start, fecha_hasta: referenceIso }
  }
  if (preset === 'mes_anterior') {
    const prevMonthEnd = new Date(Date.UTC(y!, m! - 1, 0))
    const prevYear = prevMonthEnd.getUTCFullYear()
    const prevMonth = prevMonthEnd.getUTCMonth() + 1
    const start = `${String(prevYear).padStart(4, '0')}-${String(prevMonth).padStart(2, '0')}-01`
    return { fecha_desde: start, fecha_hasta: prevMonthEnd.toISOString().slice(0, 10) }
  }
  if (preset === 'ultimos_30_dias') {
    return { fecha_desde: addDays(referenceIso, -29), fecha_hasta: referenceIso }
  }
  if (preset === 'ultimos_7_dias') {
    return { fecha_desde: addDays(referenceIso, -6), fecha_hasta: referenceIso }
  }
  return { fecha_desde: null, fecha_hasta: null }
}
