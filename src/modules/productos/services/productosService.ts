import type {
  DemandaPendienteDesglose,
  PaginatedProductoList,
  PatchedProductoWritable,
  Producto,
  ProductoSimilaresRespuesta,
  ProductoWritable,
  V1CatalogoProductosListData,
} from '@/generated/api'
import { apiRequest } from '@/shared/api'
type ProductoListQuery = NonNullable<V1CatalogoProductosListData['query']> & {
  marca?: string | number
  modelo?: string
  color_primario?: string | number
  tipo?: string | number
  material?: string | number
  diseno?: string | number
  acabado?: string | number
  espesor_mm?: string
  unidad_stock?: string | number
  modalidad_abastecimiento?: 'CON_STOCK' | 'BAJO_PEDIDO'
  estado_stock?: 'SIN_EXISTENCIAS' | 'STOCK_BAJO' | 'NORMAL' | 'SIN_MINIMO' | 'BAJO_PEDIDO'
}
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
  getDemandaPendiente: (id: number) =>
    apiRequest<DemandaPendienteDesglose>(`/api/v1/catalogo/productos/${id}/demanda-pendiente/`),
  updateStockMinimo: (id: number, stockMinimo: string | null) =>
    apiRequest<Producto>(`/api/v1/catalogo/productos/${id}/stock-minimo/`, {
      method: 'PATCH',
      body: { stock_minimo: stockMinimo },
    }),
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
  verificarSimilares: (params: {
    exclude_id?: number
    sku?: string
    nombre?: string
    categoria?: number
    marca?: number
    modelo?: string
    color_primario?: number
    espesor_mm?: string
  }) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && String(value).trim() !== '') {
        search.set(key, String(value).trim())
      }
    }
    const qs = search.toString()
    return apiRequest<ProductoSimilaresRespuesta>(
      `/api/v1/catalogo/productos/verificar-similares/${qs ? `?${qs}` : ''}`,
    )
  },
}
