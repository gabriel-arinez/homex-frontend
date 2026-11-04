import { ref } from 'vue'
import type { GalleryImage } from '@/shared/media/gallery'
import { galleryService } from '@/shared/media/gallery'
import { proformasService } from '../services/proformasService'

type ReferenciaMueble = {
  id?: number | null
  galeria_id?: string | null
  producto?: number | null
}

/**
 * Una portada por mueble. Las referencias siguen siendo privadas y se
 * obtienen mediante endpoints autorizados; no se publican URLs de almacenamiento.
 */
export function useQuoteFurnitureCovers() {
  const covers = ref<Record<string, GalleryImage | null>>({})
  const loaded = new Set<string>()
  const inFlight = new Map<string, Promise<void>>()

  function keyOf(line: ReferenciaMueble, quoteId?: number | null): string | null {
    if (line.producto) return null
    if (line.galeria_id) return `gallery:${line.galeria_id}`
    if (quoteId && line.id) return `detail:${quoteId}:${line.id}`
    return null
  }

  function coverFor(line: ReferenciaMueble, quoteId?: number | null): GalleryImage | null {
    const key = keyOf(line, quoteId)
    return key ? covers.value[key] ?? null : null
  }

  async function fetchCover(line: ReferenciaMueble, quoteId?: number | null) {
    const key = keyOf(line, quoteId)
    if (!key || loaded.has(key)) return
    const existing = inFlight.get(key)
    if (existing) return existing

    const request = (async () => {
      try {
        let fromGallery: GalleryImage[] = []
        if (line.galeria_id) {
          try {
            fromGallery = (
              await galleryService.list(`/api/v1/galerias/${line.galeria_id}/imagenes/`)
            ).imagenes
          } catch {
            // Las proformas históricas pueden conservar archivos sin galería operativa.
            // El endpoint de adjuntos también valida los permisos de acceso.
          }
        }
        const pictures = fromGallery.length
          ? fromGallery
          : quoteId && line.id
            ? await proformasService.attachments(quoteId, line.id)
            : []
        // Se muestra una única portada, nunca la galería completa en una fila.
        const cover = pictures.find((picture) => picture.principal) ?? pictures[0] ?? null
        covers.value = { ...covers.value, [key]: cover }
        loaded.add(key)
      } catch {
        // Sin autorización o sin imagen disponible, no exponer enlaces alternativos.
        covers.value = { ...covers.value, [key]: null }
      } finally {
        inFlight.delete(key)
      }
    })()
    inFlight.set(key, request)
    return request
  }

  async function ensureLines(lines: ReferenciaMueble[], quoteId?: number | null) {
    const eligible = lines.filter((line) => !line.producto && keyOf(line, quoteId))
    // Lotes limitados para evitar una petición por línea simultáneamente.
    for (let i = 0; i < eligible.length; i += 4) {
      await Promise.allSettled(eligible.slice(i, i + 4).map((line) => fetchCover(line, quoteId)))
    }
  }

  return { coverFor, ensureLines }
}
