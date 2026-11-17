import { readFileSync } from 'node:fs'
import { MAX_RECORD_SECONDS } from '../../modules/capturas/audioLimits'

/** Fake microphone input plays in real time, including fixture silence. */
export function recordingFixtureDurationMs(path: string): number {
  const wav = readFileSync(path)
  if (
    wav.length < 12 ||
    wav.toString('ascii', 0, 4) !== 'RIFF' ||
    wav.toString('ascii', 8, 12) !== 'WAVE'
  )
    throw new Error('Integration microphone fixture must be a valid RIFF WAV.')
  let byteRate = 0
  let dataSize = 0
  for (let offset = 12; offset + 8 <= wav.length;) {
    const size = wav.readUInt32LE(offset + 4)
    const body = offset + 8
    if (body + size > wav.length) throw new Error('Integration WAV fixture is truncated.')
    const kind = wav.toString('ascii', offset, offset + 4)
    if (kind === 'fmt ' && size >= 16) byteRate = wav.readUInt32LE(body + 8)
    if (kind === 'data') dataSize += size
    offset = body + size + (size % 2)
  }
  if (!byteRate || !dataSize) throw new Error('Integration WAV fixture has no playable audio.')
  const duration = Math.ceil((dataSize / byteRate) * 1000) + 250
  if (duration >= MAX_RECORD_SECONDS * 1000)
    throw new Error('Integration fixture exceeds microphone duration.')
  return duration
}
