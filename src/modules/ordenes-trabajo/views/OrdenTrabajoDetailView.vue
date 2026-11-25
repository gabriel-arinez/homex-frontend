<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  ClipboardCheck,
  Clock3,
  Download,
  FileText,
  Hammer,
  Layers,
  MapPin,
  Package,
  PackageCheck,
  Pencil,
  Ruler,
  SlidersHorizontal,
  StickyNote,
  Tag,
  Truck,
  UserCheck,
  Wrench,
  X,
} from '@lucide/vue'
import type {
  DetalleOrdenTrabajo,
  OrdenTrabajo,
  Producto,
  ValorCatalogoPublico,
} from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { productosService } from '@/modules/productos/services/productosService'
import { proformasService } from '@/modules/proformas/services/proformasService'
import type {
  AtributoTecnico,
  ComponenteTecnico,
  ConjuntoTecnico,
  DatosTecnicos,
} from '@/modules/proformas/services/muebleTecnico'
import DocumentViewerModal from '@/modules/proformas/components/DocumentViewerModal.vue'
import { downloadBlob } from '@/shared/download/downloadBlob'
import { buildExportFilename } from '@/shared/download/exportFilename'
import { galleryService, type GalleryImage } from '@/shared/media/gallery'
import { usePdfDocument } from '@/shared/pdf/usePdfDocument'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import DetailTabs from '@/shared/ui/DetailTabs.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import Modal from '@/shared/ui/Modal.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import StatusBadge from '@/shared/ui/StatusBadge.vue'
import TextField from '@/shared/ui/TextField.vue'
import Toast from '@/shared/ui/Toast.vue'
import WorkshopImageViewer from '../components/WorkshopImageViewer.vue'
import { ordenesTrabajoService } from '../services/ordenesTrabajoService'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const canOperateCommercial = computed(() => session.can('comercial.operar'))
const id = Number(route.params.id)

const item = ref<OrdenTrabajo | null>(null)
const loading = ref(true)
const downloading = ref(false)
const previewModalOpen = ref(false)
const activeTab = ref<'trabajo' | 'planificacion'>('trabajo')
const readyModalOpen = ref(false)
const markingReady = ref(false)
const planModalOpen = ref(false)
const savingPlan = ref(false)
const planError = ref('')
const planForm = ref({
  fecha_inicio: '',
  fecha_fin: '',
  fecha_entrega: '',
  lugar_entrega: '',
  responsable_recepcion: '',
})
const furnitureGalleries = ref<Record<number, GalleryImage[]>>({})
const catalogProducts = ref<Record<number, Producto>>({})
const catalogGalleries = ref<Record<number, GalleryImage[]>>({})
const catalogOptions = ref<Record<string, ValorCatalogoPublico[]>>({})
const error = ref('')
const notice = ref('')

const {
  blob: documentBlob,
  url: documentUrl,
  loading: documentLoading,
  error: documentError,
  load: loadDocument,
  clear: clearDocument,
} = usePdfDocument((orderId) => ordenesTrabajoService.documentPdf(orderId))

function formatDateLabel(value: string | null | undefined): string | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`)
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('es-BO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date)
    }
  }
  return value
}

function formatQuantity(value: string | number): string {
  const text = String(value).trim()
  if (/^\d+\.0+$/.test(text)) return text.split('.')[0] ?? text
  return text
}

function workOrderTone(code: string): 'info' | 'warning' | 'success' | 'danger' | 'neutral' {
  const normalized = code.toUpperCase()
  if (normalized.includes('CANCEL') || normalized.includes('ANUL')) return 'danger'
  if (
    normalized.includes('ENTREGAD') ||
    normalized.includes('FINALIZAD') ||
    normalized.includes('LISTO')
  ) {
    return 'success'
  }
  if (
    normalized.includes('PRODUCCION') ||
    normalized.includes('TALLER') ||
    normalized.includes('PROCESO')
  ) {
    return 'warning'
  }
  if (normalized.includes('PENDIENTE')) return 'info'
  return 'neutral'
}

interface PieceGroup {
  id: string
  nombre: string | null
  piezas: ComponenteTecnico[]
}

interface ParsedSpec {
  medidas: Array<{ label: string; value: string }>
  gruposPiezas: PieceGroup[]
  advertencias: string[]
  accesorios: string[]
  generalSpecs: Array<{ label: string; value: string }>
  observaciones: string | null
}

function formatMeasureLabel(key: string): string {
  const clean = key.replace(/_/g, ' ').trim()
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : key
}

function parseSpecification(line: DetalleOrdenTrabajo): ParsedSpec | null {
  if (!line.especificacion) return null
  const datos = (line.especificacion.datos_tecnicos ?? {}) as DatosTecnicos
  const componentes = Array.isArray(datos.componentes) ? datos.componentes : []
  const conjuntos = Array.isArray(datos.conjuntos) ? (datos.conjuntos as ConjuntoTecnico[]) : []
  const advertencias = Array.isArray(datos.advertencias)
    ? datos.advertencias.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : []
  const accesorios = Array.isArray(datos.accesorios)
    ? datos.accesorios.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : []

  const medidas: Array<{ label: string; value: string }> = []
  const generalSpecs: Array<{ label: string; value: string }> = []
  const gen = datos.caracteristicas_generales
  if (gen && typeof gen === 'object' && !Array.isArray(gen)) {
    const dims = gen.dimensiones
    if (dims && typeof dims === 'object' && !Array.isArray(dims)) {
      for (const [dimKey, dimVal] of Object.entries(dims as Record<string, unknown>)) {
        if (dimVal && typeof dimVal === 'object' && !Array.isArray(dimVal)) {
          const obj = dimVal as Record<string, unknown>
          const valor =
            obj.valor !== undefined && obj.valor !== null ? String(obj.valor).trim() : ''
          const unidad =
            obj.unidad !== undefined && obj.unidad !== null ? String(obj.unidad).trim() : ''
          if (valor) {
            medidas.push({
              label: formatMeasureLabel(dimKey),
              value: unidad ? `${valor} ${unidad}` : valor,
            })
          }
        } else if (dimVal !== null && dimVal !== undefined && String(dimVal).trim() !== '') {
          medidas.push({
            label: formatMeasureLabel(dimKey),
            value: String(dimVal).trim(),
          })
        }
      }
    }

    for (const [key, val] of Object.entries(gen)) {
      if (key === 'dimensiones') continue
      if (key === 'atributos' && Array.isArray(val)) {
        for (const attr of val as AtributoTecnico[]) {
          if (attr?.nombre && attr?.valor) {
            generalSpecs.push({
              label: attr.nombre,
              value: attr.unidad ? `${attr.valor} ${attr.unidad}` : String(attr.valor),
            })
          }
        }
      } else if (
        val !== null &&
        val !== undefined &&
        String(val).trim() !== '' &&
        typeof val !== 'object'
      ) {
        generalSpecs.push({
          label: formatMeasureLabel(key),
          value: String(val),
        })
      }
    }
  }

  const gruposPiezas: PieceGroup[] = []
  if (conjuntos.length) {
    for (const conj of conjuntos) {
      const piezas = componentes.filter((c) => c.conjunto_uid === conj.uid)
      if (piezas.length) {
        gruposPiezas.push({ id: conj.uid, nombre: conj.nombre, piezas })
      }
    }
    const sinGrupo = componentes.filter(
      (c) => !c.conjunto_uid || !conjuntos.some((conj) => conj.uid === c.conjunto_uid),
    )
    if (sinGrupo.length) {
      gruposPiezas.push({ id: 'otros', nombre: 'Otros componentes', piezas: sinGrupo })
    }
  } else if (componentes.length) {
    gruposPiezas.push({ id: 'all', nombre: null, piezas: componentes })
  }

  return {
    medidas,
    gruposPiezas,
    advertencias,
    accesorios,
    generalSpecs,
    observaciones: line.especificacion.observaciones ?? null,
  }
}

function componentAttributes(comp: ComponenteTecnico): Array<{ label: string; value: string }> {
  const attrs: Array<{ label: string; value: string }> = []
  if (comp.material) attrs.push({ label: 'Material', value: comp.material })
  if (comp.color) attrs.push({ label: 'Color', value: comp.color })
  if (comp.espesor) attrs.push({ label: 'Espesor', value: comp.espesor })
  if (comp.dimensiones) attrs.push({ label: 'Dimensiones', value: comp.dimensiones })
  if (comp.acabado) attrs.push({ label: 'Acabado', value: comp.acabado })
  if (Array.isArray(comp.atributos)) {
    for (const attr of comp.atributos) {
      if (attr?.nombre && attr?.valor) {
        attrs.push({
          label: attr.nombre,
          value: attr.unidad ? `${attr.valor} ${attr.unidad}` : String(attr.valor),
        })
      }
    }
  }
  return attrs
}

async function ensureFurnitureGalleries(lines: DetalleOrdenTrabajo[]) {
  const customLines = lines.filter(
    (line) => line.tipo_item_info.codigo === 'MUEBLE_MEDIDA' && !furnitureGalleries.value[line.id],
  )
  await Promise.allSettled(
    customLines.map(async (line) => {
      try {
        const res = await galleryService.list(`/api/v1/imagenes-privadas/?detalle=${line.id}`)
        furnitureGalleries.value = {
          ...furnitureGalleries.value,
          [line.id]: res.imagenes ?? [],
        }
      } catch {
        // Sin permisos o sin imágenes registradas
      }
    }),
  )
}

function hasImages(lineId: number): boolean {
  return (furnitureGalleries.value[lineId] ?? []).length > 0
}

function catalogImages(productId: number | null | undefined): GalleryImage[] {
  if (!productId) return []
  return catalogGalleries.value[productId] ?? []
}

function resolveCatalogOption(
  conceptCode: string,
  optionId: number | null | undefined,
): string | null {
  if (optionId == null) return null
  return (
    catalogOptions.value[conceptCode]?.find((item) => item.id === optionId)?.nombre ??
    `#${optionId}`
  )
}

