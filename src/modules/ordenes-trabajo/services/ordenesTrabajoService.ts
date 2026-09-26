import type { OrdenTrabajo } from '@/generated/api'
import { apiRequest } from '@/shared/api'

export const ordenesTrabajoService = {
  list: () => apiRequest<OrdenTrabajo[]>('/api/v1/ordenes-trabajo/'),
  get: (id: number) => apiRequest<OrdenTrabajo>(`/api/v1/ordenes-trabajo/${id}/`),
  document: (id: number) =>
    apiRequest<Blob>(`/api/v1/ordenes-trabajo/${id}/documento/`, { responseType: 'blob' }),
}
