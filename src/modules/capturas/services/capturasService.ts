import type {
  CapturaAceptada,
  CapturaRevision,
  ConfirmacionHitlRespuesta,
  ConfirmarCaptura,
  CrearCapturaTexto,
} from '@/generated/api'
import { apiRequest } from '@/shared/api'
export function audioExtension(mime: string) {
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mpeg')) return 'mp3'
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('wav')) return 'wav'
  return 'webm'
}
export const capturasService = {
  createText: (body: CrearCapturaTexto) =>
    apiRequest<CapturaAceptada>('/api/v1/capturas/', { method: 'POST', body }),
  createAudio: (data: {
    clave_idempotencia: string
    proforma: number
    proforma_detalle?: number | null
    audio: Blob
    filename: string
  }) => {
    const body = new FormData()
    body.append('clave_idempotencia', data.clave_idempotencia)
    body.append('proforma', String(data.proforma))
    if (data.proforma_detalle) body.append('proforma_detalle', String(data.proforma_detalle))
    body.append(
      'audio',
      new File([data.audio], data.filename, { type: data.audio.type || 'audio/webm' }),
    )
    return apiRequest<CapturaAceptada>('/api/v1/capturas/', {
      method: 'POST',
      body,
      timeoutMs: 30_000,
    })
  },
  get: (id: number) => apiRequest<CapturaRevision>(`/api/v1/capturas/${id}/`),
  confirm: (id: number, body: ConfirmarCaptura) =>
    apiRequest<ConfirmacionHitlRespuesta>(`/api/v1/capturas/${id}/confirmar/`, {
      method: 'POST',
      body,
    }),
}
