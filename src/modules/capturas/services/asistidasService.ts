import type { CapturaAceptada, CrearAsistida, ResultadoAsistida } from '@/generated/api'
import { apiRequest } from '@/shared/api'
import { audioExtension } from './capturasService'

export const asistidasService = {
  create: (datos: Omit<CrearAsistida, 'audio'> & { audio?: Blob }, signal: AbortSignal) => {
    let body: unknown = datos
    if (datos.audio) {
      const form = new FormData()
      for (const [key, value] of Object.entries(datos)) {
        if (key === 'audio' || value == null) continue
        form.append(key, String(value))
      }
      if (datos.audio instanceof File) {
        const extension = datos.audio.name.split('.').pop()?.toLowerCase() ?? ''
        const mimePorExtension: Record<string, string> = {
          wav: 'audio/wav',
          mp3: 'audio/mpeg',
          m4a: 'audio/mp4',
          ogg: 'audio/ogg',
          webm: 'audio/webm',
        }
        const mime = mimePorExtension[extension]
        const contenido =
          mime && !datos.audio.type.startsWith('audio/')
            ? new Blob([datos.audio], { type: mime })
            : datos.audio
        form.append('audio', contenido, datos.audio.name)
      } else {
        form.append('audio', datos.audio, `dictado.${audioExtension(datos.audio.type)}`)
      }
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
