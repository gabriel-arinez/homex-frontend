import type { NotaEntrega } from '@/generated/api'
import { apiRequest } from '@/shared/api'
export const notasEntregaService = {
  list: () => apiRequest<NotaEntrega[]>('/api/v1/notas-entrega/'),
  get: (id: number) => apiRequest<NotaEntrega>(`/api/v1/notas-entrega/${id}/`),
  document: (id: number) =>
    apiRequest<Blob>(`/api/v1/notas-entrega/${id}/documento/`, { responseType: 'blob' }),
}
