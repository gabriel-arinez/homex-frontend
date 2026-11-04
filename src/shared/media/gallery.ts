import { apiRequest } from '@/shared/api'
import { getApiBaseUrl } from '@/app/config/env'
export type GalleryImage = {
  sha256?: string
  id: number
  nombre: string
  url: string
  principal: boolean
  posicion: number
  variantes?: Record<string, string>
}
export type LocalImage = { file: File; url: string; principal: boolean; digest: string }
export type GalleryData = { imagenes: GalleryImage[]; limite: number }
export function mediaUrl(url: string) {
  return url.startsWith('/') ? new URL(url, getApiBaseUrl() || window.location.origin).href : url
}
export const galleryService = {
  list: async (path: string): Promise<GalleryData> => {
    const result = await apiRequest<GalleryData | GalleryImage[]>(path)
    return Array.isArray(result) ? { imagenes: result, limite: 8 } : result
  },
  upload: async (path: string, file: File, digest?: string): Promise<GalleryData> => {
    const body = new FormData()
    body.append('archivo', file)
    try {
      await apiRequest(path, { method: 'POST', body, timeoutMs: 120_000 })
    } catch (cause) {
      const current = await galleryService.list(path)
      if (!digest || !current.imagenes.some((i) => i.sha256 === digest)) throw cause
      return current
    }
    return galleryService.list(path)
  },
  change: async (
    path: string,
    body: { principal?: number; orden?: number[]; eliminar?: number },
  ) => {
    await apiRequest(path, { method: 'PATCH', body })
    return galleryService.list(path)
  },
  create: (sesion: string, detalle?: number, origen?: string, id?: string) =>
    apiRequest<{ id: string }>('/api/v1/galerias/', {
      method: 'POST',
      body: { sesion, detalle, origen, id },
    }),
}
