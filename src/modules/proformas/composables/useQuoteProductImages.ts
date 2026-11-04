import { ref } from 'vue'
import type { ImagenPrincipal, Producto } from '@/generated/api'
import { productosService } from '@/modules/productos/services/productosService'

/** Imágenes comerciales actuales: consulta acotada, sin alterar snapshots de proformas. */
export function useQuoteProductImages() {
  const images = ref<Record<number, ImagenPrincipal | null>>({})
  const requested = new Set<number>()
  function remember(product: Producto) {
    requested.add(product.id)
    images.value = { ...images.value, [product.id]: product.imagen_principal ?? null }
  }
  async function ensure(ids: number[]) {
    const missing = [...new Set(ids)].filter((id) => id > 0 && !requested.has(id))
    for (const id of missing) requested.add(id)
    // Concurrencia limitada: una proforma grande no dispara decenas de solicitudes simultáneas.
    for (let start = 0; start < missing.length; start += 4) {
      await Promise.allSettled(
        missing.slice(start, start + 4).map(async (id) => {
          try {
            remember(await productosService.get(id))
          } catch {
            images.value = { ...images.value, [id]: null }
          }
        }),
      )
    }
  }
  return { images, ensure, remember }
}
