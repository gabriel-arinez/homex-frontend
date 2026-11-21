import type {
  AjusteStockCrear,
  CatalogoMotivosAjuste,
  MovimientoStock,
  PaginatedMovimientoStockList,
  ReporteMovimientosRespuesta,
  V1MovimientosStockListData,
  ValorCatalogoPublico,
} from '@/generated/api'
import { apiRequest } from '@/shared/api'

type Query = NonNullable<V1MovimientosStockListData['query']> & {
  direccion?: 'ENTRADA' | 'SALIDA'
  motivo?: string
}

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
  reporte: (query: Query = {}) =>
    apiRequest<ReporteMovimientosRespuesta>(`/api/v1/movimientos-stock/reporte/${qs(query)}`),
  exportarCsv: (query: Omit<Query, 'pagina' | 'page_size'> = {}) =>
    apiRequest<Blob>(`/api/v1/movimientos-stock/exportar-csv/${qs(query)}`, {
      responseType: 'blob',
    }),
  motivosAjuste: () =>
    apiRequest<CatalogoMotivosAjuste>('/api/v1/movimientos-stock/motivos-ajuste/'),
  registrarAjuste: (body: AjusteStockCrear, idempotencyKey?: string) =>
    apiRequest<MovimientoStock>('/api/v1/movimientos-stock/ajustes/', {
      method: 'POST',
      body,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  types: () =>
    apiRequest<ValorCatalogoPublico[]>('/api/v1/catalogo/opciones/?concepto=TIPO_MOVIMIENTO'),
}
