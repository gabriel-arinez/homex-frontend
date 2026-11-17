import { afterEach, expect, it, vi } from 'vitest'
import { audioBufferToWavBlob, prepareAudioForCapture } from '@/modules/capturas/audioConversion'
const decoded = (duration = 15): AudioBuffer =>
  ({
    duration,
    length: duration * 16000,
    sampleRate: 16000,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(duration * 16000).fill(0.25),
  }) as unknown as AudioBuffer
function mobile(name = 'phone.aac') {
  const file = new File(['compressed'], name)
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(2) })
  return file
}
function decoder(buffer: AudioBuffer) {
  vi.stubGlobal(
    'AudioContext',
    class {
      async decodeAudioData() {
        return buffer
      }
      async close() {}
    },
  )
}
afterEach(() => vi.unstubAllGlobals())
it.each(['aac', 'opus', 'mp4', 'flac'])(
  'converts announced mobile %s files to complete WAV before upload',
  async (extension) => {
    decoder(decoded())
    const file = await prepareAudioForCapture(mobile(`phone.${extension}`))
    expect(file.name).toBe('phone.wav')
    expect(file.type).toBe('audio/wav')
    expect(file.size).toBe(44 + 15 * 16000 * 2)
  },
)
it('rejects unavailable or failed conversion explicitly, never sending the original extension', async () => {
  vi.stubGlobal('AudioContext', undefined)
  await expect(prepareAudioForCapture(mobile())).rejects.toThrow(/convertir|conversión/i)
  vi.stubGlobal(
    'AudioContext',
    class {
      async decodeAudioData() {
        throw new Error('bad codec')
      }
      async close() {}
    },
  )
  await expect(prepareAudioForCapture(mobile())).rejects.toThrow(/convertir|dañado/i)
})
it.each([14, 301])('rejects converted duration %s before producing an upload', async (seconds) => {
  decoder(decoded(seconds))
  await expect(prepareAudioForCapture(mobile())).rejects.toThrow(/15 segundos|5 minutos/)
})
it('refuses oversized decoded PCM before allocating or silently truncating samples', () => {
  const buffer = {
    duration: 300,
    length: 300 * 48000,
    sampleRate: 48000,
    numberOfChannels: 2,
    getChannelData: () => {
      throw new Error('must not allocate')
    },
  } as unknown as AudioBuffer
  expect(() => audioBufferToWavBlob(buffer)).toThrow(/20 MB/)
})
