import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { OrdenTrabajo, Pedido, Producto, ProformaListado, Recibo } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { ordenesTrabajoService } from '@/modules/ordenes-trabajo/services/ordenesTrabajoService'
import { pedidosService } from '@/modules/pedidos/services/pedidosService'
import { productosService } from '@/modules/productos/services/productosService'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { recibosService } from '@/modules/recibos/services/recibosService'
import { localToday } from '@/shared/validation/dateRange'

export type AlertSeverity = 'info' | 'warning' | 'danger' | 'success'
export type AlertCategory = 'taller' | 'comercial' | 'inventario' | 'finanzas'

export type DynamicAlert = {
  id: string
  fingerprint: string
  severity: AlertSeverity
  category: AlertCategory
  title: string
  message: string
  to: string
  meta?: string
  isNew: boolean
}

const STORAGE_PREFIX = 'homex.alerts.seen.v1.'
const MAX_STORED_FINGERPRINTS = 400
const POLL_INTERVAL_MS = 25000

function loadSeenFingerprints(userId: number): Set<string> {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

function saveSeenFingerprints(userId: number, seen: Set<string>) {
  try {
    const trimmed = Array.from(seen).slice(-MAX_STORED_FINGERPRINTS)
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(trimmed))
  } catch {
    // Ignorar errores de cuota de almacenamiento del navegador.
  }
}

