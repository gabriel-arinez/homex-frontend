import { apiRequest } from '@/shared/api'
import { dateRangeError, localToday } from '@/shared/validation/dateRange'
import { downloadBlob } from './downloadBlob'
import { buildExportFilename } from './exportFilename'

export function exportRangeError(from: string, to: string, latest = localToday()): string {
  if (!from.trim()) return 'Selecciona la fecha inicial para exportar.'
  if (!to.trim()) return 'Selecciona la fecha final para exportar.'
  return dateRangeError(from.trim(), to.trim(), latest)
}

export function buildTrayExportFilename(
  prefix: string,
  filterSegments: Array<string | number | null | undefined>,
  from: string,
  to: string,
): string {
  return buildExportFilename(prefix, [...filterSegments, from, 'a', to], 'xlsx')
}

export async function exportTrayExcel(options: {
  endpoint: string
  query?: Record<string, string | number | boolean | null | undefined>
  prefix: string
  filenameSegments?: Array<string | number | null | undefined>
  fechaDesde?: string
  fechaHasta?: string
}): Promise<void> {
  const from = (options.fechaDesde ?? String(options.query?.fecha_desde ?? '')).trim()
  const to = (options.fechaHasta ?? String(options.query?.fecha_hasta ?? '')).trim()
  const err = exportRangeError(from, to)
  if (err) throw new Error(err)

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (key === 'pagina' || key === 'page_size' || key === 'fecha_desde' || key === 'fecha_hasta') {
      continue
    }
    if (value === undefined || value === null || String(value).trim() === '') continue
    search.set(key, String(value))
  }
  search.set('fecha_desde', from)
  search.set('fecha_hasta', to)

  const blob = await apiRequest<Blob>(`${options.endpoint}?${search.toString()}`, {
    responseType: 'blob',
  })
  const filename = buildTrayExportFilename(options.prefix, options.filenameSegments ?? [], from, to)
  downloadBlob(blob, filename)
}
