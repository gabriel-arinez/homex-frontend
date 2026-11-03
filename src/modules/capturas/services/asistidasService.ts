import type { CapturaAceptada, CrearAsistida, ResultadoAsistida } from '@/generated/api'
import { apiRequest } from '@/shared/api'
import { appendCaptureAudio } from './capturasService'

export const asistidasService = {
  create: (datos: Omit<CrearAsistida, 'audio'> & { audio?: Blob }, signal: AbortSignal) => {
    let body: unknown = datos
    if (datos.audio) {
      const form = new FormData()
      for (const [key, value] of Object.entries(datos)) {
        if (key === 'audio' || value == null) continue
        form.append(key, String(value))
      }
      appendCaptureAudio(form, datos.audio)
      body = form
    }
    return apiRequest<CapturaAceptada>('/api/v1/capturas/asistidas/', {
      method: 'POST',
      body,
      signal,
    })
  },
  get: (id: number, signal: AbortSignal) =>
    apiRequest<ResultadoAsistida>(`/api/v1/capturas/asistidas/${id}/`, { signal }),
}
