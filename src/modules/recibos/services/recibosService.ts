import type { Recibo, ValorCatalogoPublico } from '@/generated/api'
import { apiRequest } from '@/shared/api'
export const recibosService = {
  list: () => apiRequest<Recibo[]>('/api/v1/recibos/'),
  get: (id: number) => apiRequest<Recibo>(`/api/v1/recibos/${id}/`),
  annul: (id: number) => apiRequest<Recibo>(`/api/v1/recibos/${id}/anular/`, { method: 'POST' }),
  paymentTypes: () =>
    apiRequest<ValorCatalogoPublico[]>('/api/v1/catalogo/opciones/?concepto=TIPO_PAGO'),
  document: (id: number) =>
    apiRequest<Blob>(`/api/v1/recibos/${id}/documento/`, { responseType: 'blob' }),
}
