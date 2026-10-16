import type {
  PaginatedProductoList,
  PatchedProductoWritable,
  Producto,
  ProductoWritable,
  V1CatalogoProductosListData,
} from '@/generated/api'
import { apiRequest } from '@/shared/api'
type ProductoListQuery = NonNullable<V1CatalogoProductosListData['query']>
function queryString(query: ProductoListQuery) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query))
    if (value !== undefined) params.set(key, String(value))
  const value = params.toString()
  return value ? `?${value}` : ''
}
export const productosService = {
  list: (query: ProductoListQuery = {}) =>
    apiRequest<PaginatedProductoList>(`/api/v1/catalogo/productos/${queryString(query)}`),
  get: (id: number) => apiRequest<Producto>(`/api/v1/catalogo/productos/${id}/`),
  create: (body: ProductoWritable) =>
    apiRequest<Producto>('/api/v1/catalogo/productos/', { method: 'POST', body }),
  update: (id: number, body: PatchedProductoWritable, revision: string) =>
    apiRequest<Producto>(`/api/v1/catalogo/productos/${id}/`, {
      method: 'PATCH',
      body,
      headers: { 'If-Match': revision },
    }),
  uploadImage: (id: number, file: File) => {
    const body = new FormData()
    body.append('archivo', file)
    return apiRequest<Producto>(`/api/v1/catalogo/productos/${id}/imagen-principal/`, {
      method: 'POST',
      body,
    })
  },
}