function daysBetweenIso(fromIso: string, toIso: string): number | null {
  const from = new Date(`${fromIso.slice(0, 10)}T00:00:00`)
  const to = new Date(`${toIso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

function hasFabricationLine(ot: OrdenTrabajo): boolean {
  return (ot.detalles ?? []).some(
    (line) => line.tipo_item_info?.codigo === 'MUEBLE_MEDIDA' || Boolean(line.especificacion),
  )
}

function otTechnicalWarnings(ot: OrdenTrabajo): string[] {
  const warnings: string[] = []
  for (const line of ot.detalles ?? []) {
    const raw = (line.especificacion?.datos_tecnicos as Record<string, unknown> | undefined)
      ?.advertencias
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string' && item.trim()) warnings.push(item.trim())
      }
    }
  }
  return warnings
}

function severityOrder(severity: AlertSeverity): number {
  if (severity === 'danger') return 0
  if (severity === 'success') return 1
  if (severity === 'warning') return 2
  return 3
}

export const useAlertsStore = defineStore('alerts', () => {
  const session = useSessionStore()
  const items = ref<DynamicAlert[]>([])
  const loading = ref(false)
  const lastUpdatedAt = ref<number | null>(null)
  const seenFingerprints = ref<Set<string>>(new Set())
  const knownFingerprints = ref<Set<string>>(new Set())
  const initializedBaseline = ref(false)
  const liveToast = ref<{ message: string; tone: 'success' | 'danger' | 'info' } | null>(null)

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let visibilityBound = false
  let activeRefresh: Promise<void> | null = null

  const unseenItems = computed(() => items.value.filter((item) => item.isNew))
  const unseenCount = computed(() => unseenItems.value.length)

  function syncSeenFromStorage() {
    const userId = session.identity?.id
    if (!userId) {
      seenFingerprints.value = new Set()
      return
    }
    seenFingerprints.value = loadSeenFingerprints(userId)
  }

  function applySeenFlags(rawAlerts: Array<Omit<DynamicAlert, 'isNew'>>): DynamicAlert[] {
    return rawAlerts
      .map((alert) => ({
        ...alert,
        isNew: !seenFingerprints.value.has(alert.fingerprint),
      }))
      .sort((a, b) => {
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1
        return severityOrder(a.severity) - severityOrder(b.severity)
      })
  }

  function markSeen(alertIdOrFingerprint: string) {
    const target = items.value.find(
      (item) => item.id === alertIdOrFingerprint || item.fingerprint === alertIdOrFingerprint,
    )
    const fp = target?.fingerprint ?? alertIdOrFingerprint
    seenFingerprints.value.add(fp)
    const userId = session.identity?.id
    if (userId) saveSeenFingerprints(userId, seenFingerprints.value)
    items.value = items.value.map((item) =>
      item.fingerprint === fp ? { ...item, isNew: false } : item,
    )
  }

  function markAllSeen() {
    for (const item of items.value) {
      seenFingerprints.value.add(item.fingerprint)
    }
    const userId = session.identity?.id
    if (userId) saveSeenFingerprints(userId, seenFingerprints.value)
    items.value = items.value.map((item) => ({ ...item, isNew: false }))
  }

  function dismissLiveToast() {
    liveToast.value = null
  }

  function reset() {
    stopPolling()
    items.value = []
    seenFingerprints.value = new Set()
    knownFingerprints.value = new Set()
    initializedBaseline.value = false
    lastUpdatedAt.value = null
    liveToast.value = null
  }

  async function refresh() {
    if (!session.isAuthenticated || !session.identity?.id) {
      items.value = []
      return
    }
    if (activeRefresh) return activeRefresh

    activeRefresh = (async () => {
      loading.value = true
      try {
        syncSeenFromStorage()
        const today = localToday()
        const role = session.roleProfile
        const isAdmin = role === 'ADMIN'
        const isCommercial = session.can('comercial.operar')
        const isWorkshop = session.can('taller.operar')

        const [
          otRes,
          pedidosRes,
          estadosPedidoRes,
          proformasRes,
          sinStockRes,
          stockBajoRes,
          recibosRes,
        ] = await Promise.allSettled([
          isWorkshop || isCommercial ? ordenesTrabajoService.list() : Promise.resolve([]),
          isCommercial ? pedidosService.list() : Promise.resolve([]),
          isCommercial ? pedidosService.options('ESTADO_PEDIDO') : Promise.resolve([]),
          isCommercial
            ? proformasService.list({ estado: 'EN_REVISION', page: 1, page_size: 20 })
            : Promise.resolve({ results: [] as ProformaListado[] }),
          isAdmin
            ? productosService.list({ estado_stock: 'SIN_EXISTENCIAS', page: 1, page_size: 20 })
            : Promise.resolve({ results: [] as Producto[] }),
          isAdmin
            ? productosService.list({ estado_stock: 'STOCK_BAJO', page: 1, page_size: 20 })
            : Promise.resolve({ results: [] as Producto[] }),
          isAdmin ? recibosService.list() : Promise.resolve([] as Recibo[]),
        ])

        const ordenes: OrdenTrabajo[] =
          otRes.status === 'fulfilled' ? otRes.value.filter(hasFabricationLine) : []
        const pedidos: Pedido[] = pedidosRes.status === 'fulfilled' ? pedidosRes.value : []
        const estadosPedido = estadosPedidoRes.status === 'fulfilled' ? estadosPedidoRes.value : []
        const estadoNombrePorId = new Map(estadosPedido.map((e) => [e.id, e.codigo]))
        const proformas: ProformaListado[] =
          proformasRes.status === 'fulfilled' ? (proformasRes.value.results ?? []) : []
        const sinStock: Producto[] =
          sinStockRes.status === 'fulfilled' ? (sinStockRes.value.results ?? []) : []
        const stockBajo: Producto[] =
          stockBajoRes.status === 'fulfilled' ? (stockBajoRes.value.results ?? []) : []
        const recibos: Recibo[] = recibosRes.status === 'fulfilled' ? recibosRes.value : []

        const collected: Array<Omit<DynamicAlert, 'isNew'>> = []

        // 1. Alertas para Jefe de Taller (y Admin con permiso de taller)
        if (isWorkshop) {
          for (const ot of ordenes) {
            const estado = ot.estado_info?.codigo ?? ''
            const pedidoEstado = ot.pedido_estado_codigo ?? ''
            const tituloRef = ot.proforma_titulo || `Pedido #${ot.pedido}`

            if (estado === 'PENDIENTE') {
              collected.push({
                id: `taller-ot-${ot.id}`,
                fingerprint: `taller-ot:${ot.id}:PENDIENTE:${ot.fecha_inicio ?? ''}:${ot.fecha_fin ?? ''}`,
                severity: 'warning',
                category: 'taller',
                title: 'Nueva orden de trabajo en taller',
                message: `OT #${ot.numero} (${tituloRef}) lista para revisión e inicio de fabricación.`,
                to: `/ordenes-trabajo/${ot.id}`,
                meta: `OT #${ot.numero} · Pedido #${ot.pedido}`,
              })
            } else if (estado === 'EN_PROCESO') {
              const targetDate = ot.fecha_entrega || ot.fecha_fin
              if (targetDate && targetDate < today) {
                collected.push({
                  id: `taller-ot-${ot.id}`,
                  fingerprint: `taller-ot:${ot.id}:RETRASADA:${targetDate}`,
                  severity: 'danger',
                  category: 'taller',
                  title: 'Orden de trabajo retrasada',
                  message: `OT #${ot.numero} (${tituloRef}) superó la fecha comprometida (${targetDate}).`,
                  to: `/ordenes-trabajo/${ot.id}`,
                  meta: `OT #${ot.numero} · Vencida ${targetDate}`,
                })
              } else if (targetDate && targetDate === today) {
                collected.push({
                  id: `taller-ot-${ot.id}`,
                  fingerprint: `taller-ot:${ot.id}:HOY:${targetDate}`,
                  severity: 'warning',
                  category: 'taller',
                  title: 'Entrega de taller programada para hoy',
                  message: `OT #${ot.numero} (${tituloRef}) tiene fecha límite hoy.`,
                  to: `/ordenes-trabajo/${ot.id}`,
                  meta: `OT #${ot.numero} · Hoy`,
                })
              } else if (!ot.fecha_fin && !ot.fecha_entrega) {
                collected.push({
                  id: `taller-ot-${ot.id}`,
                  fingerprint: `taller-ot:${ot.id}:SIN_PLAN`,
                  severity: 'warning',
                  category: 'taller',
                  title: 'Planificación pendiente en taller',
                  message: `OT #${ot.numero} está en proceso sin fecha estimada de fin o entrega.`,
                  to: `/ordenes-trabajo/${ot.id}`,
                  meta: `OT #${ot.numero} · Planificación`,
                })
              } else {
                collected.push({
                  id: `taller-ot-${ot.id}`,
                  fingerprint: `taller-ot:${ot.id}:EN_PROCESO:${ot.fecha_inicio ?? ''}:${ot.fecha_fin ?? ''}`,
                  severity: 'info',
                  category: 'taller',
                  title: 'Orden en producción',
                  message: `OT #${ot.numero} (${tituloRef}) en fabricación.`,
                  to: `/ordenes-trabajo/${ot.id}`,
                  meta: `OT #${ot.numero} · En proceso`,
                })
              }
            } else if (estado === 'CANCELADA' || pedidoEstado === 'CANCELADO') {
              collected.push({
                id: `taller-ot-cancel-${ot.id}`,
                fingerprint: `taller-ot-cancel:${ot.id}:${estado}:${pedidoEstado}`,
                severity: 'danger',
                category: 'taller',
                title: 'Orden cancelada: detener fabricación',
                message: `OT #${ot.numero} (Pedido #${ot.pedido}) fue cancelada.`,
                to: `/ordenes-trabajo/${ot.id}`,
                meta: `OT #${ot.numero} · Cancelada`,
              })
            }

            if (estado === 'PENDIENTE' || estado === 'EN_PROCESO') {
              const warnings = otTechnicalWarnings(ot)
              if (warnings.length > 0) {
                collected.push({
                  id: `taller-warn-${ot.id}`,
                  fingerprint: `taller-warn:${ot.id}:${warnings.join('|')}`,
                  severity: 'warning',
                  category: 'taller',
                  title: 'Advertencias técnicas en orden activa',
                  message: `OT #${ot.numero} tiene ${warnings.length} advertencia(s): ${warnings[0]}.`,
                  to: `/ordenes-trabajo/${ot.id}`,
                  meta: `OT #${ot.numero} · Especificación`,
                })
              }
            }
          }
        }

        // 2. Alertas para Vendedor / Encargado de Tienda (y Admin)
        if (isCommercial) {
          for (const ot of ordenes) {
            const estado = ot.estado_info?.codigo ?? ''
            const pedidoEstado = ot.pedido_estado_codigo ?? ''
            const tituloRef = ot.proforma_titulo || `Pedido #${ot.pedido}`

            if (estado === 'TERMINADA' || pedidoEstado === 'LISTO_ENTREGA') {
              collected.push({
                id: `comercial-ot-lista-${ot.id}`,
                fingerprint: `comercial-ot-lista:${ot.id}:${estado}:${pedidoEstado}`,
                severity: 'success',
                category: 'comercial',
                title: 'Orden completada por taller (Listo para entrega)',
                message: `OT #${ot.numero} (${tituloRef}) fue completada y ya cuenta con nota de entrega.`,
                to: `/pedidos/${ot.pedido}`,
                meta: `Pedido #${ot.pedido} · OT #${ot.numero}`,
              })
            } else if (
              (estado === 'PENDIENTE' || estado === 'EN_PROCESO') &&
              (ot.fecha_inicio || ot.fecha_fin || ot.fecha_entrega || ot.lugar_entrega)
            ) {
              collected.push({
                id: `comercial-ot-plan-${ot.id}`,
                fingerprint: `comercial-ot-plan:${ot.id}:${ot.fecha_inicio ?? ''}:${ot.fecha_fin ?? ''}:${ot.fecha_entrega ?? ''}:${ot.lugar_entrega ?? ''}:${ot.responsable_recepcion ?? ''}`,
                severity: 'info',
                category: 'comercial',
                title: 'Planificación actualizada por taller',
                message: `OT #${ot.numero} (Pedido #${ot.pedido}): inicio ${ot.fecha_inicio ?? '—'} · entrega ${ot.fecha_entrega ?? ot.fecha_fin ?? 'por definir'}.`,
                to: `/pedidos/${ot.pedido}`,
                meta: `Pedido #${ot.pedido} · Logística`,
              })
            }
          }

          const otsByPedido = new Map(ordenes.map((ot) => [ot.pedido, ot]))
          for (const pedido of pedidos) {
            const codigo = estadoNombrePorId.get(pedido.estado) ?? ''
            const ot = otsByPedido.get(pedido.id)
            if (codigo === 'CONFIRMADO' && ot) {
              collected.push({
                id: `comercial-pedido-confirmado-${pedido.id}`,
                fingerprint: `comercial-pedido-confirmado:${pedido.id}:${codigo}`,
                severity: 'warning',
                category: 'comercial',
                title: 'Pedido pendiente de envío a taller',
                message: `Pedido #${pedido.id} tiene muebles a medida y sigue en estado Confirmado.`,
                to: `/pedidos/${pedido.id}`,
                meta: `Pedido #${pedido.id} · Sin iniciar`,
              })
            }
            if (isAdmin && codigo === 'CANCELADO') {
              collected.push({
                id: `admin-pedido-cancelado-${pedido.id}`,
                fingerprint: `admin-pedido-cancelado:${pedido.id}:${codigo}`,
                severity: 'danger',
                category: 'comercial',
                title: 'Pedido cancelado',
                message: `El pedido #${pedido.id} figura en estado Cancelado.`,
                to: `/pedidos/${pedido.id}`,
                meta: `Pedido #${pedido.id}`,
              })
            }
          }

          for (const prof of proformas) {
            if (!prof.fecha_vencimiento) continue
            const diff = daysBetweenIso(today, prof.fecha_vencimiento)
            if (diff === null) continue
            if (diff < 0) {
              collected.push({
                id: `comercial-prof-venc-${prof.id}`,
                fingerprint: `comercial-prof-venc:${prof.id}:vencida:${prof.fecha_vencimiento}`,
                severity: 'danger',
                category: 'comercial',
                title: 'Proforma en revisión vencida',
                message: `Proforma #${prof.numero}${prof.titulo ? ` (${prof.titulo})` : ''} venció el ${prof.fecha_vencimiento}.`,
                to: `/proformas/${prof.id}/editar`,
                meta: `Proforma #${prof.numero}`,
              })
            } else if (diff <= 3) {
              collected.push({
                id: `comercial-prof-venc-${prof.id}`,
                fingerprint: `comercial-prof-venc:${prof.id}:por-vencer:${prof.fecha_vencimiento}`,
                severity: 'warning',
                category: 'comercial',
                title: 'Proforma próxima a vencer',
                message: `Proforma #${prof.numero}${prof.titulo ? ` (${prof.titulo})` : ''} vence en ${diff === 0 ? 'hoy' : `${diff} día(s)`}.`,
                to: `/proformas/${prof.id}/editar`,
                meta: `Proforma #${prof.numero}`,
              })
            }
          }
        }

        // 3. Alertas exclusivas de supervisión para Administrador
        if (isAdmin) {
          for (const prod of sinStock) {
            collected.push({
              id: `admin-stock-zero-${prod.id}`,
              fingerprint: `admin-stock-zero:${prod.id}:${prod.stock}`,
              severity: 'danger',
              category: 'inventario',
              title: 'Producto sin existencias',
              message: `${prod.nombre} (${prod.sku}) tiene stock en 0.`,
              to: `/productos/${prod.id}`,
              meta: prod.sku,
            })
          }
          for (const prod of stockBajo) {
            collected.push({
              id: `admin-stock-low-${prod.id}`,
              fingerprint: `admin-stock-low:${prod.id}:${prod.stock}:${prod.stock_minimo ?? ''}`,
              severity: 'warning',
              category: 'inventario',
              title: 'Stock bajo mínimo',
              message: `${prod.nombre} (${prod.sku}) tiene ${prod.stock} (mínimo ${prod.stock_minimo ?? '—'}).`,
              to: `/productos/${prod.id}`,
              meta: prod.sku,
            })
          }
          for (const rec of recibos) {
            if (rec.estado === 'ANULADO') {
              collected.push({
                id: `admin-recibo-anulado-${rec.id}`,
                fingerprint: `admin-recibo-anulado:${rec.id}:${rec.estado}`,
                severity: 'warning',
                category: 'finanzas',
                title: 'Recibo anulado',
                message: `Recibo #${rec.numero} (${rec.nombre_completo}) figura anulado.`,
                to: `/recibos/${rec.id}`,
                meta: `Recibo #${rec.numero}`,
              })
            }
          }
        }

        const nextAlerts = applySeenFlags(collected)

        // Detectar cambios en vivo posteriores al arranque de sesión para mostrar Toast.
        if (initializedBaseline.value) {
          const freshUnseen = nextAlerts.find(
            (alert) => alert.isNew && !knownFingerprints.value.has(alert.fingerprint),
          )
          if (freshUnseen) {
            liveToast.value = {
              message: `${freshUnseen.title}: ${freshUnseen.message}`,
              tone:
                freshUnseen.severity === 'danger'
                  ? 'danger'
                  : freshUnseen.severity === 'success'
                    ? 'success'
                    : 'info',
            }
          }
        }

        knownFingerprints.value = new Set(nextAlerts.map((alert) => alert.fingerprint))
        initializedBaseline.value = true
        items.value = nextAlerts
        lastUpdatedAt.value = Date.now()
      } finally {
        loading.value = false
        activeRefresh = null
      }
    })()

    return activeRefresh
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && session.isAuthenticated) {
      void refresh()
    }
  }

  function startPolling() {
    if (pollTimer) return
    void refresh()
    pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (session.isAuthenticated) void refresh()
    }, POLL_INTERVAL_MS)
    if (typeof document !== 'undefined' && !visibilityBound) {
      document.addEventListener('visibilitychange', handleVisibilityChange)
      visibilityBound = true
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (typeof document !== 'undefined' && visibilityBound) {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      visibilityBound = false
    }
  }

  return {
    items,
    unseenItems,
    unseenCount,
    loading,
    lastUpdatedAt,
    liveToast,
    refresh,
    markSeen,
    markAllSeen,
    dismissLiveToast,
    startPolling,
    stopPolling,
    reset,
  }
})
