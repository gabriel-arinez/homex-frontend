import { describe, expect, it, vi } from 'vitest'
import { apiRequest } from '@/shared/api'
import { catalogoCapturaService } from './catalogoCapturaService'

vi.mock('@/shared/api', () => ({
  apiRequest: vi.fn<() => Promise<{ id: number }>>(async () => ({ id: 1 })),
}))

describe('carga de audio de catálogo con el transporte existente', () => {
  it.each([
    ['grabacion.m4a', '', 'audio/mp4'],
    ['grabacion.m4a', 'video/mp4', 'audio/mp4'],
    ['grabacion.wav', 'application/octet-stream', 'audio/wav'],
    ['grabacion.mp3', '', 'audio/mpeg'],
    ['grabacion.ogg', '', 'audio/ogg'],
    ['grabacion.webm', '', 'audio/webm'],
  ])('normaliza %s (%s) sin cambiar nombre ni contexto', async (name, type, expected) => {
    await catalogoCapturaService.create(
      {
        clave_idempotencia: 'clave',
        sesion_borrador: 'sesion',
        categoria: 'OTRO',
        audio: new File(['audio'], name, { type }),
      },
      new AbortController().signal,
    )
    const calls = vi.mocked(apiRequest).mock.calls
    const [path, options] = calls[calls.length - 1]!
    const form = options!.body as FormData
    const audio = form.get('audio') as File
    expect(path).toBe('/api/v1/capturas/catalogo/')
    expect(audio.type).toBe(expected)
    expect(audio.name).toBe(name)
    expect(form.get('categoria')).toBe('OTRO')
    expect(form.get('sesion_borrador')).toBe('sesion')
  })
  it('conserva MIME y extensión del MediaRecorder', async () => {
    await catalogoCapturaService.create(
      {
        clave_idempotencia: 'clave',
        sesion_borrador: 'sesion',
        categoria: 'SILLA',
        audio: new Blob(['audio'], { type: 'audio/webm' }),
      },
      new AbortController().signal,
    )
    const calls = vi.mocked(apiRequest).mock.calls
    const form = calls[calls.length - 1]![1]!.body as FormData
    const audio = form.get('audio') as File
    expect(audio.name).toBe('dictado.webm')
    expect(audio.type).toBe('audio/webm')
  })
})
