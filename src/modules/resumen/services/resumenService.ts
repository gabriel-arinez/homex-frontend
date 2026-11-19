import type { OrdenTrabajo, ValorCatalogoPublico } from '@/generated/api'
import { ordenesTrabajoService } from '@/modules/ordenes-trabajo/services/ordenesTrabajoService'
import { proformasService } from '@/modules/proformas/services/proformasService'

export type ConteoEstado = {
  estado: ValorCatalogoPublico
  conteo: number | null
  error: string | null
}

export type ResumenTaller = {
  total: number
  conFabricacion: number
  soloCatalogo: number
  porEstado: Array<{ codigo: string; nombre: string; conteo: number }>
}

function ordenTieneFabricacion(ot: OrdenTrabajo): boolean {
  return (ot.detalles ?? []).some(
    (line) => line.tipo_item_info?.codigo === 'MUEBLE_MEDIDA' || Boolean(line.especificacion),
  )
}

export const resumenService = {
  estados: () => proformasService.options('ESTADO_PROFORMA'),
  async contarEstado(estado: ValorCatalogoPublico): Promise<ConteoEstado> {
    try {
      const data = await proformasService.list({ estado: estado.codigo, page: 1, page_size: 1 })
      return { estado, conteo: data.count, error: null }
    } catch (e) {
      return { estado, conteo: null, error: e instanceof Error ? e.message : 'No disponible' }
    }
  },
  async distribucion(estados: ValorCatalogoPublico[]) {
    return Promise.all(estados.map((estado) => this.contarEstado(estado)))
  },
  async resumenTaller(): Promise<ResumenTaller> {
    const ordenes = await ordenesTrabajoService.list()
    const conteos = new Map<string, { codigo: string; nombre: string; conteo: number }>()
    let conFabricacion = 0
    for (const ot of ordenes) {
      if (ordenTieneFabricacion(ot)) conFabricacion += 1
      const codigo = ot.estado_info?.codigo || String(ot.estado)
      const nombre = ot.estado_info?.nombre || codigo
      const actual = conteos.get(codigo)
      if (actual) actual.conteo += 1
      else conteos.set(codigo, { codigo, nombre, conteo: 1 })
    }
    return {
      total: ordenes.length,
      conFabricacion,
      soloCatalogo: ordenes.length - conFabricacion,
      porEstado: Array.from(conteos.values()),
    }
  },
}
