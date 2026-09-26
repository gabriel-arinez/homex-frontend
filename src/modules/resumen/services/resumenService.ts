import type { ValorCatalogoPublico } from '@/generated/api'
import { proformasService } from '@/modules/proformas/services/proformasService'
export type ConteoEstado = {
  estado: ValorCatalogoPublico
  conteo: number | null
  error: string | null
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
}
