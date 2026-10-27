import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useCapturaAsistida } from '@/modules/proformas/composables/useCapturaAsistida'
import { asistidasService } from '@/modules/capturas/services/asistidasService'
import type { ResultadoAsistida } from '@/generated/api'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
const entrada = {
  clave_idempotencia: 'a',
  sesion_borrador: 'b',
  moneda_codigo: 'BOB' as const,
  texto: 'un escritorio',
}
const result = {
  id: 1,
  resultado: 'REQUIRES_REVIEW',
  version_proyeccion: 'PRF04_2',
  propuesta_configurador: { comercial: { nombre: 'Escritorio' } },
} as ResultadoAsistida

describe('PRF-04 respuestas obsoletas', () => {
  it('cancelar durante la recepción impide aplicar respuesta tardía', async () => {
    const pending = deferred<{
      id: number
      estado: string
      intento_id: number
      numero_intento: number
      reutilizada: boolean
    }>()
    vi.spyOn(asistidasService, 'create').mockReturnValue(pending.promise)
    const get = vi.spyOn(asistidasService, 'get').mockResolvedValue(result)
    const scope = effectScope()
    const voice = scope.run(useCapturaAsistida)!
    const promise = voice.capture(entrada)
    voice.cancel()
    pending.resolve({
      id: 1,
      estado: 'PENDIENTE',
      intento_id: 1,
      numero_intento: 1,
      reutilizada: false,
    })
    expect(await promise).toBeNull()
    expect(get).not.toHaveBeenCalled()
    expect(voice.processing.value).toBe(false)
    scope.stop()
    vi.restoreAllMocks()
  })
  it('dos respuestas invertidas sólo aplican la generación vigente', async () => {
    const first = deferred<ResultadoAsistida>()
    vi.spyOn(asistidasService, 'create').mockResolvedValue({
      id: 1,
      estado: 'PENDIENTE',
      intento_id: 1,
      numero_intento: 1,
      reutilizada: false,
    })
    vi.spyOn(asistidasService, 'get').mockReturnValueOnce(first.promise).mockResolvedValue(result)
    const scope = effectScope()
    const voice = scope.run(useCapturaAsistida)!
    const old = voice.capture(entrada)
    await Promise.resolve()
    const current = voice.capture(entrada)
    expect(await current).toBe(result)
    first.resolve(result)
    expect(await old).toBeNull()
    scope.stop()
    vi.restoreAllMocks()
  })

  it('rechaza una proyección antigua sin aplicarla', async () => {
    vi.spyOn(asistidasService, 'create').mockResolvedValue({
      id: 1,
      estado: 'PENDIENTE',
      intento_id: 1,
      numero_intento: 1,
      reutilizada: false,
    })
    vi.spyOn(asistidasService, 'get').mockResolvedValue({
      ...result,
      version_proyeccion: 'PRF04_1',
    })

    const scope = effectScope()
    const voice = scope.run(useCapturaAsistida)!

    try {
      expect(await voice.capture(entrada)).toBeNull()
      expect(voice.error.value).toBe(
        'No se obtuvo una propuesta utilizable. Tu mueble se conserva.',
      )
      expect(voice.processing.value).toBe(false)
    } finally {
      scope.stop()
      vi.restoreAllMocks()
    }
  })
})
