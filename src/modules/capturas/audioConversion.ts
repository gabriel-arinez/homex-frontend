export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(buffer.numberOfChannels, 2)
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

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
    return file
  }
  const audioCtx = new AudioCtx()
  try {
    const arrayBuffer = await file.arrayBuffer()
    const decoded = await audioCtx.decodeAudioData(arrayBuffer)
    const wavBlob = audioBufferToWavBlob(decoded)
    const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || 'audio'
    return new File([wavBlob], `${originalName}.wav`, { type: 'audio/wav' })
  } finally {
    void audioCtx.close().catch(() => undefined)
  }
}
