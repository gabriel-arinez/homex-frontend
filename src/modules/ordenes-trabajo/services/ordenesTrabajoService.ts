import type { OrdenTrabajo, ValorCatalogoPublico } from '@/generated/api'
import { apiRequest } from '@/shared/api'
export const ordenesTrabajoService = {
  list: () => apiRequest<OrdenTrabajo[]>('/api/v1/ordenes-trabajo/'),
  get: (id: number) => apiRequest<OrdenTrabajo>(`/api/v1/ordenes-trabajo/${id}/`),
  options: (concepto: 'ESTADO_ORDEN_TRABAJO' | 'ESTADO_SALDO') =>
    apiRequest<ValorCatalogoPublico[]>(`/api/v1/catalogo/opciones/?concepto=${concepto}`),
}
