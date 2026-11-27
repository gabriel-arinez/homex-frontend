/** Límites comerciales de HOMEX: alineados con validación del servidor. */
export const MAX_RECORD_SECONDS = 240
export const MAX_UPLOAD_SECONDS = 300
export const MAX_AUDIO_BYTES = 20_000_000
/** Extensiones admitidas para subida de audio: incluye formatos móviles comunes con transcodificación transparente a WAV si es necesario */
export const ALLOWED_AUDIO_EXTENSIONS = /\.(wav|mp3|m4a|ogg|webm|aac|opus|mp4|flac)$/i

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

export const MIN_AUDIO_SECONDS = 15
export const MAX_TRANSCRIPT_CHARACTERS = 3_000
/** CPU transcription can take longer than the recording itself. */
export const CAPTURE_TIMEOUT_MS = 22 * 60_000

/** Whitespace-delimited commercial tokens; isolated punctuation is not a word. */
export function countTranscriptWords(text: string): number {
  return text.split(/\s+/u).filter((token) => /[\p{L}\p{N}]/u.test(token)).length
}

export function countTranscriptCharacters(text: string): number {
  return Array.from(text).length
}

export function validateTranscript(text: string): string {
  if (!/[\p{L}]/u.test(text)) return 'Ingresa contenido textual procesable antes de procesarlo.'
  if (countTranscriptCharacters(text) > MAX_TRANSCRIPT_CHARACTERS)
    return `La descripción supera ${MAX_TRANSCRIPT_CHARACTERS} caracteres. Reduce el texto antes de procesarlo.`
  return ''
}

export function validateAudioDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0)
    return 'No se pudo comprobar la duración. Selecciona otro archivo de audio.'
  if (seconds < MIN_AUDIO_SECONDS)
    return 'El audio debe durar al menos 15 segundos. Dicta una descripción más completa.'
  if (seconds !== null && seconds > MAX_UPLOAD_SECONDS)
    return 'El audio supera los 5 minutos permitidos.'
  return ''
}
