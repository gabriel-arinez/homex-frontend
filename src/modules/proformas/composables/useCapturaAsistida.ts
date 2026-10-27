import { onScopeDispose, ref } from 'vue'
import type { CrearAsistida, ResultadoAsistida } from '@/generated/api'
import { asistidasService } from '@/modules/capturas/services/asistidasService'

export function useCapturaAsistida() {
  const processing = ref(false)
  const error = ref('')
  let generation = 0
  let controller: AbortController | null = null
  function cancel() {
    generation++
    controller?.abort()
    controller = null
    processing.value = false
  }
  async function capture(
    datos: Omit<CrearAsistida, 'audio'> & { audio?: Blob },
  ): Promise<ResultadoAsistida | null> {
    cancel()
    const current = generation
    const abort = new AbortController()
    controller = abort
    processing.value = true
    error.value = ''
    try {
      const created = await asistidasService.create(datos, abort.signal)
      const deadline = Date.now() + 120_000
      while (!abort.signal.aborted && current === generation) {
        const result = await asistidasService.get(created.id, abort.signal)
        if (current !== generation) return null
        if (result.resultado !== 'PROCESSING') {
          if (
            result.resultado !== 'REQUIRES_REVIEW' ||
            !result.propuesta_configurador ||
            result.version_proyeccion !== 'PRF04_2'
          ) {
            // Conservar la transcripción obtenida aunque NLP se abstenga.
            // El componente decide si puede aplicar una propuesta al formulario.
            error.value = 'No se obtuvo una propuesta utilizable. Tu mueble se conserva.'
          }
          return result
        }
        if (Date.now() >= deadline)
          throw new Error('El procesamiento sigue pendiente. Tu mueble se conserva.')
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer)
            abort.signal.removeEventListener('abort', finish)
            resolve()
          }
          const timer = setTimeout(finish, 750)
          abort.signal.addEventListener('abort', finish, { once: true })
        })
      }
    } catch (cause) {
      if (current === generation && !abort.signal.aborted)
        error.value = cause instanceof Error ? cause.message : 'No se pudo procesar la captura.'
    } finally {
      if (current === generation) processing.value = false
    }
    return null
  }
  onScopeDispose(cancel)
  return { processing, error, capture, cancel }
}
