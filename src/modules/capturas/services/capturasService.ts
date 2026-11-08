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
export function appendCaptureAudio(form: FormData, audio: Blob) {
  if (audio instanceof File) {
    const extension = audio.name.split('.').pop()?.toLowerCase() ?? ''
    const mimeByExtension: Record<string, string> = {
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
      webm: 'audio/webm',
      aac: 'audio/aac',
      opus: 'audio/opus',
      mp4: 'audio/mp4',
      flac: 'audio/flac',
    }
    const mime = mimeByExtension[extension]
    const content =
      mime && !audio.type.startsWith('audio/') ? new Blob([audio], { type: mime }) : audio
    form.append('audio', content, audio.name)
  } else {
    form.append('audio', audio, `dictado.${audioExtension(audio.type)}`)
  }
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