function formatCatalogAttrLabel(key: string): string {
  const known: Record<string, string> = {
    tapizado: 'Tapizado',
    resistencia: 'Resistencia',
    configuracion: 'Configuración',
    brazos: 'Brazos',
    altura: 'Altura',
    base: 'Base',
    ruedas: 'Ruedas',
    mecanismo: 'Mecanismo',
    material: 'Material',
    color: 'Color',
    acabado: 'Acabado',
  }
  return (
    known[key] ??
    key.replace(/[_-]+/g, ' ').replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('es'))
  )
}

function flattenCatalogSpecs(value: unknown, prefix = ''): Array<{ label: string; value: string }> {
  if (value === null || value === undefined || value === '') return []
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [{ label: prefix ? formatCatalogAttrLabel(prefix) : 'Detalle', value: String(value) }]
  }
  if (Array.isArray(value)) {
    return value.flatMap((child, index) =>
      flattenCatalogSpecs(child, `${prefix || 'Ítem'} ${index + 1}`),
    )
  }
  if (typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenCatalogSpecs(child, key),
  )
}

interface CatalogParsedSpec {
  categoryLabel: string
  sku: string | null
  familia: string | null
  modelo: string | null
  medidas: Array<{ label: string; value: string }>
  generalSpecs: Array<{ label: string; value: string }>
  componenteSpecs: Array<{ label: string; value: string }>
  observaciones: string | null
}

function parseCatalogSpecification(
  prod: Producto | undefined,
  line: DetalleOrdenTrabajo,
): CatalogParsedSpec {
  if (!prod) {
    return {
      categoryLabel: line.tipo_item_info.nombre,
      sku: null,
      familia: null,
      modelo: null,
      medidas: [],
      generalSpecs: [{ label: 'Categoría', value: line.tipo_item_info.nombre }],
      componenteSpecs: [],
      observaciones: null,
    }
  }
  const catCode = prod.categoria_info?.codigo ?? ''
  const medidas: Array<{ label: string; value: string }> = []
  const generalSpecs: Array<{ label: string; value: string }> = []
  if (prod.sku) generalSpecs.push({ label: 'SKU', value: prod.sku })
  if (prod.familia_info?.nombre)
    generalSpecs.push({ label: 'Familia', value: prod.familia_info.nombre })

  let modelo: string | null = null
  let componenteSpecs: Array<{ label: string; value: string }> = []

  if (catCode === 'PISO_FLOTANTE' && prod.piso) {
    if (prod.piso.espesor_mm)
      medidas.push({ label: 'Espesor', value: `${prod.piso.espesor_mm} mm` })
    if (prod.piso.ancho_mm) medidas.push({ label: 'Ancho', value: `${prod.piso.ancho_mm} mm` })
    if (prod.piso.largo_mm) medidas.push({ label: 'Largo', value: `${prod.piso.largo_mm} mm` })
    if (prod.piso.m2_por_caja) {
      medidas.push({ label: 'Rendimiento por caja', value: `${prod.piso.m2_por_caja} m²` })
    }
    const marca = resolveCatalogOption('MARCA', prod.piso.marca)
    const tipo = resolveCatalogOption('TIPO_PISO', prod.piso.tipo)
    const material = resolveCatalogOption('MATERIAL_PISO', prod.piso.material)
    const diseno = resolveCatalogOption('DISENO_PISO', prod.piso.diseno)
    const acabado = resolveCatalogOption('ACABADO_PISO', prod.piso.acabado)
    modelo = prod.piso.modelo?.trim() || null
    if (marca) generalSpecs.push({ label: 'Marca', value: marca })
    if (modelo) generalSpecs.push({ label: 'Modelo', value: modelo })
    if (tipo) generalSpecs.push({ label: 'Tipo', value: tipo })
    if (material) generalSpecs.push({ label: 'Material', value: material })
    if (diseno) generalSpecs.push({ label: 'Diseño', value: diseno })
    if (acabado) generalSpecs.push({ label: 'Acabado', value: acabado })
  } else if (catCode === 'SILLA' && prod.silla) {
    const marca = resolveCatalogOption('MARCA', prod.silla.marca)
    const color1 = resolveCatalogOption('COLOR', prod.silla.color_primario)
    const color2 = resolveCatalogOption('COLOR', prod.silla.color_secundario)
    modelo = prod.silla.modelo?.trim() || null
    if (marca) generalSpecs.push({ label: 'Marca', value: marca })
    if (modelo) generalSpecs.push({ label: 'Modelo', value: modelo })
    if (color1) generalSpecs.push({ label: 'Color primario', value: color1 })
    if (color2) generalSpecs.push({ label: 'Color secundario', value: color2 })
    componenteSpecs = flattenCatalogSpecs(prod.silla.especificaciones)
  } else {
    if (prod.categoria_info?.nombre) {
      generalSpecs.push({ label: 'Categoría', value: prod.categoria_info.nombre })
    }
    if (prod.unidad_stock_info?.nombre) {
      generalSpecs.push({ label: 'Unidad de stock', value: prod.unidad_stock_info.nombre })
    }
  }

  return {
    categoryLabel: prod.categoria_info?.nombre ?? line.tipo_item_info.nombre,
    sku: prod.sku ?? null,
    familia: prod.familia_info?.nombre ?? null,
    modelo,
    medidas,
    generalSpecs,
    componenteSpecs,
    observaciones: prod.observaciones?.trim() || null,
  }
}

