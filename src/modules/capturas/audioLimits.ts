/** Límites comerciales de HOMEX: alineados con validación del servidor. */
export const MAX_RECORD_SECONDS = 180
export const MAX_UPLOAD_SECONDS = 300
export const MAX_AUDIO_BYTES = 20_000_000
export const ALLOWED_AUDIO_EXTENSIONS = /\.(wav|mp3|m4a|ogg|webm)$/i

/** La duración de un archivo requiere metadata decodificable por el navegador. */
export function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const element = document.createElement('audio')
    const url = URL.createObjectURL(file)
    let finished = false
    const done = (value?: number) => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      element.removeAttribute('src')
      element.load()
      URL.revokeObjectURL(url)
      resolve(value !== undefined && Number.isFinite(value) && value > 0 ? value : null)
    }
    const timeout = setTimeout(() => done(), 2500)
    element.preload = 'metadata'
    element.onloadedmetadata = () => done(element.duration)
    element.onerror = () => done()
    element.src = url
  })
}
