import type { CapturaAceptada, CrearCatalogoWritable, ResultadoCatalogo } from '@/generated/api'
import { apiRequest } from '@/shared/api'
import { audioExtension } from '@/modules/capturas/services/capturasService'

export const catalogoCapturaService = {
  async create(data: CrearCatalogoWritable, signal: AbortSignal) {
    let body: unknown = data
    if (data.audio) {
      const form = new FormData()
      for (const [key, value] of Object.entries(data)) {
        if (key !== 'audio' && value != null) form.append(key, String(value))
      }
      form.append(
        'audio',
        data.audio,
        data.audio instanceof File ? data.audio.name : `dictado.${audioExtension(data.audio.type)}`,
      )
      body = form
    }
    return apiRequest<CapturaAceptada>('/api/v1/capturas/catalogo/', {
      method: 'POST',
      body,
      signal,
    })
  },
  get(id: number, signal: AbortSignal) {
    return apiRequest<ResultadoCatalogo>(`/api/v1/capturas/catalogo/${id}/`, { signal })
  },
}