function fallbackProductGallery(prod: Producto): GalleryImage[] {
  if (!prod.imagen_principal?.original) return []
  return [
    {
      id: prod.id,
      nombre: prod.nombre,
      url: prod.imagen_principal.original,
      posicion: 0,
      principal: true,
      variantes: prod.imagen_principal.variantes ?? {},
    },
  ]
}

async function ensureCatalogDetails(lines: DetalleOrdenTrabajo[]) {
  if (!canOperateCommercial.value) return
  const productIds = Array.from(
    new Set(
      lines
        .filter(
          (line) =>
            line.tipo_item_info.codigo !== 'MUEBLE_MEDIDA' &&
            !line.especificacion &&
            typeof line.producto === 'number',
        )
        .map((line) => line.producto as number),
    ),
  )
  if (!productIds.length) return

  type ConceptCode = Parameters<typeof proformasService.options>[0]
  const neededConcepts: ConceptCode[] = [
    'MARCA',
    'COLOR',
    'TIPO_PISO',
    'MATERIAL_PISO',
    'DISENO_PISO',
    'ACABADO_PISO',
  ]
  const missingConcepts = neededConcepts.filter((code) => !catalogOptions.value[code])

  await Promise.allSettled([
    ...missingConcepts.map(async (code) => {
      try {
        const list = await proformasService.options(code)
        catalogOptions.value = { ...catalogOptions.value, [code]: list }
      } catch {
        // Ignorar si no está disponible
      }
    }),
    ...productIds.map(async (prodId) => {
      if (!catalogProducts.value[prodId]) {
        try {
          const prod = await productosService.get(prodId)
          catalogProducts.value = { ...catalogProducts.value, [prodId]: prod }
          if (!catalogGalleries.value[prodId]) {
            try {
              const gal = await galleryService.list(
                `/api/v1/catalogo/productos/${prodId}/imagenes/`,
              )
              const imgs = gal.imagenes ?? []
              if (imgs.length > 0) {
                catalogGalleries.value = { ...catalogGalleries.value, [prodId]: imgs }
              } else {
                const fallback = fallbackProductGallery(prod)
                if (fallback.length) {
                  catalogGalleries.value = { ...catalogGalleries.value, [prodId]: fallback }
                }
              }
            } catch {
              const fallback = fallbackProductGallery(prod)
              if (fallback.length) {
                catalogGalleries.value = { ...catalogGalleries.value, [prodId]: fallback }
              }
            }
          }
        } catch {
          // Degrada limpiamente si no se puede leer el producto
        }
      }
    }),
  ])
}

function openPlanModal() {
  if (!item.value) return
  planError.value = ''
  planForm.value = {
    fecha_inicio: item.value.fecha_inicio ?? '',
    fecha_fin: item.value.fecha_fin ?? '',
    fecha_entrega: item.value.fecha_entrega ?? '',
    lugar_entrega: item.value.lugar_entrega ?? '',
    responsable_recepcion: item.value.responsable_recepcion ?? '',
  }
  planModalOpen.value = true
}

async function savePlanificacion() {
  if (!item.value || savingPlan.value) return
  planError.value = ''
  if (
    planForm.value.fecha_inicio &&
    planForm.value.fecha_fin &&
    planForm.value.fecha_fin < planForm.value.fecha_inicio
  ) {
    planError.value = 'La fecha de fin de fabricación no puede ser anterior al inicio.'
    return
  }
  savingPlan.value = true
  try {
    item.value = await ordenesTrabajoService.updatePlanificacion(item.value.id, {
      fecha_inicio: planForm.value.fecha_inicio || null,
      fecha_fin: planForm.value.fecha_fin || null,
      fecha_entrega: planForm.value.fecha_entrega || null,
      lugar_entrega: planForm.value.lugar_entrega.trim() || null,
      responsable_recepcion: planForm.value.responsable_recepcion.trim() || null,
    })
    planModalOpen.value = false
    notice.value = 'Planificación y logística actualizada.'
  } catch (cause) {
    planError.value =
      cause instanceof Error ? cause.message : 'No se pudo actualizar la planificación.'
  } finally {
    savingPlan.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const loaded = await ordenesTrabajoService.get(id)
    item.value = loaded
    void ensureFurnitureGalleries(loaded.detalles ?? [])
    void ensureCatalogDetails(loaded.detalles ?? [])
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la orden.'
  } finally {
    loading.value = false
  }
}

const canChangeWorkOrderState = computed(() => {
  if (!item.value) return false
  if (typeof item.value.puede_cambiar_estado === 'boolean') {
    return item.value.puede_cambiar_estado
  }
  return session.can('taller.operar') && !session.can('comercial.operar')
})

const changingState = ref(false)

async function changeWorkOrderState(estadoCodigo: 'EN_PROCESO' | 'TERMINADA') {
  if (!item.value || changingState.value || !canChangeWorkOrderState.value) return
  changingState.value = true
  error.value = ''
  try {
    item.value = await ordenesTrabajoService.cambiarEstado(item.value.id, {
      estado_codigo: estadoCodigo,
    })
    notice.value =
      estadoCodigo === 'EN_PROCESO'
        ? 'Orden de trabajo iniciada en taller.'
        : 'Orden de trabajo marcada como terminada.'
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'No se pudo actualizar el estado de la orden.'
  } finally {
    changingState.value = false
  }
}

const canMarkReady = computed(() => {
  if (!item.value) return false
  const otCode = item.value.estado_info.codigo.toUpperCase()
  const pedCode = (item.value.pedido_estado_codigo ?? '').toUpperCase()
  if (['LISTO_ENTREGA', 'ENTREGADO', 'CANCELADO'].includes(pedCode)) return false
  if (otCode === 'TERMINADA') return true
  return detailRows.value.length === 0 && otCode !== 'CANCELADA'
})

async function confirmMarkReady() {
  if (!item.value || markingReady.value) return
  markingReady.value = true
  error.value = ''
  try {
    item.value = await ordenesTrabajoService.marcarListoEntrega(item.value.id)
    readyModalOpen.value = false
    notice.value =
      'Pedido marcado como listo para entrega. Nota de entrega emitida automáticamente.'
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : 'No se pudo marcar el pedido como listo para entrega.'
    readyModalOpen.value = false
  } finally {
    markingReady.value = false
  }
}

function openPdfViewer() {
  if (!item.value) return
  previewModalOpen.value = true
  void loadDocument(item.value.id)
}

function closePdfViewer() {
  previewModalOpen.value = false
  clearDocument()
}

