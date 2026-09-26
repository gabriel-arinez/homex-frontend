import type {
  CambiarEstadoPedido,
  NotaEntrega,
  Pedido,
  Recibo,
  EmitirRecibo,
  ValorCatalogoPublico,
} from '@/generated/api'
import { apiRequest } from '@/shared/api'
export const pedidosService = {
  list: () => apiRequest<Pedido[]>('/api/v1/pedidos/'),
  get: (id: number) => apiRequest<Pedido>(`/api/v1/pedidos/${id}/`),
  changeState: (id: number, body: CambiarEstadoPedido) =>
    apiRequest<Pedido>(`/api/v1/pedidos/${id}/cambiar-estado/`, { method: 'POST', body }),
  cancel: (id: number) => apiRequest<Pedido>(`/api/v1/pedidos/${id}/cancelar/`, { method: 'POST' }),
  emitReceipt: (id: number, body: EmitirRecibo) =>
    apiRequest<Recibo>(`/api/v1/pedidos/${id}/emitir_recibo/`, { method: 'POST', body }),
  emitDeliveryNote: (id: number) =>
    apiRequest<NotaEntrega>(`/api/v1/pedidos/${id}/emitir_nota_entrega/`, { method: 'POST' }),
  options: (concepto: 'ESTADO_PEDIDO' | 'TIPO_PAGO') =>
    apiRequest<ValorCatalogoPublico[]>(`/api/v1/catalogo/opciones/?concepto=${concepto}`),
}
