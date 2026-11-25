import type { OrdenTrabajo, PatchedPlanificacionOrdenTrabajo } from '@/generated/api'
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
  cambiarEstado: (
    id: number,
    body: {
      estado_codigo: 'EN_PROCESO' | 'TERMINADA' | 'CANCELADA'
      observaciones?: string | null
    },
  ) =>
    apiRequest<OrdenTrabajo>(`/api/v1/ordenes-trabajo/${id}/cambiar-estado/`, {
      method: 'POST',
      body,
    }),
  updatePlanificacion: (id: number, body: PatchedPlanificacionOrdenTrabajo) =>
    apiRequest<OrdenTrabajo>(`/api/v1/ordenes-trabajo/${id}/planificacion/`, {
      method: 'PATCH',
      body,
    }),
}