async function downloadDocument() {
  if (!item.value || downloading.value) return
  downloading.value = true
  error.value = ''
  const opened = previewModalOpen.value
  try {
    const file = (opened && documentBlob.value) || (await loadDocument(id))
    if (!file) {
      if (!opened) error.value = documentError.value || 'No se pudo obtener el PDF.'
      return
    }
    downloadBlob(
      file,
      buildExportFilename(
        'orden-trabajo',
        [
          item.value.numero,
          `pedido-${item.value.pedido}`,
          item.value.cliente_resumen?.nombre || item.value.cliente_resumen?.empresa,
        ],
        'pdf',
      ),
    )
    notice.value = 'Documento PDF de orden de trabajo descargado.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo descargar la orden.'
  } finally {
    downloading.value = false
    if (!opened) clearDocument()
  }
}

onMounted(load)

const detailRows = computed(() =>
  (item.value?.detalles ?? [])
    .filter(
      (line) => line.tipo_item_info.codigo === 'MUEBLE_MEDIDA' || Boolean(line.especificacion),
    )
    .map((line) => {
      const spec = parseSpecification(line)
      return {
        ...line,
        unidadLabel: line.unidad_info.nombre,
        tipoItemLabel: line.tipo_item_info.nombre,
        tipoMuebleLabel: line.especificacion?.tipo_mueble_info?.nombre ?? null,
        isFabrication: true,
        spec,
      }
    }),
)

const catalogRows = computed(() =>
  (item.value?.detalles ?? [])
    .filter((line) => line.tipo_item_info.codigo !== 'MUEBLE_MEDIDA' && !line.especificacion)
    .map((line) => {
      const prod =
        typeof line.producto === 'number' ? catalogProducts.value[line.producto] : undefined
      return {
        ...line,
        unidadLabel: line.unidad_info.nombre,
        tipoItemLabel: line.tipo_item_info.nombre,
        catalogSpec: parseCatalogSpecification(prod, line),
      }
    }),
)

const totalVisibleItems = computed(() =>
  canOperateCommercial.value
    ? detailRows.value.length + catalogRows.value.length
    : detailRows.value.length,
)

const clientSummaryLabel = computed(() => {
  const client = item.value?.cliente_resumen
  if (!client) return ''
  return client.empresa?.trim() || client.nombre?.trim() || ''
})

const workOrderTabs = computed(() => [
  {
    id: 'trabajo',
    label: 'Detalle de trabajo',
    icon: Hammer,
    badge: totalVisibleItems.value,
  },
  {
    id: 'planificacion',
    label: 'Planificación y logística',
    icon: Calendar,
  },
])
</script>

