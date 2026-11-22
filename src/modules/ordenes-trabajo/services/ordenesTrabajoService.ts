import type { OrdenTrabajo } from '@/generated/api'
import { apiRequest } from '@/shared/api'

export const ordenesTrabajoService = {
  list: () => apiRequest<OrdenTrabajo[]>('/api/v1/ordenes-trabajo/'),
  get: (id: number) => apiRequest<OrdenTrabajo>(`/api/v1/ordenes-trabajo/${id}/`),
  document: (id: number) =>
    apiRequest<Blob>(`/api/v1/ordenes-trabajo/${id}/documento/`, { responseType: 'blob' }),
  documentPdf: (id: number) =>
    apiRequest<Blob>(`/api/v1/ordenes-trabajo/${id}/documento-pdf/`, {
      responseType: 'blob',
      cache: 'no-store',
    }),
  marcarListoEntrega: (id: number) =>
    apiRequest<OrdenTrabajo>(`/api/v1/ordenes-trabajo/${id}/marcar-listo-entrega/`, {
      method: 'POST',
    }),
}
