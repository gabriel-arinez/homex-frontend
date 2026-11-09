import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { proformasService } from '../services/proformasService'

/** Un mismo Blob PDF para visualizar, descargar e imprimir la versión guardada. */
export function useProformaPdf() {
  const blob = shallowRef<Blob | null>(null)
  const url = ref('')
  const loading = ref(false)
  const error = ref('')
  let request = 0

  function clear() {
    request++
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = ''
    blob.value = null
    loading.value = false
    error.value = ''
  }

  async function load(id: number): Promise<Blob | null> {
    const token = ++request
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = ''
    blob.value = null
    loading.value = true
    error.value = ''
    try {
      const result = await proformasService.documentPdf(id)
      if (token !== request) return null
      if (!result.size || !result.type.includes('pdf'))
        throw new Error('El servidor no devolvió un documento PDF válido.')
      blob.value = result
      url.value = URL.createObjectURL(result)
      return result
    } catch (cause) {
      if (token === request) {
        error.value =
          cause instanceof Error ? cause.message : 'No se pudo generar el documento PDF.'
      }
      return null
    } finally {
      if (token === request) loading.value = false
    }
  }

  onBeforeUnmount(clear)
  return { blob, url, loading, error, load, clear }
}