<template>
  <div class="ot-detail">
    <Toast :visible="Boolean(notice)" :message="notice" tone="success" @close="notice = ''" />

    <div class="ot-topline" aria-label="Ubicación en el proceso">
      <span>
        OPERACIONES <span class="ot-divider">/</span> ÓRDENES DE TRABAJO
        <span class="ot-divider">/</span> OT #{{ item?.numero ?? id }}
      </span>
      <div
        v-if="item"
        class="ot-status-pill"
        :class="`ot-status-pill--${workOrderTone(item.estado_info.codigo)}`"
      >
        <Hammer :size="14" aria-hidden="true" />
        <span>{{ item.estado_info.nombre }}</span>
      </div>
    </div>

    <PageHeader
      :title="`Orden de trabajo #${item?.numero ?? id}`"
      description="Hoja técnica de fabricación, preparación de catálogo y logística de entrega."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button variant="secondary" @click="router.push('/ordenes-trabajo')">
          <ArrowLeft :size="17" aria-hidden="true" /> Volver
        </Button>
        <Button v-if="item" variant="secondary" @click="openPdfViewer">
          <FileText :size="17" aria-hidden="true" />
          Ver PDF
        </Button>
        <Button v-if="item" variant="secondary" :processing="downloading" @click="downloadDocument">
          <Download :size="17" aria-hidden="true" />
          Descargar PDF
        </Button>
        <Button
          v-if="canChangeWorkOrderState && item?.estado_info.codigo === 'PENDIENTE'"
          variant="secondary"
          :disabled="changingState"
          @click="changeWorkOrderState('EN_PROCESO')"
        >
          <Wrench :size="17" aria-hidden="true" />
          Iniciar producción
        </Button>
        <Button
          v-if="canChangeWorkOrderState && item?.estado_info.codigo === 'EN_PROCESO'"
          variant="secondary"
          :disabled="changingState"
          @click="changeWorkOrderState('TERMINADA')"
        >
          <Check :size="17" aria-hidden="true" />
          Terminar OT
        </Button>
        <Button
          v-if="canMarkReady"
          variant="primary"
          :disabled="markingReady"
          @click="readyModalOpen = true"
        >
          <PackageCheck :size="17" aria-hidden="true" />
          Listo para entrega
        </Button>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="loading" :lines="7" />
    <ErrorState v-else-if="error && !item" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <template v-else-if="item">
      <div v-if="error" class="notice notice--error" role="alert">{{ error }}</div>

      <section class="summary summary--taller" aria-label="Resumen de la orden de trabajo">
        <div class="stat">
          <span class="stat__icon">
            <FileText :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Origen comercial</span>
            <RouterLink
              v-if="canOperateCommercial"
              :to="`/pedidos/${item.pedido}`"
              class="stat__link"
            >
              Pedido #{{ item.pedido }}
            </RouterLink>
            <strong v-else class="stat__value">Pedido #{{ item.pedido }}</strong>
            <small>
              Proforma #{{ item.proforma_numero
              }}<template v-if="clientSummaryLabel"> · {{ clientSummaryLabel }}</template>
            </small>
          </div>
        </div>

        <div class="stat">
          <span class="stat__icon stat__icon--warning">
            <Hammer :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Estado de taller</span>
            <div>
              <StatusBadge :status="item.estado_info.codigo" :label="item.estado_info.nombre" />
            </div>
            <small>
              <template v-if="canOperateCommercial && catalogRows.length && detailRows.length">
                {{ detailRows.length }} a medida · {{ catalogRows.length }} catálogo
              </template>
              <template v-else-if="canOperateCommercial && catalogRows.length">
                {{ catalogRows.length }}
                {{ catalogRows.length === 1 ? 'producto de catálogo' : 'productos de catálogo' }}
              </template>
              <template v-else>
                {{ detailRows.length }}
                {{ detailRows.length === 1 ? 'mueble a medida' : 'muebles a medida' }}
              </template>
            </small>
          </div>
        </div>

        <div class="stat">
          <span class="stat__icon">
            <Truck :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Entrega prevista</span>
            <strong class="stat__value">
              {{ formatDateLabel(item.fecha_entrega) ?? 'Sin definir' }}
            </strong>
            <small :title="item.lugar_entrega ?? 'Lugar sin definir'">
              {{ item.lugar_entrega ?? 'Lugar sin definir' }}
            </small>
          </div>
        </div>
      </section>

      <section
        v-if="item.historial_estados?.length"
        class="ot-timeline"
        aria-label="Historial de estados"
        data-testid="ot-state-timeline"
      >
        <div class="ot-timeline__header">
          <Clock3 :size="16" aria-hidden="true" />
          <h3>Historial de estados</h3>
        </div>
        <ol class="ot-timeline__list">
          <li v-for="entry in item.historial_estados" :key="entry.id" class="ot-timeline__item">
            <span class="ot-timeline__dot" aria-hidden="true" />
            <div class="ot-timeline__content">
              <div class="ot-timeline__title">
                <StatusBadge
                  :status="entry.estado_nuevo_info.codigo"
                  :label="entry.estado_nuevo_info.nombre"
                />
                <span v-if="entry.estado_anterior_info" class="ot-timeline__prev">
                  desde {{ entry.estado_anterior_info.nombre }}
                </span>
              </div>
              <small class="ot-timeline__meta">
                {{ formatDateLabel(entry.fecha) ?? entry.fecha }}
                <template v-if="entry.cambiado_por_resumen?.display_name">
                  · {{ entry.cambiado_por_resumen.display_name }}
                </template>
                <template v-if="entry.observaciones"> · {{ entry.observaciones }}</template>
              </small>
            </div>
          </li>
        </ol>
      </section>

      <DetailTabs
        :model-value="activeTab"
        :tabs="workOrderTabs"
        aria-label="Apartados de la orden de trabajo"
        @update:model-value="activeTab = $event as 'trabajo' | 'planificacion'"
      />

      <section
        v-show="activeTab === 'trabajo'"
        class="work-lines"
        role="tabpanel"
        aria-labelledby="ot-details-title"
      >
        <div class="section-heading">
          <div class="section-heading__identity">
            <span class="section-icon">
              <ClipboardCheck :size="18" aria-hidden="true" />
            </span>
            <div>
              <h2 id="ot-details-title">Detalle de trabajo</h2>
              <p>Especificaciones técnicas, medidas, piezas y referencias de fabricación.</p>
            </div>
          </div>
          <span class="counter">
            {{ totalVisibleItems }}
            {{ totalVisibleItems === 1 ? 'ítem' : 'ítems' }}
          </span>
        </div>

        <EmptyState
          v-if="!detailRows.length && (!canOperateCommercial || !catalogRows.length)"
          title="Sin ítems registrados"
          description="Esta orden no contiene ítems para visualizar."
        />

        <article
          v-for="(line, index) in detailRows"
          :key="line.id"
          class="work-line work-line--fabrication"
        >
          <div class="work-line__main">
            <div class="work-line__text">
              <div class="work-line__badges">
                <span class="work-line__index">{{ String(index + 1).padStart(2, '0') }}</span>
                <Badge tone="warning">
                  <Hammer :size="12" aria-hidden="true" />
                  Mueble a medida
                </Badge>
                <span v-if="line.tipoMuebleLabel" class="work-type-tag">
                  <Tag :size="12" aria-hidden="true" />
                  {{ line.tipoMuebleLabel }}
                </span>
              </div>
              <h3 class="work-line__title">{{ line.nombre }}</h3>
              <p v-if="line.descripcion" class="work-line__desc">{{ line.descripcion }}</p>
            </div>

            <div class="work-line__qty">
              <strong>{{ formatQuantity(line.cantidad) }}</strong>
              <span>{{ line.unidadLabel }}</span>
            </div>
          </div>

          <div v-if="line.spec" class="workshop-body">
            <div class="workshop-grid" :class="{ 'workshop-grid--full': !hasImages(line.id) }">
              <div class="workshop-specs">
                <div v-if="line.spec.advertencias.length" class="ficha-alerts" role="note">
                  <AlertTriangle :size="16" aria-hidden="true" />
                  <div>
                    <strong>Advertencias de taller</strong>
                    <ul>
                      <li v-for="(adv, i) in line.spec.advertencias" :key="i">{{ adv }}</li>
                    </ul>
                  </div>
                </div>

                <div v-if="line.spec.medidas.length" class="spec-section spec-section--measures">
                  <h4><Ruler :size="15" aria-hidden="true" /> Medidas generales</h4>
                  <dl class="measures-grid">
                    <div v-for="(medida, idx) in line.spec.medidas" :key="idx" class="measure-chip">
                      <dt>{{ medida.label }}</dt>
                      <dd>{{ medida.value }}</dd>
                    </div>
                  </dl>
                </div>

                <div
                  v-if="line.spec.generalSpecs.length"
                  class="spec-section spec-section--general"
                >
                  <h4>
                    <SlidersHorizontal :size="15" aria-hidden="true" /> Características generales
                  </h4>
                  <dl class="ficha-kv-grid">
                    <div v-for="(specItem, idx) in line.spec.generalSpecs" :key="idx">
                      <dt>{{ specItem.label }}</dt>
                      <dd>{{ specItem.value }}</dd>
                    </div>
                  </dl>
                </div>

                <div
                  v-if="line.spec.gruposPiezas.length"
                  class="spec-section spec-section--components"
                >
                  <h4><Layers :size="15" aria-hidden="true" /> Piezas y componentes</h4>
                  <div v-for="grupo in line.spec.gruposPiezas" :key="grupo.id" class="piece-group">
                    <p v-if="grupo.nombre" class="piece-group__title">{{ grupo.nombre }}</p>
                    <div class="components-grid">
                      <div
                        v-for="(comp, idx) in grupo.piezas"
                        :key="comp.uid || idx"
                        class="component-card"
                      >
                        <div class="component-card__head">
                          <strong>{{ comp.nombre }}</strong>
                          <span v-if="comp.cantidad_interna" class="component-card__qty">
                            × {{ comp.cantidad_interna }}
                          </span>
                        </div>
                        <dl v-if="componentAttributes(comp).length" class="component-card__attrs">
                          <div v-for="(attr, aIdx) in componentAttributes(comp)" :key="aIdx">
                            <dt>{{ attr.label }}</dt>
                            <dd>{{ attr.value }}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  v-if="line.spec.accesorios.length"
                  class="spec-section spec-section--accessories"
                >
                  <h4><Wrench :size="15" aria-hidden="true" /> Accesorios y herrajes</h4>
                  <div class="accessories-list">
                    <span v-for="(acc, aIdx) in line.spec.accesorios" :key="aIdx" class="acc-chip">
                      {{ acc }}
                    </span>
                  </div>
                </div>

                <div v-if="line.spec.observaciones" class="ficha-notes">
                  <StickyNote :size="16" aria-hidden="true" />
                  <div>
                    <strong>Observaciones técnicas</strong>
                    <p>{{ line.spec.observaciones }}</p>
                  </div>
                </div>
              </div>

              <div v-if="hasImages(line.id)" class="workshop-media">
                <WorkshopImageViewer
                  :images="furnitureGalleries[line.id]!"
                  title="Referencias visuales"
                />
              </div>
            </div>
          </div>

          <div v-else class="work-line__catalog-tag">
            <Hammer :size="15" aria-hidden="true" />
            <span>Mueble a medida · Ficha técnica reservada a taller</span>
          </div>
        </article>

        <!-- Productos de catálogo con ficha completa (Admin y Encargado de tienda) -->
        <template v-if="canOperateCommercial && catalogRows.length">
          <article
            v-for="(cat, catIdx) in catalogRows"
            :key="cat.id"
            class="work-line work-line--fabrication"
          >
            <div class="work-line__main">
              <div class="work-line__text">
                <div class="work-line__badges">
                  <span class="work-line__index">
                    {{ String(detailRows.length + catIdx + 1).padStart(2, '0') }}
                  </span>
                  <Badge tone="info">
                    <Package :size="12" aria-hidden="true" />
                    {{ cat.catalogSpec.categoryLabel }}
                  </Badge>
                  <span v-if="cat.catalogSpec.sku" class="work-type-tag">
                    <Tag :size="12" aria-hidden="true" />
                    {{ cat.catalogSpec.sku }}
                  </span>
                </div>
                <h3 class="work-line__title">{{ cat.nombre }}</h3>
                <p v-if="cat.catalogSpec.modelo" class="work-line__desc">
                  Modelo: {{ cat.catalogSpec.modelo }}
                </p>
              </div>

              <div class="work-line__qty">
                <strong>{{ formatQuantity(cat.cantidad) }}</strong>
                <span>{{ cat.unidadLabel }}</span>
              </div>
            </div>

            <div class="workshop-body">
              <div
                class="workshop-grid"
                :class="{ 'workshop-grid--full': !catalogImages(cat.producto).length }"
              >
                <div class="workshop-specs">
                  <div
                    v-if="cat.catalogSpec.medidas.length"
                    class="spec-section spec-section--measures"
                  >
                    <h4><Ruler :size="15" aria-hidden="true" /> Medidas y rendimiento</h4>
                    <dl class="measures-grid">
                      <div
                        v-for="(medida, mIdx) in cat.catalogSpec.medidas"
                        :key="mIdx"
                        class="measure-chip"
                      >
                        <dt>{{ medida.label }}</dt>
                        <dd>{{ medida.value }}</dd>
                      </div>
                    </dl>
                  </div>

                  <div
                    v-if="cat.catalogSpec.generalSpecs.length"
                    class="spec-section spec-section--general"
                  >
                    <h4>
                      <SlidersHorizontal :size="15" aria-hidden="true" /> Características generales
                    </h4>
                    <dl class="ficha-kv-grid">
                      <div v-for="(specItem, gIdx) in cat.catalogSpec.generalSpecs" :key="gIdx">
                        <dt>{{ specItem.label }}</dt>
                        <dd>{{ specItem.value }}</dd>
                      </div>
                    </dl>
                  </div>

                  <div
                    v-if="cat.catalogSpec.componenteSpecs.length"
                    class="spec-section spec-section--components"
                  >
                    <h4><Layers :size="15" aria-hidden="true" /> Especificaciones del producto</h4>
                    <dl class="ficha-kv-grid">
                      <div v-for="(compSpec, cIdx) in cat.catalogSpec.componenteSpecs" :key="cIdx">
                        <dt>{{ compSpec.label }}</dt>
                        <dd>{{ compSpec.value }}</dd>
                      </div>
                    </dl>
                  </div>

                  <div v-if="cat.catalogSpec.observaciones" class="ficha-notes">
                    <StickyNote :size="16" aria-hidden="true" />
                    <div>
                      <strong>Observaciones técnicas</strong>
                      <p>{{ cat.catalogSpec.observaciones }}</p>
                    </div>
                  </div>
                </div>

                <div v-if="catalogImages(cat.producto).length" class="workshop-media">
                  <WorkshopImageViewer
                    :images="catalogImages(cat.producto)"
                    title="Imágenes del producto"
                  />
                </div>
              </div>
            </div>
          </article>
        </template>

        <!-- Vista superficial de catálogo para Jefe de Taller en pedidos mixtos -->
        <section
          v-else-if="!canOperateCommercial && catalogRows.length"
          class="catalog-ref-panel"
          aria-label="Productos de catálogo incluidos en el pedido"
        >
          <div class="catalog-ref-panel__head">
            <Package :size="16" aria-hidden="true" />
            <div>
              <h3>Productos de catálogo incluidos (referencia)</h3>
              <p>
                Ítems comerciales que acompañan este pedido; no requieren fabricación en taller.
              </p>
            </div>
          </div>
          <ul class="catalog-ref-list">
            <li v-for="cat in catalogRows" :key="cat.id" class="catalog-ref-item">
              <div class="catalog-ref-item__main">
                <Badge tone="neutral">{{ cat.tipoItemLabel }}</Badge>
                <strong>{{ cat.nombre }}</strong>
              </div>
              <span class="catalog-ref-item__qty">
                {{ formatQuantity(cat.cantidad) }} {{ cat.unidadLabel }}
              </span>
            </li>
          </ul>
        </section>
      </section>

      <section
        v-show="activeTab === 'planificacion'"
        class="panel"
        role="tabpanel"
        aria-labelledby="ot-logistics-title"
      >
        <div class="section-heading">
          <div class="section-heading__identity">
            <span class="section-icon">
              <Calendar :size="18" aria-hidden="true" />
            </span>
            <div>
              <h2 id="ot-logistics-title">Planificación y logística</h2>
              <p>Fechas operativas de taller y datos de recepción del pedido.</p>
            </div>
          </div>
          <Button variant="secondary" @click="openPlanModal">
            <Pencil :size="15" aria-hidden="true" />
            Editar planificación
          </Button>
        </div>

        <div class="ot-fields-grid">
          <div class="ot-field-card">
            <span class="ot-field-card__icon">
              <Calendar :size="17" aria-hidden="true" />
            </span>
            <div class="ot-field-card__body">
              <span class="ot-field-card__label">Fecha de emisión</span>
              <strong class="ot-field-card__value">
                {{ formatDateLabel(item.fecha) ?? item.fecha }}
              </strong>
            </div>
          </div>

          <div class="ot-field-card">
            <span class="ot-field-card__icon">
              <Clock3 :size="17" aria-hidden="true" />
            </span>
            <div class="ot-field-card__body">
              <span class="ot-field-card__label">Inicio de fabricación</span>
              <strong
                class="ot-field-card__value"
                :class="{ 'ot-field-card__value--muted': !item.fecha_inicio }"
              >
                {{ formatDateLabel(item.fecha_inicio) ?? 'Pendiente' }}
              </strong>
            </div>
          </div>

          <div class="ot-field-card">
            <span class="ot-field-card__icon">
              <Clock3 :size="17" aria-hidden="true" />
            </span>
            <div class="ot-field-card__body">
              <span class="ot-field-card__label">Fin de fabricación</span>
              <strong
                class="ot-field-card__value"
                :class="{ 'ot-field-card__value--muted': !item.fecha_fin }"
              >
                {{ formatDateLabel(item.fecha_fin) ?? 'Pendiente' }}
              </strong>
            </div>
          </div>

          <div class="ot-field-card">
            <span class="ot-field-card__icon">
              <MapPin :size="17" aria-hidden="true" />
            </span>
            <div class="ot-field-card__body">
              <span class="ot-field-card__label">Lugar de entrega</span>
              <strong
                class="ot-field-card__value"
                :class="{ 'ot-field-card__value--muted': !item.lugar_entrega }"
              >
                {{ item.lugar_entrega ?? 'Sin definir' }}
              </strong>
            </div>
          </div>

          <div class="ot-field-card ot-field-card--full">
            <span class="ot-field-card__icon">
              <UserCheck :size="17" aria-hidden="true" />
            </span>
            <div class="ot-field-card__body">
              <span class="ot-field-card__label">Responsable de recepción</span>
              <strong
                class="ot-field-card__value"
                :class="{ 'ot-field-card__value--muted': !item.responsable_recepcion }"
              >
                {{ item.responsable_recepcion ?? 'No asignado' }}
              </strong>
            </div>
          </div>
        </div>
      </section>
    </template>

    <Modal
      v-if="item"
      :open="readyModalOpen"
      wide
      title="Marcar pedido listo para entrega"
      :description="`El Pedido #${item.pedido} pasará a estado Listo para entrega.`"
      @close="readyModalOpen = false"
    >
      <template #title-icon>
        <span class="ot-modal-icon">
          <PackageCheck :size="20" aria-hidden="true" />
        </span>
      </template>
      <div class="ot-ready-board">
        <div class="ot-ready-metric">
          <span class="ot-ready-metric__icon"><Hammer :size="16" aria-hidden="true" /></span>
          <div>
            <span>Orden de trabajo</span>
            <strong>OT #{{ item.numero }}</strong>
          </div>
        </div>
        <div class="ot-ready-metric">
          <span class="ot-ready-metric__icon"><FileText :size="16" aria-hidden="true" /></span>
          <div>
            <span>Pedido vinculado</span>
            <strong>Pedido #{{ item.pedido }}</strong>
          </div>
        </div>
        <div class="ot-ready-metric">
          <span class="ot-ready-metric__icon ot-ready-metric__icon--info">
            <PackageCheck :size="16" aria-hidden="true" />
          </span>
          <div>
            <span>Nota de entrega</span>
            <strong>Emisión automática</strong>
          </div>
        </div>
      </div>
      <p class="ot-ready-note">
        Al confirmar que el trabajo de taller concluyó, la orden quedará marcada como terminada y se
        emitirá automáticamente la Nota de Entrega oficial del pedido para tienda.
      </p>
      <template #footer>
        <Button variant="secondary" :disabled="markingReady" @click="readyModalOpen = false">
          <X :size="16" aria-hidden="true" />
          Cancelar
        </Button>
        <Button variant="primary" :disabled="markingReady" @click="confirmMarkReady">
          <Check :size="16" aria-hidden="true" />
          {{ markingReady ? 'Confirmando...' : 'Confirmar listo para entrega' }}
        </Button>
      </template>
    </Modal>

    <Modal
      v-if="item"
      :open="planModalOpen"
      wide
      title="Editar planificación de taller"
      :description="`Actualiza las fechas de fabricación y datos de entrega para la OT #${item.numero}.`"
      @close="planModalOpen = false"
    >
      <template #title-icon>
        <span class="ot-modal-icon">
          <Calendar :size="20" aria-hidden="true" />
        </span>
      </template>
      <form id="ot-plan-form" class="ot-plan-form" @submit.prevent="savePlanificacion">
        <div class="ot-plan-grid">
          <TextField
            v-model="planForm.fecha_inicio"
            name="plan-fecha-inicio"
            label="Inicio de fabricación"
            type="date"
          />
          <TextField
            v-model="planForm.fecha_fin"
            name="plan-fecha-fin"
            label="Fin de fabricación"
            type="date"
          />
          <TextField
            v-model="planForm.fecha_entrega"
            name="plan-fecha-entrega"
            label="Entrega prevista"
            type="date"
          />
          <TextField
            v-model="planForm.responsable_recepcion"
            name="plan-responsable"
            label="Responsable de recepción"
            placeholder="Nombre de quien recibe"
          />
          <div class="ot-plan-grid__full">
            <TextField
              v-model="planForm.lugar_entrega"
              name="plan-lugar"
              label="Lugar de entrega"
              placeholder="Dirección o referencia de entrega"
            />
          </div>
        </div>
        <p v-if="planError" class="notice notice--error" role="alert">{{ planError }}</p>
      </form>
      <template #footer>
        <Button variant="secondary" :disabled="savingPlan" @click="planModalOpen = false">
          <X :size="16" aria-hidden="true" />
          Cancelar
        </Button>
        <Button type="submit" form="ot-plan-form" :disabled="savingPlan">
          <Check :size="16" aria-hidden="true" />
          {{ savingPlan ? 'Guardando...' : 'Guardar planificación' }}
        </Button>
      </template>
    </Modal>

    <DocumentViewerModal
      v-if="item"
      :open="previewModalOpen"
      :title="`Orden de trabajo #${item.numero}`"
      :subtitle="`Documento PDF · Tamaño Carta (216 × 279 mm) · ${item.estado_info.nombre}`"
      :downloading="downloading"
      :can-download-pdf="true"
      :pdf-url="documentUrl"
      :loading="documentLoading"
      :error="documentError"
      @close="closePdfViewer"
      @retry="loadDocument(item.id)"
      @download="downloadDocument"
    />
  </div>
