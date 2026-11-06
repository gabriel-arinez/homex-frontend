export function localToday(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function dateRangeError(from: string, to: string, latest?: string): string {
  if ((from && !isValidDate(from)) || (to && !isValidDate(to))) return 'Ingresa una fecha válida.'
  if (from && to && from > to) return 'La fecha inicial no puede ser posterior a la fecha final.'
  if (latest && (from > latest || to > latest)) return 'La fecha no puede ser futura.'
  return ''
}
