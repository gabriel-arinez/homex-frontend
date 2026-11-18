import {
  ALLOWED_AUDIO_EXTENSIONS,
  MAX_AUDIO_BYTES,
  readAudioDuration,
  validateAudioDuration,
} from './audioLimits'
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(buffer.numberOfChannels, 2)
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

  const expectedSize = 44 + buffer.length * numChannels * 2
  if (!Number.isFinite(expectedSize) || expectedSize > MAX_AUDIO_BYTES)
    throw new Error('El audio convertido supera 20 MB. Divide el archivo antes de continuar.')

  let interleaved: Float32Array
  if (numChannels === 2) {
    const left = buffer.getChannelData(0)
    const right = buffer.getChannelData(1)
    interleaved = new Float32Array(left.length + right.length)
    let inputIndex = 0
    let outputIndex = 0
    while (inputIndex < left.length) {
      interleaved[outputIndex++] = left[inputIndex]!
      interleaved[outputIndex++] = right[inputIndex]!
      inputIndex++
    }
  } else {
    interleaved = buffer.getChannelData(0)
  }

  const byteRate = (sampleRate * numChannels * bitDepth) / 8
  const blockAlign = (numChannels * bitDepth) / 8
  const dataSize = interleaved.length * (bitDepth / 8)
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const arrayBuffer = new ArrayBuffer(totalSize)
  const view = new DataView(arrayBuffer)

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF identifier
  writeString(0, 'RIFF')
  // file length minus 8 bytes
  view.setUint32(4, 36 + dataSize, true)
  // RIFF type & format header
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  // format chunk length
  view.setUint32(16, 16, true)
  // sample format (1 = PCM)
  view.setUint16(20, format, true)
  // channel count
  view.setUint16(22, numChannels, true)
  // sample rate
  view.setUint32(24, sampleRate, true)
  // byte rate
  view.setUint32(28, byteRate, true)
  // block align
  view.setUint16(32, blockAlign, true)
  // bits per sample
  view.setUint16(34, bitDepth, true)
  // data chunk identifier
  writeString(36, 'data')
  // data chunk length
  view.setUint32(40, dataSize, true)

  // Write PCM samples
  let offset = 44
  for (let i = 0; i < interleaved.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, interleaved[i]!))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Blob([view], { type: 'audio/wav' })
}

export async function convertAudioFileToWav(file: File): Promise<File> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) {
    throw new Error(
      'Este navegador no puede convertir el audio móvil. Utiliza WAV, MP3, M4A, OGG o WebM.',
    )
  }
  const audioCtx = new AudioCtx()
  try {
    const arrayBuffer = await file.arrayBuffer()
    let decoded: AudioBuffer
    try {
      decoded = await audioCtx.decodeAudioData(arrayBuffer)
    } catch {
      throw new Error(
        'No se pudo convertir el archivo móvil: está dañado o su códec no es compatible. Utiliza WAV, MP3, M4A, OGG o WebM.',
      )
    }
    const validation = validateAudioDuration(decoded.duration)
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0)
      throw new Error('El archivo no contiene audio decodificable.')
    if (validation) throw new Error(validation)
    const wavBlob = audioBufferToWavBlob(decoded)
    const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || 'audio'
    return new File([wavBlob], `${originalName}.wav`, { type: 'audio/wav' })
  } finally {
    void audioCtx.close().catch(() => undefined)
  }
}

/** Keep announced formats aligned with the backend's native upload whitelist. */
export async function prepareAudioForCapture(file: File): Promise<File> {
  if (!file.size || file.size > MAX_AUDIO_BYTES)
    throw new Error('El archivo está vacío o supera 20 MB.')
  if (!ALLOWED_AUDIO_EXTENSIONS.test(file.name)) throw new Error('Formato de audio no admitido.')
  if (/\.(aac|opus|mp4|flac)$/i.test(file.name)) {
    const converted = await convertAudioFileToWav(file)
    if (!/\.wav$/i.test(converted.name) || converted.type !== 'audio/wav')
      throw new Error('La conversión a WAV no pudo completarse. Selecciona un formato compatible.')
    if (!converted.size || converted.size > MAX_AUDIO_BYTES)
      throw new Error('El audio convertido está vacío o supera 20 MB.')
    return converted
  }
  const validation = validateAudioDuration(await readAudioDuration(file))
  if (validation) throw new Error(validation)
  return file
}