</template>

<style scoped>
.ot-detail {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
  padding-bottom: var(--space-8);
}
.ot-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}
.ot-divider {
  margin: 0 0.45rem;
  opacity: 0.5;
}
.ot-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.72rem;
  letter-spacing: 0.02em;
}
.ot-status-pill--info {
  border-color: color-mix(in srgb, var(--color-info) 35%, var(--color-border));
  background: var(--color-info-soft);
  color: var(--color-info);
}
.ot-status-pill--warning {
  border-color: color-mix(in srgb, var(--color-warning) 35%, var(--color-border));
  background: var(--color-warning-soft);
  color: var(--color-warning);
}
.ot-status-pill--success {
  border-color: color-mix(in srgb, var(--color-success) 35%, var(--color-border));
  background: var(--color-success-soft);
  color: var(--color-success);
}
.ot-status-pill--danger {
  border-color: color-mix(in srgb, var(--color-danger) 35%, var(--color-border));
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
.notice {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  font-size: 0.9rem;
}
.notice--error {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
}
.stat,
.panel,
.work-line {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  min-width: 0;
}
.stat {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.stat__icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-radius: 0.75rem;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.stat__icon--warning {
  border-color: color-mix(in srgb, var(--color-warning) 25%, transparent);
  color: var(--color-warning);
  background: var(--color-warning-soft);
}
.stat__body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.stat__body > span {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
.stat__body > small {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat__value {
  font-size: 0.92rem;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.stat__link {
  color: var(--color-primary-accent);
  font-size: 0.95rem;
  font-weight: 700;
  text-decoration: none;
}
.stat__link:hover {
  text-decoration: underline;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.section-heading__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.section-icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-radius: 0.75rem;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.section-heading h2 {
  margin: 0;
  font-size: 1.12rem;
}
.section-heading p {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.counter {
  font-size: 0.82rem;
  font-weight: 650;
  color: var(--color-text-secondary);
}
.ot-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.ot-field-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
  min-width: 0;
}
.ot-field-card--full {
  grid-column: 1 / -1;
}
.ot-field-card__icon {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  flex: none;
  place-items: center;
  border-radius: 0.6rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}
.ot-field-card__body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.ot-field-card__label {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
}
.ot-field-card__value {
  font-size: 0.9rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.ot-field-card__value--muted {
  color: var(--color-text-secondary);
  font-weight: 500;
}
.work-lines {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}
.work-lines .section-heading {
  margin-bottom: var(--space-1);
}
.work-line {
  display: grid;
  gap: var(--space-3);
}
.work-line__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}
.work-line__identity {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  min-width: 0;
}
.work-line__thumb {
  width: 4rem;
  height: 4rem;
  flex: none;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
}
.work-line__thumb--icon {
  display: grid;
  place-items: center;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.work-line__thumb :deep(.product-image) {
  width: 100%;
  height: 100%;
  min-height: 0;
  aspect-ratio: 1 !important;
}
.work-line__thumb :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.work-line__thumb :deep(.fallback span) {
  display: none;
}
.work-line__text {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}
.work-line__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.work-line__meta small {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
}
.work-line__text h3 {
  margin: 0;
  font-size: 1rem;
  overflow-wrap: anywhere;
}
.work-line__desc {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}
.work-line__qty {
  display: grid;
  justify-items: end;
  flex: none;
  text-align: right;
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
}
.work-line__qty strong {
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}
.work-line__qty span {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.work-line__spec {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
}
.work-line__catalog-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
}
.ficha-ot {
  min-width: 0;
}
.ficha-ot__summary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
  color: var(--color-primary-accent);
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
  list-style: none;
}
.ficha-ot__summary::-webkit-details-marker {
  display: none;
}
.ficha-ot__summary:hover {
  background: var(--color-surface-hover);
}
.ficha-ot__summary-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.ficha-ot__chevron {
  transition: transform 0.18s ease;
}
.ficha-ot[open] .ficha-ot__chevron {
  transform: rotate(180deg);
}
.ficha-ot__body {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-4);
}
.ficha-alerts {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.85rem 1rem;
  border: 1px solid color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
  border-radius: var(--radius-control);
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-size: 0.86rem;
}
.ficha-alerts svg {
  flex: none;
  margin-top: 0.1rem;
}
.ficha-alerts ul {
  margin: 0.35rem 0 0;
  padding-left: 1.1rem;
  color: var(--color-text);
}
.ficha-notes {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
  font-size: 0.86rem;
}
.ficha-notes svg {
  flex: none;
  margin-top: 0.1rem;
  color: var(--color-primary-accent);
}
.ficha-notes p {
  margin: 0.25rem 0 0;
  color: var(--color-text);
  white-space: pre-wrap;
}
.ficha-block h4 {
  margin: 0 0 var(--space-2);
  font-size: 0.84rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ficha-kv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: var(--space-2);
  margin: 0;
}
.ficha-kv-grid > div {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
}
.ficha-kv-grid dt {
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  text-transform: capitalize;
}
.ficha-kv-grid dd {
  margin: 0.15rem 0 0;
  font-size: 0.86rem;
  font-weight: 650;
}
.components-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--space-3);
}
.component-card {
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
  display: grid;
  gap: 0.6rem;
}
.component-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.component-card__head strong {
  font-size: 0.92rem;
}
.component-card__qty {
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.component-card__attrs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem 0.75rem;
  margin: 0;
}
.component-card__attrs dt {
  color: var(--color-text-secondary);
  font-size: 0.72rem;
}
.component-card__attrs dd {
  margin: 0.1rem 0 0;
  font-size: 0.82rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.accessories-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.acc-chip {
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  font-size: 0.8rem;
  font-weight: 600;
}
.ficha-gallery {
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}
.summary--taller {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.work-line__badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.work-line__index {
  display: inline-grid;
  place-items: center;
  min-width: 1.7rem;
  height: 1.5rem;
  padding: 0 0.4rem;
  border-radius: 0.4rem;
  background: var(--color-surface-soft);
  border: 1px solid var(--color-border);
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}
.work-type-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  color: var(--color-text);
  font-size: 0.76rem;
  font-weight: 650;
}
.work-line__title {
  margin: 0.3rem 0 0;
  font-size: 1.12rem;
}
.workshop-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
}
.workshop-grid--full {
  grid-template-columns: minmax(0, 1fr);
}
.workshop-specs,
.workshop-media {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}
.spec-section {
  display: grid;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-left-width: 3px;
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.spec-section h4 {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--color-text);
}
.spec-section--measures {
  border-left-color: var(--color-primary-accent, #b91c1c);
}
.spec-section--measures h4 svg {
  color: var(--color-primary-accent, #b91c1c);
}
.spec-section--general {
  border-left-color: var(--color-info, #2563eb);
}
.spec-section--general h4 svg {
  color: var(--color-info, #2563eb);
}
.spec-section--components {
  border-left-color: var(--color-warning, #d97706);
}
.spec-section--components h4 svg {
  color: var(--color-warning, #d97706);
}
.spec-section--accessories {
  border-left-color: var(--color-success, #16a34a);
}
.spec-section--accessories h4 svg {
  color: var(--color-success, #16a34a);
}
.measures-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
  gap: 0.55rem;
  margin: 0;
}
.measure-chip {
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
}
.measure-chip dt {
  font-size: 0.72rem;
  color: var(--color-text-secondary);
}
.measure-chip dd {
  margin: 0.12rem 0 0;
  font-size: 0.92rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.piece-group {
  display: grid;
  gap: 0.5rem;
}
.piece-group__title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ot-plan-form {
  display: grid;
  gap: 0.85rem;
}
.ot-plan-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}
.ot-plan-grid__full {
  grid-column: 1 / -1;
}
@media (max-width: 47.99rem) {
  .summary--taller,
  .ot-plan-grid {
    grid-template-columns: 1fr;
  }
}
.ot-modal-icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: none;
  place-items: center;
  border-radius: 0.65rem;
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent);
}
.ot-ready-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
  margin-bottom: 1rem;
}
.ot-ready-metric {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.ot-ready-metric > div {
  display: grid;
  gap: 0.1rem;
}
.ot-ready-metric span {
  font-size: 0.72rem;
  color: var(--color-text-secondary);
}
.ot-ready-metric strong {
  font-size: 0.92rem;
}
.ot-ready-metric__icon {
  display: grid;
  width: 1.95rem;
  height: 1.95rem;
  flex: none;
  place-items: center;
  border-radius: 0.5rem;
  background: var(--color-surface-soft);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}
.ot-ready-metric__icon--info {
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
}
.ot-ready-note {
  margin: 0;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  font-size: 0.88rem;
  line-height: 1.45;
}
.catalog-ref-panel {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-card);
  background: var(--color-surface-muted);
}
.catalog-ref-panel__head {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  color: var(--color-text-secondary);
}
.catalog-ref-panel__head h3 {
  margin: 0;
  font-size: 0.92rem;
  color: var(--color-text);
}
.catalog-ref-panel__head p {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
}
.catalog-ref-list {
  display: grid;
  gap: var(--space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}
.catalog-ref-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.catalog-ref-item__main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.catalog-ref-item__main strong {
  font-size: 0.88rem;
}
.catalog-ref-item__qty {
  font-size: 0.84rem;
  font-weight: 650;
  color: var(--color-text-secondary);
}
@media (max-width: 64rem) {
  .summary,
  .workshop-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 47.99rem) {
  .workshop-grid,
  .ot-ready-board {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 38rem) {
  .summary,
  .ot-fields-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .work-line__main {
    flex-direction: column;
    gap: var(--space-3);
  }
  .work-line__qty {
    justify-items: start;
    text-align: left;
  }
}
.ot-timeline {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}
.ot-timeline__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  color: var(--ink);
}
.ot-timeline__header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}
.ot-timeline__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-3);
}
.ot-timeline__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}
.ot-timeline__dot {
  width: 0.6rem;
  height: 0.6rem;
  margin-top: 0.35rem;
  border-radius: 999px;
  background: var(--brand);
  flex-shrink: 0;
}
.ot-timeline__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.ot-timeline__prev,
.ot-timeline__meta {
  color: var(--ink-muted);
  font-size: 0.82rem;
}
</style>
