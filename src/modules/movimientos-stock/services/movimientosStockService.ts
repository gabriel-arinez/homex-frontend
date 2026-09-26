import type {
  PaginatedMovimientoStockList,
  V1MovimientosStockListData,
  ValorCatalogoPublico,
} from '@/generated/api'
import { apiRequest } from '@/shared/api'

type Query = NonNullable<V1MovimientosStockListData['query']>

const qs = (query: Query) => {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return params.size ? `?${params}` : ''
}

export const movimientosStockService = {
  list: (query: Query = {}) =>
    apiRequest<PaginatedMovimientoStockList>(`/api/v1/movimientos-stock/${qs(query)}`),
  types: () =>
    apiRequest<ValorCatalogoPublico[]>('/api/v1/catalogo/opciones/?concepto=TIPO_MOVIMIENTO'),
}
