import { apiRequest } from '@/shared/api'
import { downloadBlob } from './downloadBlob'
import { buildExportFilename } from './exportFilename'

export async function exportTrayExcel(options: {
  endpoint: string
  query?: Record<string, string | number | boolean | null | undefined>
  prefix: string
  filenameSegments?: Array<string | number | null | undefined>
}): Promise<void> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (key === 'pagina' || key === 'page_size') continue
    if (value === undefined || value === null || String(value).trim() === '') continue
    search.set(key, String(value))
  }
  const suffix = search.toString() ? `?${search.toString()}` : ''
  const blob = await apiRequest<Blob>(`${options.endpoint}${suffix}`, {
    responseType: 'blob',
  })
  const filename = buildExportFilename(options.prefix, options.filenameSegments ?? [], 'xlsx')
  downloadBlob(blob, filename)
}
