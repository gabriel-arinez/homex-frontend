import type {
  DescuentoProducto,
  PatchedProductoWritable,
  Producto,
  ProductoPiso,
  ProductoSilla,
} from '@/generated/api'
import { apiRequest } from '@/shared/api'

export const productosService = {
  list: () => apiRequest<Producto[]>('/api/v1/catalogo/productos/'),
  get: (id: number) => apiRequest<Producto>(`/api/v1/catalogo/productos/${id}/`),
  update: (id: number, body: PatchedProductoWritable) =>
    apiRequest<Producto>(`/api/v1/catalogo/productos/${id}/`, { method: 'PATCH', body }),
  chairs: () => apiRequest<ProductoSilla[]>('/api/v1/catalogo/sillas/'),
  floors: () => apiRequest<ProductoPiso[]>('/api/v1/catalogo/pisos/'),
  discounts: () => apiRequest<DescuentoProducto[]>('/api/v1/catalogo/descuentos/'),
}

export type ProductPresentation = {
  type: 'SILLA' | 'PISO FLOTANTE' | 'OTRO'
  detail: string | null
}

export function presentation(
  productId: number,
  chairs: ProductoSilla[],
  floors: ProductoPiso[],
): ProductPresentation {
  const chair = chairs.find((item) => item.producto === productId)
  if (chair) return { type: 'SILLA', detail: chair.modelo ?? null }
  const floor = floors.find((item) => item.producto === productId)
  if (floor)
    return {
      type: 'PISO FLOTANTE',
      detail: floor.m2_por_caja ? `${floor.m2_por_caja} m² por caja` : (floor.modelo ?? null),
    }
  return { type: 'OTRO', detail: null }
}

export function activeDiscount(
  productId: number,
  discounts: DescuentoProducto[],
  today = new Date(),
) {
  const date = today.toISOString().slice(0, 10)
  return discounts.find(
    (item) =>
      item.producto === productId &&
      item.activo !== false &&
      (!item.fecha_inicio || item.fecha_inicio <= date) &&
      (!item.fecha_fin || item.fecha_fin >= date),
  )
}
