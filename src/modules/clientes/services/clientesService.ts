import type { Cliente, PatchedClienteWritable } from '@/generated/api'
import { apiRequest } from '@/shared/api'

export const clientesService = {
  list: () => apiRequest<Cliente[]>('/api/v1/clientes/'),
  get: (id: number) => apiRequest<Cliente>(`/api/v1/clientes/${id}/`),
  update: (id: number, body: PatchedClienteWritable) =>
    apiRequest<Cliente>(`/api/v1/clientes/${id}/`, { method: 'PATCH', body }),
}

export function nombreCliente(cliente: Cliente) {
  return (
    cliente.empresa?.trim() ||
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(' ').trim() ||
    `Cliente #${cliente.id}`
  )
}
