<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type {
  Cliente,
  ClienteNuevoProforma,
  ClienteResumenProforma,
  DetalleIntegralWritable,
  DetalleProforma,
  DetalleProformaWritable,
  EspecificacionMueble,
  EspecificacionMuebleWritable,
  FamiliaProducto,
  Proforma,
  ProformaIntegralWritable,
  Producto,
  ValorCatalogoPublico,
  ResultadoAsistida,
} from '@/generated/api'
import { ApiError } from '@/shared/api'
import {
  QUOTE_LIMITS,
  validateClient,
  validateQuoteConditions,
} from '@/shared/validation/commercialFields'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  CircleAlert,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Info,
  PackageOpen,
  Plus,
  SlidersHorizontal,
  Sofa,
  UserRound,
} from '@lucide/vue'
import Button from '@/shared/ui/Button.vue'
import Card from '@/shared/ui/Card.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import Modal from '@/shared/ui/Modal.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Toast from '@/shared/ui/Toast.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import TextField from '@/shared/ui/TextField.vue'
import ClienteSelector from '../components/ClienteSelector.vue'
import ClienteFormFields from '@/modules/clientes/components/ClienteFormFields.vue'
import DetalleForm from '../components/DetalleForm.vue'
import CatalogoContextual from '../components/CatalogoContextual.vue'
import type { CatalogoContextState } from '../services/catalogoContext'
import { loadPending, savePending } from '@/shared/media/pending'
import { galleryService } from '@/shared/media/gallery'
import MuebleStudio from '../components/MuebleStudio.vue'
import { mapearCapturaAsistida } from '../services/capturaAsistidaMapper'
import { leerDatosTecnicos, tecnicaIgual } from '../services/muebleTecnico'
import { proformasService } from '../services/proformasService'
import { retornoAProformas } from '../utils/navegacionProformas'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { productosService } from '@/modules/productos/services/productosService'
import ProductImage from '@/modules/productos/components/ProductImage.vue'
import { useQuoteProductImages } from '../composables/useQuoteProductImages'
import {
  cloneEditorData,
  consumeEditorDraft,
  removeLocalLine,
  restoreLocalLine,
  saveEditorDraft,
} from '../services/editorLocal'
import { totalEstimadoCompleto, totalEstimadoLinea } from '../services/presentacionComercial'

type LineaLocal = DetalleIntegralWritable & { localId: string; galeria_id?: string }
const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const proformaId = computed(() => (route.params.id ? Number(route.params.id) : null))
const listPath = computed(() => retornoAProformas(route.query.returnTo))
const listQuery = computed(() =>
  listPath.value === '/proformas' ? {} : { returnTo: listPath.value },
)
const isReview = computed(() => persisted.value?.estado_info.codigo === 'EN_REVISION')
let allowNavigationAfterSave = false
const steps = ['Productos', 'Cliente', 'Condiciones', 'Revisar'] as const
const currentStep = ref(0)
const loading = ref(Boolean(proformaId.value))
const saving = ref(false)
const referenceLoading = ref(true)
const error = ref('')
const success = ref('')
const fields = ref<Record<string, string[]>>({})
const validationAttempted = ref(false)
const localErrors = ref<Record<string, string>>({})
const conditionsTouched = ref<Record<string, boolean>>({})
function conditionError(field: keyof ReturnType<typeof validateQuoteConditions>): string {
  return (
    localErrors.value[field] ||
    (conditionsTouched.value[field] || validationAttempted.value
      ? validateQuoteConditions(header)[field] || ''
      : '')
  )
}
const dirty = ref(false)
const conflicted = ref(false)
const persisted = ref<Proforma | null>(null)
const tipos = ref<ValorCatalogoPublico[]>([])
const unidades = ref<ValorCatalogoPublico[]>([])
const monedas = ref<ValorCatalogoPublico[]>([])
const tiposMueble = ref<ValorCatalogoPublico[]>([])
const tiposCliente = ref<ValorCatalogoPublico[]>([])
const familias = ref<FamiliaProducto[]>([])
const catalogCategories = ref<ValorCatalogoPublico[]>([])
const lineModal = ref(false)
const additionMode = ref<'none' | 'choose' | 'catalog'>('none')
const catalogInitialized = ref(false)
const catalogState = ref<CatalogoContextState | null>(null)
const lineFormVersion = ref(0)
const lineModalDirty = ref(false)
const specModalDirty = ref(false)
const editingLine = ref<number | null>(null)
const menuLineId = ref<string | null>(null)
const readingLineId = ref<string | null>(null)
const readMaster = ref<Producto | null>(null)
let readRequestId = 0
const specLine = ref<number | null>(null)
const draftingFurniture = ref<LineaLocal | null>(null)
const furnitureOpen = computed(() => specLine.value !== null || draftingFurniture.value !== null)
const sesionBorrador = ref(crypto.randomUUID())
const specRenderVersion = ref(0)
const voiceProcessing = ref(false)
const pendientesAsistencia = ref<ResultadoAsistida['pendientes']>([])
function aplicarCaptura(result: ResultadoAsistida) {
  if (
    !draftingFurniture.value ||
    result.resultado !== 'REQUIRES_REVIEW' ||
    result.version_proyeccion !== 'PRF04_2' ||
    !result.propuesta_configurador
  )
    return
  try {
    const linea = mapearCapturaAsistida(result.propuesta_configurador, tipos.value, unidades.value)
    draftingFurniture.value = {
      ...linea,
      localId: draftingFurniture.value.localId,
      galeria_id: draftingFurniture.value.galeria_id,
      captura_asistida_id: result.id,
    }
    pendientesAsistencia.value = result.pendientes
    specRenderVersion.value++
    specModalDirty.value = true
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'La propuesta no es compatible.'
  }
}
const removedLines = ref<{ line: LineaLocal; index: number }[]>([])
const contextualNavigation = ref(false)
const preferredProductId = ref<number | null>(null)
const pendingLineDraft = ref<Record<string, string> | null>(null)
const duplicateOrigin = ref<string | null>(null)
const duplicateSpec = ref<EspecificacionMuebleWritable | null>(null)
const clienteMode = ref<'existente' | 'nuevo' | 'pendiente'>('pendiente')
const clienteSeleccionado = ref<Cliente | ClienteResumenProforma | null>(null)
const key = ref(crypto.randomUUID())
const header = reactive({
  cliente: '',
  titulo: '',
  moneda_codigo: 'BOB',
  plazo_entrega: '',
  validez_oferta: '',
  porcentaje_adelanto: '',
  observaciones: '',
})
const nuevoCliente = reactive({
  tipo_cliente: '',
  nombres: '',
  apellidos: '',
  empresa: '',
  celular: '',
  direccion: '',
  observaciones: '',
})
function updateNuevoCliente(field: keyof typeof nuevoCliente, value: string) {
  if (nuevoCliente[field] !== value) markDirty()
  nuevoCliente[field] = value
  const backendField = 'cliente_nuevo.' + field
  if (fields.value[backendField]) {
    const remaining = { ...fields.value }
    delete remaining[backendField]
    fields.value = remaining
  }
  if (error.value.startsWith('Revisa los campos señalados')) error.value = ''
}
const lineas = ref<LineaLocal[]>([])
const confirmation = ref<{ title: string; description: string; confirmLabel: string } | null>(null)
let confirmResolver: ((answer: boolean) => void) | null = null
function askConfirmation(
  description: string,
  title = 'Confirmar acción',
  confirmLabel = 'Continuar',
) {
  if (confirmResolver) confirmResolver(false)
  confirmation.value = { title, description, confirmLabel }
  return new Promise<boolean>((resolve) => {
    confirmResolver = resolve
  })
}
function answerConfirmation(answer: boolean) {
  confirmation.value = null
  const resolver = confirmResolver
  confirmResolver = null
  resolver?.(answer)
}
const whatsappExpanded = ref(false)
const whatsappEdited = ref(false)
const whatsappDraft = ref('')
const whatsappSuggested = computed(() => {
  const firstName =
    clienteMode.value === 'nuevo'
      ? nuevoCliente.nombres.trim().split(/\s+/)[0]
      : clienteMode.value === 'existente' && clienteSeleccionado.value
        ? 'nombres' in clienteSeleccionado.value
          ? (clienteSeleccionado.value.nombres || '').trim().split(/\s+/)[0]
          : 'nombre' in clienteSeleccionado.value && !clienteSeleccionado.value.empresa
            ? (clienteSeleccionado.value.nombre || '').trim().split(/\s+/)[0]
            : ''
        : ''
  const greeting = firstName ? '¡Hola, ' + firstName + '! 👋' : '¡Hola! 👋'
  const title = header.titulo.trim()
  return [
    greeting,
    'Te saluda el equipo de HOMEX. 🏡',
    'Te compartimos nuestra proforma' +
      (title ? ' "' + title + '"' : '') +
      ' para que puedas revisar los productos, precios y condiciones en el PDF adjunto.',
    'Quedamos atentos a tus consultas. ¡Gracias por confiar en nosotros!',
  ].join('\n\n')
})
watch(
  whatsappSuggested,
  (value) => {
    if (!whatsappEdited.value) whatsappDraft.value = value
  },
  { immediate: true },
)
function editWhatsapp(value: string) {
  whatsappEdited.value = true
  whatsappDraft.value = value
}
function resetWhatsapp() {
  whatsappEdited.value = false
  whatsappDraft.value = whatsappSuggested.value
}
const canShareWhatsApp = computed(() => {
  if (clienteMode.value === 'existente') return Boolean(header.cliente)
  if (clienteMode.value !== 'nuevo' || !nuevoCliente.tipo_cliente) return false
  const tipo = tiposCliente.value.find((item) => String(item.id) === nuevoCliente.tipo_cliente)
  return Object.keys(validateClient(nuevoCliente, tipo?.codigo === 'EMPRESA')).length === 0
})
const existingProductIds = computed(() =>
  lineas.value.flatMap((line) => (line.producto ? [line.producto] : [])),
)
const { images: quoteImages, ensure: ensureQuoteImages, remember: rememberQuoteImage } =
  useQuoteProductImages()
watch(existingProductIds, (ids) => void ensureQuoteImages(ids), { immediate: true })
function canEditCatalogProduct(product: Producto): boolean {
  return session.can('comercial.administrar') ||
    (session.can('catalogo.crear_producto') && product.created_by === session.identity?.id)
}
const totalPreview = computed(() => totalEstimadoCompleto(lineas.value))
type EmissionIssue = {
  id: string
  step: number
  title: string
  description: string
  action: string
}
const emissionIssues = computed<EmissionIssue[]>(() => {
  const issues: EmissionIssue[] = []
  if (!lineas.value.length) {
    issues.push({
      id: 'productos',
      step: 0,
      title: 'Productos',
      description: 'Agrega al menos un producto o mueble a pedido.',
      action: 'Ir a productos',
    })
  }
  if (clienteMode.value === 'pendiente' || (clienteMode.value === 'existente' && !header.cliente)) {
    issues.push({
      id: 'cliente',
      step: 1,
      title: 'Cliente',
      description: 'Selecciona un cliente existente o registra uno nuevo.',
      action: 'Ir a cliente',
    })
  } else if (clienteMode.value === 'nuevo') {
    const tipo = tiposCliente.value.find((item) => String(item.id) === nuevoCliente.tipo_cliente)
    const company = tipo?.codigo === 'EMPRESA'
    const invalid = validateClient(nuevoCliente, company)
    let description = ''
    if (!nuevoCliente.tipo_cliente)
      description = 'Indica si el cliente es persona natural o empresa.'
    else if (!nuevoCliente.nombres.trim() || !nuevoCliente.apellidos.trim())
      description = 'Completa los nombres y apellidos del contacto.'
    else if (company && !nuevoCliente.empresa.trim())
      description = 'Completa la razón social o empresa.'
    else {
      const fieldNames: Record<string, string> = {
        nombres: 'nombres',
        apellidos: 'apellidos',
        empresa: 'razón social',
        celular: 'celular',
        direccion: 'dirección',
        observaciones: 'observaciones',
      }
      const firstError = Object.entries(invalid)[0]
      if (firstError) description = 'Revisa ' + fieldNames[firstError[0]] + ': ' + firstError[1]
    }
    if (description)
      issues.push({
        id: 'cliente-nuevo',
        step: 1,
        title: 'Cliente',
        description,
        action: 'Ir a cliente',
      })
  }
  if (lineas.value.length && (totalPreview.value === null || totalPreview.value <= 0)) {
    issues.push({
      id: 'importe',
      step: 0,
      title: 'Importe',
      description: 'Revisa cantidades, precios y descuentos. El total debe ser mayor que cero.',
      action: 'Corregir productos',
    })
  }
  if (
    lineas.value.some(
      (line) =>
        tipos.value.find((tipo) => tipo.id === Number(line.tipo_item))?.codigo ===
          'MUEBLE_MEDIDA' && !line.especificacion,
    )
  ) {
    issues.push({
      id: 'ficha',
      step: 0,
      title: 'Ficha técnica',
      description: 'Los muebles a medida necesitan una ficha técnica antes de enviar.',
      action: 'Completar ficha',
    })
  }
  const errors = validateQuoteConditions(header)
  const firstError = Object.entries(errors)[0]
  if (firstError) {
    const fields: Record<string, string> = {
      titulo: 'título',
      porcentaje_adelanto: 'adelanto',
      plazo_entrega: 'plazo de entrega',
      validez_oferta: 'validez',
      observaciones: 'observaciones',
    }
    issues.push({
      id: 'condiciones',
      step: 2,
      title: 'Condiciones',
      description: 'Revisa ' + fields[firstError[0]] + ': ' + firstError[1],
      action: 'Ir a condiciones',
    })
  }
  return issues
})
const editingStatus = computed(() => {
  if (saving.value) return 'Guardando en HOMEX…'
  if (conflicted.value) return 'Conflicto: cambios locales conservados'
  if (lineModalDirty.value || specModalDirty.value) return 'Edición pendiente de incorporar'
  if (dirty.value) return 'Cambios locales sin guardar'
  if (persisted.value)
    return persisted.value.estado_info.codigo === 'BORRADOR'
      ? 'Borrador guardado'
      : `Proforma ${persisted.value.estado_info.nombre.toLocaleLowerCase('es')}`
  return 'Nueva cotización sin guardar'
})
const clientErrors = computed(() =>
  Object.fromEntries(
    Object.entries(fields.value)
      .filter(([campo]) => campo.startsWith('cliente_nuevo.'))
      .map(([campo, errores]) => [campo.slice('cliente_nuevo.'.length), errores]),
  ),
)
const fieldErrorMessages = computed(() => {
  const labels: Record<string, string> = {
    cliente: 'Cliente',
    cliente_nuevo: 'Cliente nuevo',
    titulo: 'Título',
    validez_oferta: 'Validez',
    porcentaje_adelanto: 'Adelanto',
    detalles: 'Productos',
    revision_esperada: 'Versión guardada',
    precio_unitario: 'Precio unitario',
    'cliente_nuevo.nombres': 'Nombres del cliente',
    'cliente_nuevo.apellidos': 'Apellidos del cliente',
    'cliente_nuevo.empresa': 'Razón social',
    'cliente_nuevo.tipo_cliente': 'Tipo de cliente',
    'cliente_nuevo.celular': 'Celular del cliente',
    'cliente_nuevo.direccion': 'Dirección del cliente',
    clave_idempotencia: 'Guardado seguro',
  }
  return Object.entries(fields.value).flatMap(([field, messages]) =>
    messages.map((message) => {
      const linea = /^detalles\[(\d+)\]\.(.+)$/.exec(field)
      const etiqueta = linea
        ? `Línea ${Number(linea[1]) + 1} · ${labels[linea[2] ?? ''] ?? linea[2]}`
        : (labels[field] ?? field)
      return `${etiqueta}: ${message}`
    }),
  )
})
const readingLine = computed(
  () => lineas.value.find((line) => line.localId === readingLineId.value) ?? null,
)
const readingTechnical = computed(() =>
  leerDatosTecnicos(readingLine.value?.especificacion?.datos_tecnicos),
)
function readableTechnical(value: unknown): string {
  if (value === null || value === undefined) return 'No especificado'
  if (Array.isArray(value)) return value.map(readableTechnical).join(', ')
  if (typeof value === 'object')
    return Object.entries(value as Record<string, unknown>)
      .map(([key, v]) => `${key.replace(/_/g, ' ')}: ${readableTechnical(v)}`)
      .join(' · ')
  return String(value)
}
async function openLineRead(id: string) {
  readingLineId.value = id
  menuLineId.value = null
  readMaster.value = null
  const token = ++readRequestId
  const productId = readingLine.value?.producto
  if (!productId) return
  try {
    const product = await productosService.get(productId)
    if (token === readRequestId) readMaster.value = product
  } catch {
    // La línea negociada debe poder consultarse aunque el maestro no esté disponible.
  }
}
function closeLineRead() {
  readRequestId++
  readingLineId.value = null
  readMaster.value = null
}
function editReadLine() {
  const index = lineas.value.findIndex((line) => line.localId === readingLineId.value)
  closeLineRead()
  if (index >= 0) openLine(index)
}
const editableDetail = computed(() => {
  if (editingLine.value === null) return undefined
  return lineas.value[editingLine.value] as unknown as DetalleProforma
})
const editableSpecDetail = computed(
  () =>
    draftingFurniture.value ??
    (specLine.value === null ? null : (lineas.value[specLine.value] ?? null)),
)
const editableSpec = computed(() => {
  if (draftingFurniture.value)
    return draftingFurniture.value.especificacion as EspecificacionMueble | null
  if (specLine.value === null) return null
  return (lineas.value[specLine.value]?.especificacion ?? null) as EspecificacionMueble | null
})
const canEmit = computed(
  () =>
    !saving.value &&
    !emissionIssues.value.length &&
    (persisted.value?.estado_info.codigo ?? 'BORRADOR') === 'BORRADOR',
)

function markDirty() {
  dirty.value = true
}
watch(
  header,
  () => {
    if (!validationAttempted.value) return
    const condition = validateQuoteConditions(header)
    localErrors.value = {
      ...Object.fromEntries(
        Object.entries(localErrors.value).filter(([field]) => field.startsWith('cliente_nuevo.')),
      ),
      ...condition,
    }
  },
  { deep: true },
)
watch(
  nuevoCliente,
  () => {
    if (!validationAttempted.value || clienteMode.value !== 'nuevo') return
    const tipo = tiposCliente.value.find((item) => String(item.id) === nuevoCliente.tipo_cliente)
    const client = validateClient(nuevoCliente, tipo?.codigo === 'EMPRESA')
    localErrors.value = {
      ...Object.fromEntries(
        Object.entries(localErrors.value).filter(([field]) => !field.startsWith('cliente_nuevo.')),
      ),
      ...Object.fromEntries(
        Object.entries(client).map(([field, message]) => ['cliente_nuevo.' + field, message]),
      ),
    }
  },
  { deep: true },
)
function setExistingClient(value: string) {
  if (header.cliente !== value) {
    header.cliente = value
    markDirty()
  }
}
function nombreClienteVisible() {
  const cliente = clienteSeleccionado.value
  if (!cliente) return 'Cliente pendiente'
  if ('nombre' in cliente) return cliente.empresa || cliente.nombre || 'Cliente pendiente'
  return (
    cliente.empresa ||
    `${cliente.nombres ?? ''} ${cliente.apellidos ?? ''}`.trim() ||
    'Cliente pendiente'
  )
}
function money(value: number) {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: header.moneda_codigo,
  }).format(value)
}
function localId() {
  return crypto.randomUUID()
}
function normalizeLine(line: Proforma['detalles'][number]): LineaLocal {
  return {
    id: line.id,
    galeria_id: line.galeria_id ?? undefined,
    localId: localId(),
    tipo_item: line.tipo_item,
    producto: line.producto,
    familia_producto: line.familia_producto,
    nombre: line.nombre,
    descripcion: line.descripcion,
    cantidad: line.cantidad,
    unidad: line.unidad,
    modo_calculo: line.modo_calculo,
    precio_unitario: line.precio_unitario,
    importe_negociado: line.importe_negociado,
    descuento: line.descuento,
    especificacion: line.especificacion
      ? {
          tipo_mueble: line.especificacion.tipo_mueble,
          datos_tecnicos: line.especificacion.datos_tecnicos,
          observaciones: line.especificacion.observaciones,
        }
      : null,
  }
}
function fill(value: Proforma) {
  persisted.value = value
  header.cliente = value.cliente ? String(value.cliente) : ''
  header.titulo = value.titulo ?? ''
  header.moneda_codigo = value.moneda_info.codigo
  header.plazo_entrega = value.plazo_entrega ?? ''
  header.validez_oferta = value.validez_oferta ? String(value.validez_oferta) : ''
  header.porcentaje_adelanto = value.porcentaje_adelanto ?? ''
  header.observaciones = value.observaciones ?? ''
  clienteMode.value = value.cliente ? 'existente' : 'pendiente'
  clienteSeleccionado.value = value.cliente_resumen ?? null
  lineas.value = value.detalles.map(normalizeLine)
  removedLines.value = []
  dirty.value = false
}
async function load() {
  if (!proformaId.value) return
  loading.value = true
  try {
    const value = await proformasService.get(proformaId.value)
    if (!['BORRADOR', 'EN_REVISION'].includes(value.estado_info.codigo)) {
      await router.replace({ name: 'proforma-readonly', params: { id: value.id } })
      return
    }
    fill(value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la proforma.'
  } finally {
    loading.value = false
  }
}
async function loadReferences() {
  referenceLoading.value = true
  try {
    const [a, b, c, d, e, f, g] = await Promise.all([
      proformasService.options('TIPO_ITEM'),
      proformasService.options('UNIDAD_MEDIDA'),
      proformasService.options('MONEDA'),
      proformasService.options('TIPO_MUEBLE'),
      proformasService.options('TIPO_CLIENTE'),
      proformasService.families(),
      proformasService.options('CATEGORIA_PRODUCTO'),
    ])
    tipos.value = a
    unidades.value = b
    monedas.value = c
    tiposMueble.value = d
    tiposCliente.value = e
    familias.value = f.results
    catalogCategories.value = g
    if (!nuevoCliente.tipo_cliente && e[0]) nuevoCliente.tipo_cliente = String(e[0].id)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se cargaron los datos auxiliares.'
  } finally {
    referenceLoading.value = false
  }
}
function saveLine(body: DetalleProformaWritable) {
  preferredProductId.value = null
  pendingLineDraft.value = null
  const line: LineaLocal = {
    ...body,
    localId: localId(),
    especificacion: duplicateOrigin.value ? cloneEditorData(duplicateSpec.value) : null,
  }
  const duplicateSource = duplicateOrigin.value
  duplicateSpec.value = null
  const editingIndex = editingLine.value
  const wasNew = editingIndex === null
  if (wasNew) lineas.value.push(line)
  else {
    const previous = lineas.value[editingIndex!]
    if (!previous) return
    lineas.value[editingIndex!] = {
      ...line,
      id: previous.id,
      localId: previous.localId,
      galeria_id: previous.galeria_id,
      especificacion: previous.especificacion,
    }
  }
  lineModal.value = false
  lineModalDirty.value = false
  editingLine.value = null
  additionMode.value = 'none'
  markDirty()
  if (body.producto) {
    success.value = wasNew
      ? 'Producto añadido a la proforma. Configura los demás ítems o guarda el borrador.'
      : 'Datos de la línea comercial actualizados. Guarda la proforma para confirmar.'
  }
  const isFurniture =
    tipos.value.find((x) => x.id === Number(body.tipo_item))?.codigo === 'MUEBLE_MEDIDA'
  if (wasNew && isFurniture && duplicateSource) {
    duplicateOrigin.value = duplicateSource
    specLine.value = lineas.value.length - 1
    specModalDirty.value = false
  } else duplicateOrigin.value = null
}
function registrarTipoMueble(tipo: ValorCatalogoPublico) {
  if (tiposMueble.value.some((item) => item.id === tipo.id)) return
  tiposMueble.value = [...tiposMueble.value, tipo].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es'),
  )
}
async function saveSpec(
  body: EspecificacionMuebleWritable,
  comercial: {
    nombre: string
    descripcion: string
    cantidad: string
    unidad: number
    precio_unitario: string
    descuento: string
  },
) {
  if (draftingFurniture.value) {
    const candidate: LineaLocal = {
      ...draftingFurniture.value,
      ...comercial,
      especificacion: body,
    }
    const original = duplicateOrigin.value
      ? lineas.value.find((line) => line.localId === duplicateOrigin.value)
      : null
    if (original) {
      const commercialKeys = [
        'nombre',
        'descripcion',
        'cantidad',
        'unidad',
        'precio_unitario',
        'descuento',
      ] as const
      const sameCommercial = commercialKeys.every(
        (key) => String(original[key] ?? '') === String(candidate[key] ?? ''),
      )
      const existingSpec = original.especificacion
      const sameSpec =
        (existingSpec?.tipo_mueble ?? null) === (body.tipo_mueble ?? null) &&
        (existingSpec?.observaciones ?? null) === (body.observaciones ?? null) &&
        tecnicaIgual(existingSpec?.datos_tecnicos ?? {}, body.datos_tecnicos ?? {})
      if (sameCommercial && sameSpec && !candidate.galeria_id) {
        if (
          !(await askConfirmation(
            'La copia es idéntica. ¿Aumentar la cantidad de la línea original?',
            'Mueble duplicado',
            'Sumar cantidad',
          ))
        )
          return
        original.cantidad = String(Number(original.cantidad) + Number(candidate.cantidad))
      } else lineas.value.push(candidate)
    } else lineas.value.push(candidate)
    draftingFurniture.value = null
    duplicateOrigin.value = null
    duplicateSpec.value = null
    specLine.value = null
    specModalDirty.value = false
    additionMode.value = 'none'
    markDirty()
    return
  }
  if (specLine.value === null) return
  const existingLine = lineas.value[specLine.value]
  if (!existingLine) return
  Object.assign(existingLine, comercial)

  const index = specLine.value
  const line = lineas.value[index]
  if (!line) return
  line.especificacion = body
  if (duplicateOrigin.value) {
    const original = lineas.value.find((item) => item.localId === duplicateOrigin.value)
    const commercialKeys: (keyof DetalleProformaWritable)[] = [
      'tipo_item',
      'producto',
      'familia_producto',
      'nombre',
      'descripcion',
      'cantidad',
      'unidad',
      'precio_unitario',
      'descuento',
    ]
    const identical =
      original &&
      commercialKeys.every((key) => String(original[key] ?? '') === String(line[key] ?? '')) &&
      tecnicaIgual(original.especificacion ?? null, body)
    if (identical) {
      if (
        !(await askConfirmation(
          'La copia completa es idéntica. ¿Sumar su cantidad a la línea original?',
          'Mueble duplicado',
          'Sumar cantidad',
        ))
      )
        return
      original.cantidad = String(Number(original.cantidad) + Number(line.cantidad))
      lineas.value.splice(index, 1)
    }
  }
  duplicateOrigin.value = null
  specLine.value = null
  specModalDirty.value = false
  markDirty()
}
function selectMenuAction(action: 'edit' | 'spec' | 'duplicate' | 'remove', index: number) {
  menuLineId.value = null
  if (action === 'edit') openLine(index)
  else if (action === 'spec') openSpec(index)
  else if (action === 'duplicate') duplicateFurniture(index)
  else removeLine(index)
}
function openSpec(index: number) {
  specModalDirty.value = false
  specLine.value = index
}
async function closeSpec() {
  if (
    specModalDirty.value &&
    !(await askConfirmation(
      'Hay cambios sin guardar en la ficha técnica. ¿Deseas descartarlos?',
      'Descartar ficha técnica',
      'Descartar cambios',
    ))
  )
    return
  specLine.value = null
  draftingFurniture.value = null
  duplicateOrigin.value = null
  specModalDirty.value = false
}
function removeLine(index: number) {
  const result = removeLocalLine(lineas.value, index)
  lineas.value = result.lines
  if (result.removed) {
    removedLines.value.push(result.removed)
    success.value = 'Línea retirada provisionalmente. Puedes deshacer antes de guardar.'
  }
  markDirty()
}
function undoRemove() {
  const removed = removedLines.value.pop()
  if (!removed) return
  lineas.value = restoreLocalLine(lineas.value, removed)
  success.value = 'Línea restaurada. Guarda los cambios para confirmar.'
  markDirty()
}
function openFurnitureDraft(source?: LineaLocal) {
  const tipo = tipos.value.find((item) => item.codigo === 'MUEBLE_MEDIDA')
  const unidad = unidades.value.find((item) => item.codigo === 'PIEZA')
  if (!tipo || !unidad) {
    error.value = 'Faltan referencias comerciales necesarias para configurar el mueble.'
    return
  }
  draftingFurniture.value = {
    ...(source ? cloneEditorData(source) : {}),
    localId: localId(),
    tipo_item: tipo.id,
    producto: null,
    familia_producto: null,
    nombre: source?.nombre ?? '',
    descripcion: source?.descripcion ?? '',
    cantidad: source?.cantidad ?? '1',
    unidad: source?.unidad ?? unidad.id,
    modo_calculo: 'PRECIO_UNITARIO',
    precio_unitario: source?.precio_unitario ?? '',
    descuento: source?.descuento ?? '0.00',
    especificacion: cloneEditorData(source?.especificacion ?? null),
  } as LineaLocal
  delete draftingFurniture.value.id
  delete draftingFurniture.value.captura_asistida_id
  pendientesAsistencia.value = []
  specRenderVersion.value++
  markDirty()
  specLine.value = null
  lineModal.value = false
  specModalDirty.value = Boolean(source)
}
async function duplicateFurniture(index: number) {
  const original = lineas.value[index]
  if (!original || tipos.value.find((x) => x.id === original.tipo_item)?.codigo !== 'MUEBLE_MEDIDA')
    return
  try {
    const source =
      original.galeria_id ??
      (original.id
        ? (await galleryService.create(sesionBorrador.value, original.id)).id
        : undefined)
    const copy = cloneEditorData(original)
    delete copy.galeria_id
    if (source)
      copy.galeria_id = (
        await galleryService.create(sesionBorrador.value, undefined, source, crypto.randomUUID())
      ).id
    duplicateOrigin.value = original.localId
    openFurnitureDraft(copy)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron duplicar las imágenes.'
    return
  }
  success.value = 'Revisa la copia y su ficha técnica antes de incorporarla.'
}
const editorReady = ref(false)
function autosaveToken() {
  return `gallery:${session.identity?.id ?? 'unknown'}:${route.path}`
}
watch(
  [lineas, draftingFurniture, header, currentStep, sesionBorrador, specLine],
  () => {
    if (editorReady.value && !saving.value && (dirty.value || specModalDirty.value)) {
      try {
        saveEditorDraft(autosaveToken(), editorSnapshot())
      } catch {
        error.value = 'No se pudo conservar el borrador local; guarda la proforma antes de salir.'
      }
    }
  },
  { deep: true, flush: 'post' },
)
function editorSnapshot() {
  return {
    userId: session.identity?.id ?? null,
    expiresAt: Date.now() + 60 * 60 * 1000,
    header: cloneEditorData(header),
    nuevoCliente: cloneEditorData(nuevoCliente),
    clienteMode: clienteMode.value,
    clienteSeleccionado: cloneEditorData(clienteSeleccionado.value),
    lineModalDirty: lineModalDirty.value,
    lineas: cloneEditorData(lineas.value),
    draftingFurniture: cloneEditorData(draftingFurniture.value),
    removedLines: cloneEditorData(removedLines.value),
    additionMode: additionMode.value,
    catalogInitialized: catalogInitialized.value,
    catalogState: cloneEditorData(catalogState.value),
    currentStep: currentStep.value,
    key: key.value,
    sesionBorrador: sesionBorrador.value,
    lineDraft: cloneEditorData(pendingLineDraft.value),
    editingLine: editingLine.value,
    specLine: specLine.value,
  }
}
async function createProductContextually(draft: Record<string, string>) {
  pendingLineDraft.value = cloneEditorData(draft)
  const token = crypto.randomUUID()
  saveEditorDraft(token, editorSnapshot())
  contextualNavigation.value = true
  lineModal.value = false
  const tipo = tipos.value.find((item) => String(item.id) === draft.tipo_item)
  const categoria = ['SILLA', 'PISO_FLOTANTE', 'OTRO'].includes(tipo?.codigo ?? '')
    ? tipo?.codigo
    : undefined
  await router.push({
    name: 'producto-create',
    query: { returnTo: route.path, draft: token, categoria },
  })
}
function createProductFromCategory(categoryCode: string) {
  const tipo = tipos.value.find((value) => value.codigo === categoryCode)
  if (!tipo) return
  void createProductContextually({ tipo_item: String(tipo.id) })
}
async function editProductContextually(productId: number) {
  if (!session.can('catalogo.crear_producto') && !session.can('comercial.administrar')) return
  const token = crypto.randomUUID()
  saveEditorDraft(token, editorSnapshot())
  contextualNavigation.value = true
  await router.push({
    name: 'producto-detail',
    params: { id: productId },
    query: { returnTo: route.path, draft: token, editar: '1' },
  })
}
function restoreContextualDraft() {
  const token = typeof route.query.draft === 'string' ? route.query.draft : autosaveToken()
  if (!token) return
  const snapshot = consumeEditorDraft<ReturnType<typeof editorSnapshot>>(token)
  if (!snapshot) return
  if (snapshot.expiresAt && Date.now() > snapshot.expiresAt) {
    error.value = 'El borrador temporal caducó. Recupera la última proforma guardada.'
    return
  }
  if (snapshot.userId != null && snapshot.userId !== session.identity?.id) {
    error.value = 'Este borrador temporal corresponde a otra sesión y no será restaurado.'
    return
  }
  Object.assign(header, snapshot.header)
  Object.assign(nuevoCliente, snapshot.nuevoCliente)
  clienteMode.value = snapshot.clienteMode
  clienteSeleccionado.value =
    snapshot.clienteSeleccionado ?? persisted.value?.cliente_resumen ?? null
  lineas.value = snapshot.lineas
  draftingFurniture.value = snapshot.draftingFurniture ?? null
  specLine.value = snapshot.specLine ?? null
  removedLines.value = snapshot.removedLines ?? []
  additionMode.value = snapshot.additionMode ?? 'none'
  catalogInitialized.value = snapshot.catalogInitialized ?? false
  catalogState.value = snapshot.catalogState ?? null
  currentStep.value = snapshot.currentStep
  key.value = snapshot.key
  sesionBorrador.value = snapshot.sesionBorrador ?? crypto.randomUUID()
  pendingLineDraft.value = snapshot.lineDraft
  lineModalDirty.value = Boolean(snapshot.lineModalDirty || snapshot.lineDraft)
  editingLine.value = snapshot.editingLine
  dirty.value = true
  lineModal.value = Boolean(pendingLineDraft.value)
  const created = Number(route.query.productoCreado)
  if (created) {
    preferredProductId.value = created
    lineModal.value = true
    success.value =
      route.query.mediaError === '1'
        ? 'Producto creado y seleccionado; la imagen no pudo cargarse. Puedes añadirla desde su ficha.'
        : 'Producto creado. Completa su cantidad y precio para añadirlo.'
  }
}
async function copyCommercialSummary() {
  if (!canShareWhatsApp.value) {
    error.value = 'Selecciona un cliente válido antes de copiar el mensaje de WhatsApp.'
    return
  }
  if (!whatsappDraft.value.trim()) {
    error.value = 'El mensaje está vacío. Escribe uno o restaura el texto sugerido.'
    return
  }
  try {
    await navigator.clipboard.writeText(whatsappDraft.value)
    success.value = 'Mensaje copiado. Puedes pegarlo en WhatsApp y adjuntar el PDF.'
  } catch {
    error.value = 'No fue posible copiar el mensaje. Selecciónalo manualmente para copiarlo.'
  }
}

async function closeLineModal() {
  if (
    lineModalDirty.value &&
    !(await askConfirmation(
      'Hay cambios sin agregar en esta línea. ¿Deseas descartarlos?',
      'Descartar línea',
      'Descartar cambios',
    ))
  )
    return
  lineModal.value = false
  lineModalDirty.value = false
  pendingLineDraft.value = null
  editingLine.value = null
  duplicateOrigin.value = null
  duplicateSpec.value = null
}
function openLine(index: number | null = null) {
  if (index !== null && lineas.value[index]?.modo_calculo === 'TOTAL_NEGOCIADO') return
  if (
    index !== null &&
    tipos.value.find((x) => x.id === lineas.value[index]?.tipo_item)?.codigo === 'MUEBLE_MEDIDA'
  ) {
    openSpec(index)
    return
  }
  lineFormVersion.value++
  pendingLineDraft.value = null
  editingLine.value = index
  lineModalDirty.value = false
  lineModal.value = true
}
function chooseCatalog() {
  catalogInitialized.value = true
  additionMode.value = 'catalog'
}
function selectCatalogProduct(product: Producto) {
  rememberQuoteImage(product)
  if (existingProductIds.value.includes(product.id)) {
    void focusDuplicateProduct(product.id)
    return
  }
  preferredProductId.value = product.id
  openLine()
}
function chooseManualFurniture() {
  preferredProductId.value = null
  duplicateOrigin.value = null
  openFurnitureDraft()
}
function quotePendingFamily(familyId: number, categoryId: number) {
  const categoria = tipos.value.find(
    (x) =>
      x.codigo === (catalogCategories.value.find((item) => item.id === categoryId)?.codigo ?? ''),
  )
  if (!categoria) return
  const codigo = categoria.codigo
  const unidadCodigo = codigo === 'PISO_FLOTANTE' ? 'M2' : 'PIEZA'
  const unidad = unidades.value.find((x) => x.codigo === unidadCodigo)
  const familia = familias.value.find((x) => x.id === familyId)
  preferredProductId.value = null
  openLine()
  pendingLineDraft.value = {
    tipo_item: String(categoria.id),
    unidad: String(unidad?.id ?? ''),
    familia_producto: String(familyId),
    nombre: familia?.nombre ?? '',
    precio_unitario: '',
  }
}
async function focusDuplicateProduct(productId: number) {
  const index = lineas.value.findIndex((line) => line.producto === productId)
  if (index < 0) return
  if (
    lineModalDirty.value &&
    !(await askConfirmation(
      'La variante ya está incluida. ¿Deseas descartar esta edición y ver la línea existente?',
      'Variante duplicada',
      'Ver línea existente',
    ))
  )
    return
  lineModal.value = false
  lineModalDirty.value = false
  pendingLineDraft.value = null
  editingLine.value = null
  success.value = 'Esta variante ya está incluida; puedes editar su línea existente.'
  await nextTick()
  document.getElementById(`ap3-linea-${lineas.value[index]?.localId}`)?.focus()
}
async function discardAndReload() {
  conflicted.value = false
  error.value = ''
  await load()
}
function body(emitir: boolean): ProformaIntegralWritable {
  const detalles = lineas.value.map((line) => {
    const detalle: Partial<LineaLocal> = { ...line }
    delete detalle.localId
    return detalle as DetalleIntegralWritable
  })
  return {
    clave_idempotencia: key.value,
    sesion_borrador: sesionBorrador.value,
    ...(proformaId.value && persisted.value ? { revision_esperada: persisted.value.revision } : {}),
    emitir,
    cliente: clienteMode.value === 'existente' && header.cliente ? Number(header.cliente) : null,
    cliente_nuevo:
      clienteMode.value === 'nuevo'
        ? ({
            ...nuevoCliente,
            empresa:
              tiposCliente.value.find((item) => String(item.id) === nuevoCliente.tipo_cliente)
                ?.codigo === 'EMPRESA'
                ? nuevoCliente.empresa
                : '',
            tipo_cliente: Number(nuevoCliente.tipo_cliente),
          } satisfies ClienteNuevoProforma)
        : null,
    titulo: header.titulo || null,
    moneda_codigo: header.moneda_codigo as 'BOB' | 'USD',
    plazo_entrega: header.plazo_entrega || null,
    validez_oferta: header.validez_oferta ? Number(header.validez_oferta) : null,
    porcentaje_adelanto: header.porcentaje_adelanto || null,
    observaciones: header.observaciones || null,
    detalles,
  }
}
async function requestReview() {
  if (!canEmit.value || saving.value) return
  const confirmed = await askConfirmation(
    'La proforma se guardará y pasará a revisión. Todavía no se creará un pedido; la aprobación es una acción posterior.',
    'Enviar proforma a revisión',
    'Enviar a revisión',
  )
  if (confirmed) await persist(true)
}
async function persist(emitir: boolean) {
  if (saving.value || (emitir && (isReview.value || !canEmit.value))) return
  validationAttempted.value = true
  localErrors.value = validateQuoteConditions(header)
  if (clienteMode.value === 'nuevo') {
    if (!nuevoCliente.tipo_cliente) {
      localErrors.value['cliente_nuevo.tipo_cliente'] = 'Selecciona el tipo de cliente.'
    }
    const tipo = tiposCliente.value.find((item) => String(item.id) === nuevoCliente.tipo_cliente)
    const errors = validateClient(nuevoCliente, tipo?.codigo === 'EMPRESA')
    for (const [field, message] of Object.entries(errors))
      localErrors.value['cliente_nuevo.' + field] = message
  }
  if (Object.keys(localErrors.value).length) {
    error.value = 'Revisa los campos señalados antes de guardar.'
    currentStep.value = Object.keys(localErrors.value).some((field) =>
      field.startsWith('cliente_nuevo.'),
    )
      ? 1
      : 2
    return
  }
  saving.value = true
  error.value = ''
  success.value = ''
  conflicted.value = false
  fields.value = {}
  try {
    for (const line of lineas.value) {
      if (!line.galeria_id) continue
      const path = `/api/v1/galerias/${line.galeria_id}/imagenes/`
      const pending = await loadPending(path)
      while (pending.length) {
        const image = pending[0]!
        await galleryService.upload(path, image.file, image.digest)
        pending.splice(0, 1)
        await savePending(path, pending)
        URL.revokeObjectURL(image.url)
      }
    }
    const result = proformaId.value
      ? await proformasService.updateIntegral(proformaId.value, body(emitir))
      : await proformasService.saveIntegral(body(emitir))
    sessionStorage.removeItem(`homex:ap5:draft:${autosaveToken()}`)
    fill(result)
    removedLines.value = []
    key.value = crypto.randomUUID()
    success.value = emitir
      ? 'Proforma enviada a revisión.'
      : result.estado_info.codigo === 'EN_REVISION'
        ? 'Cambios guardados en la proforma en revisión.'
        : 'Borrador guardado.'
    allowNavigationAfterSave = true
    if (emitir) {
      await router.replace({
        path: `/proformas/${result.id}`,
        query: { ...listQuery.value, enviada: '1' },
      })
    } else if (!proformaId.value) {
      await router.replace({
        path: `/proformas/${result.id}/editar`,
        query: listQuery.value,
      })
    }
  } catch (cause) {
    if (cause instanceof ApiError) fields.value = cause.fields
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la proforma.'
    if (emitir && error.value.includes('ESTADO_PROFORMA.EN_REVISION')) {
      error.value =
        'No se pudo enviar: el estado «En revisión» no está activo en la base de datos. ' +
        'Un administrador debe revisar el catálogo de estados del entorno. Tus cambios permanecen en el editor.'
    }
    if (cause instanceof ApiError && cause.status === 409 && proformaId.value) {
      conflicted.value = true
      error.value = `${error.value} Se conservaron tus cambios locales. Puedes copiarlos o descartarlos y recargar.`
    }
  } finally {
    allowNavigationAfterSave = false
    saving.value = false
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value && !lineModalDirty.value && !specModalDirty.value) return
  event.preventDefault()
}
onBeforeRouteLeave(async () => {
  if (allowNavigationAfterSave) return true
  if (saving.value) return false
  if (
    contextualNavigation.value ||
    (!dirty.value && !lineModalDirty.value && !specModalDirty.value)
  )
    return true
  return askConfirmation(
    'Hay cambios sin guardar. Si sales, podrías perder los datos introducidos.',
    'Salir sin guardar',
    'Salir sin guardar',
  )
})
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  await Promise.all([loadReferences(), load()])
  restoreContextualDraft()
  editorReady.value = true
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div class="quote-workspace" @input="markDirty" @change="markDirty">
    <Toast :visible="Boolean(success)" :message="success" tone="success" @close="success = ''" />
    <Toast :visible="Boolean(error) && !loading && !referenceLoading" :message="error" tone="danger" @close="error = ''" />
    <ConfirmDialog
      :open="Boolean(confirmation)"
      :title="confirmation?.title || 'Confirmar'"
      :description="confirmation?.description || ''"
      :confirm-label="confirmation?.confirmLabel"
      @close="answerConfirmation(false)"
      @confirm="answerConfirmation(true)"
    />
    <div v-if="!furnitureOpen" class="quote-main">
      <div class="quote-topline" aria-label="Ubicación en el proceso">
        <span>COMERCIAL <span class="quote-divider">/</span> PROFORMAS</span>
        <div class="quote-topline__right">
          <span class="quote-progress">Paso {{ currentStep + 1 }} de {{ steps.length }}</span>
          <div
            class="quote-save-status"
            :class="{
              'quote-save-status--saved': persisted && !dirty && !saving && !conflicted,
              'quote-save-status--warning': conflicted,
            }"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2
              v-if="persisted && !dirty && !saving && !conflicted"
              :size="14"
              aria-hidden="true"
            />
            <CircleAlert v-else-if="conflicted" :size="14" aria-hidden="true" />
            <Info v-else :size="14" aria-hidden="true" />
            <span>{{ editingStatus }}</span>
          </div>
          <span v-if="persisted" class="quote-save-reference">
            {{ persisted.estado_info.nombre }} · Proforma {{ persisted.numero }}
          </span>
        </div>
      </div>
      <PageHeader
        :title="persisted ? `Editar proforma #${persisted.numero}` : 'Nueva proforma'"
        description="Prepara productos, cliente y condiciones antes de guardar."
        show-menu
        @menu="emit('openMenu')"
      >
        <template #actions>
          <Button variant="secondary" @click="router.push(listPath)">
            <ArrowLeft :size="17" aria-hidden="true" /> Volver a proformas
          </Button>
        </template>
      </PageHeader>
      <LoadingSkeleton v-if="loading || referenceLoading" :lines="8" />
      <ErrorState v-else-if="error && !tipos.length" :description="error">
        <button @click="loadReferences">Reintentar</button>
      </ErrorState>
      <template v-else>
        <nav class="steps" aria-label="Apartados de la proforma">
          <button
            v-for="(step, index) in steps"
            :key="step"
            type="button"
            :class="{ active: currentStep === index }"
            :aria-current="currentStep === index ? 'step' : undefined"
            @click="currentStep = index"
          >
            <span class="step-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="step-label">{{ step }}</span>
            <span class="step-marker" aria-hidden="true" />
          </button>
        </nav>

        <div v-if="error" role="alert" class="error error-summary">
          <strong>{{ error }}</strong>
          <ul v-if="fieldErrorMessages.length">
            <li v-for="message in fieldErrorMessages" :key="message">{{ message }}</li>
          </ul>
        </div>
        <div v-if="conflicted" class="conflict-actions">
          <Button variant="secondary" @click="discardAndReload">
            Descartar cambios y recargar
          </Button>
        </div>

        <section
          v-show="currentStep === 0"
          class="quote-panel products-panel"
          aria-labelledby="productos-title"
        >
          <div class="section-title">
            <div class="section-title__identity">
              <span class="section-icon"><PackageOpen :size="22" aria-hidden="true" /></span>
              <div>
                <p class="section-kicker">01 · COMPOSICIÓN</p>
                <h2 id="productos-title">Productos</h2>
                <p>Agrega productos antes o después de elegir cliente.</p>
              </div>
            </div>
            <div class="section-title__tools">
              <span v-if="lineas.length" class="count-pill"
                >{{ lineas.length }} {{ lineas.length === 1 ? 'ítem' : 'ítems' }}</span
              >
              <Button @click="additionMode = 'choose'"
                ><Plus :size="17" aria-hidden="true" />Añadir ítem</Button
              >
            </div>
          </div>
          <div v-if="additionMode === 'choose'" class="choice-panel">
            <div class="choice-panel__heading">
              <div>
                <p class="section-kicker">AGREGAR A LA PROFORMA</p>
                <h3>¿Qué deseas incorporar a la cotización?</h3>
                <p>Selecciona cómo quieres incorporar el siguiente ítem.</p>
              </div>
              <Button variant="secondary" @click="additionMode = 'none'">Cancelar</Button>
            </div>
            <div class="choice-grid">
              <button type="button" class="choice-card" @click="chooseCatalog">
                <span class="choice-card__icon"><PackageOpen :size="24" aria-hidden="true" /></span>
                <span class="choice-card__copy">
                  <strong>Producto de catálogo</strong>
                  <small>Busca un producto existente y añádelo a la cotización.</small>
                </span>
                <ArrowRight :size="20" aria-hidden="true" />
              </button>
              <button type="button" class="choice-card" @click="chooseManualFurniture">
                <span class="choice-card__icon"><Sofa :size="24" aria-hidden="true" /></span>
                <span class="choice-card__copy">
                  <strong>Mueble a pedido</strong>
                  <small>Define las características y el importe de un mueble a medida.</small>
                </span>
                <ArrowRight :size="20" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div v-if="catalogInitialized" v-show="additionMode === 'catalog'">
            <CatalogoContextual
              :categorias="catalogCategories"
              :familias="familias"
              :existing-product-ids="existingProductIds"
              :can-create="session.can('catalogo.crear_producto')"
              :can-edit-product="canEditCatalogProduct"
              :initial-state="catalogState ?? undefined"
              @state-change="catalogState = $event"
              @create="createProductFromCategory"
              @edit="editProductContextually"
              @select="selectCatalogProduct"
              @duplicate="focusDuplicateProduct"
              @pending="quotePendingFamily"
              @cancel="additionMode = 'none'"
            />
          </div>
          <Card v-for="(line, index) in lineas" :key="line.localId" class="line-card">
            <span class="line-index" aria-hidden="true">{{
              String(index + 1).padStart(2, '0')
            }}</span>
            <div
              :id="`ap3-linea-${line.localId}`"
              class="line-summary"
              tabindex="0"
              role="button"
              :aria-label="'Ver detalle completo de ' + line.nombre"
              @click="openLineRead(line.localId)"
              @keydown.enter.prevent="openLineRead(line.localId)"
              @keydown.space.prevent="openLineRead(line.localId)"
            >
              <div class="line-heading">
                <div v-if="line.producto" class="line-thumbnail">
                  <ProductImage :image="quoteImages[line.producto] ?? null" :alt="line.nombre" sizes="64px" />
                </div>
                <strong>{{ line.nombre }}</strong>
              </div>
              <p v-if="line.modo_calculo === 'TOTAL_NEGOCIADO'">
                Importe histórico negociado: {{ money(Number(line.importe_negociado || 0)) }}
              </p>
              <p v-else-if="totalEstimadoLinea(line) !== null">
                {{ line.cantidad }} × {{ money(Number(line.precio_unitario)) }}
                <span v-if="Number(line.descuento) === 0">· Sin descuento</span>
              </p>
              <p v-else class="pending-value">Precio pendiente</p>
            </div>
            <strong v-if="totalEstimadoLinea(line) !== null">
              {{ money(totalEstimadoLinea(line)!) }}
            </strong>
            <strong v-else class="pending-value">Importe pendiente</strong>
            <div class="line-menu" @keydown.esc="menuLineId = null">
              <button
                type="button"
                class="menu-trigger"
                :aria-expanded="menuLineId === line.localId"
                :aria-label="'Acciones de ' + line.nombre"
                aria-haspopup="menu"
                @click.stop="menuLineId = menuLineId === line.localId ? null : line.localId"
              >
                ⋮
              </button>
              <div v-if="menuLineId === line.localId" class="menu-panel" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  :disabled="line.modo_calculo === 'TOTAL_NEGOCIADO'"
                  @click="selectMenuAction('edit', index)"
                >
                  Editar
                </button>
                <button
                  v-if="tipos.find((x) => x.id === line.tipo_item)?.codigo === 'MUEBLE_MEDIDA'"
                  type="button"
                  role="menuitem"
                  @click="selectMenuAction('spec', index)"
                >
                  Ficha técnica
                </button>
                <button
                  v-if="tipos.find((x) => x.id === line.tipo_item)?.codigo === 'MUEBLE_MEDIDA'"
                  type="button"
                  role="menuitem"
                  @click="selectMenuAction('duplicate', index)"
                >
                  Duplicar mueble
                </button>
                <button type="button" role="menuitem" @click="selectMenuAction('remove', index)">
                  Eliminar
                </button>
              </div>
            </div>
          </Card>
          <p v-if="removedLines.length" role="status" class="undo">
            {{ removedLines.length }} eliminación(es) provisional(es) pendiente(s) de guardar.
            <button type="button" @click="undoRemove">Deshacer última eliminación</button>
          </p>
          <div v-if="!lineas.length && additionMode === 'none'" class="empty empty-products">
            <span class="empty-products__icon"><PackageOpen :size="30" aria-hidden="true" /></span>
            <h3>Aún no agregaste productos.</h3>
            <p>
              Comienza con un producto de catálogo o un mueble a pedido para construir esta
              proforma.
            </p>
            <div class="empty-actions">
              <Button @click="chooseCatalog"
                ><PackageOpen :size="17" aria-hidden="true" />Producto de catálogo</Button
              >
              <Button variant="secondary" @click="chooseManualFurniture"
                ><Sofa :size="17" aria-hidden="true" />Mueble a pedido</Button
              >
            </div>
          </div>
          <p v-if="lineas.some((line) => line.modo_calculo === 'TOTAL_NEGOCIADO')" class="warning">
            Las líneas de importe histórico negociado se conservan sin conversión automática.
          </p>
        </section>

        <section
          v-show="currentStep === 1"
          class="quote-panel client-panel"
          aria-labelledby="cliente-title"
        >
          <div class="section-title">
            <div class="section-title__identity">
              <span class="section-icon"><UserRound :size="22" aria-hidden="true" /></span>
              <div>
                <p class="section-kicker">02 · DESTINATARIO</p>
                <h2 id="cliente-title">Cliente</h2>
                <p>
                  Indica a quién corresponde la cotización. Puedes dejarlo pendiente para el
                  borrador.
                </p>
              </div>
            </div>
          </div>
          <div class="mode" role="radiogroup" aria-label="Origen del cliente">
            <label
              class="client-option"
              :class="{ 'client-option--active': clienteMode === 'pendiente' }"
            >
              <input v-model="clienteMode" type="radio" value="pendiente" />
              <span
                ><strong>Pendiente</strong><small>Completar el cliente más adelante</small></span
              >
            </label>
            <label
              class="client-option"
              :class="{ 'client-option--active': clienteMode === 'existente' }"
            >
              <input v-model="clienteMode" type="radio" value="existente" />
              <span
                ><strong>Existente</strong
                ><small>Seleccionar desde clientes registrados</small></span
              >
            </label>
            <label
              class="client-option"
              :class="{ 'client-option--active': clienteMode === 'nuevo' }"
            >
              <input v-model="clienteMode" type="radio" value="nuevo" />
              <span
                ><strong>Registrar nuevo</strong
                ><small>Registrar al guardar la proforma</small></span
              >
            </label>
          </div>
          <ClienteSelector
            v-if="clienteMode === 'existente'"
            :model-value="header.cliente"
            label="Cliente existente"
            @update:model-value="setExistingClient"
            @select="clienteSeleccionado = $event"
            @input.stop
            @change.stop
          />
          <Card v-if="clienteMode === 'nuevo'" class="client-fields">
            <ClienteFormFields
              :model="nuevoCliente"
              :tipos="tiposCliente"
              :errors="clientErrors"
              :validate="validationAttempted"
              prefix="proforma-cliente"
              @change="updateNuevoCliente"
            />
          </Card>
          <div v-if="clienteMode === 'pendiente'" class="context-note">
            <Info :size="19" aria-hidden="true" />
            <p>Puedes guardar el borrador sin cliente. Para emitir deberás definirlo.</p>
          </div>
        </section>

        <section
          v-show="currentStep === 2"
          class="quote-panel conditions-panel"
          aria-labelledby="condiciones-title"
        >
          <div class="section-title">
            <div class="section-title__identity">
              <span class="section-icon"><SlidersHorizontal :size="22" aria-hidden="true" /></span>
              <div>
                <p class="section-kicker">03 · ACUERDOS</p>
                <h2 id="condiciones-title">Condiciones</h2>
                <p>Especifica los datos comerciales que acompañarán a la proforma.</p>
              </div>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-grid__full">
              <TextField
                v-model="header.titulo"
                name="titulo"
                label="Título"
                :max-length="QUOTE_LIMITS.titulo"
                :error="conditionError('titulo')"
                @blur="conditionsTouched.titulo = true"
              />
              <small>Un título breve que identifique esta cotización.</small>
            </div>
            <fieldset class="currency-choice form-grid__full">
              <legend>Moneda</legend>
              <div class="currency-choice__options">
                <label
                  v-for="moneda in monedas.filter((item) => ['BOB', 'USD'].includes(item.codigo))"
                  :key="moneda.id"
                  class="currency-choice__option"
                  :class="{
                    'currency-choice__option--selected': header.moneda_codigo === moneda.codigo,
                  }"
                >
                  <input
                    v-model="header.moneda_codigo"
                    type="radio"
                    name="moneda"
                    :value="moneda.codigo"
                  />
                  <span
                    ><strong>{{
                      moneda.codigo === 'BOB' ? 'Bolivianos (BOB)' : 'Dólares (USD)'
                    }}</strong
                    ><small>{{
                      moneda.codigo === 'BOB' ? 'Moneda nacional' : 'Cotización en dólares'
                    }}</small></span
                  >
                </label>
              </div>
            </fieldset>
            <TextField
              v-model="header.porcentaje_adelanto"
              name="adelanto"
              label="Adelanto (%)"
              type="text"
              input-mode="decimal"
              input-rule="decimal"
              :max-length="6"
              :error="conditionError('porcentaje_adelanto')"
              @blur="conditionsTouched.porcentaje_adelanto = true"
              hint="Opcional: 0–100 %, hasta 2 decimales."
            />
            <TextField
              v-model="header.plazo_entrega"
              name="plazo"
              label="Plazo de entrega"
              :max-length="QUOTE_LIMITS.plazo_entrega"
              :error="conditionError('plazo_entrega')"
              @blur="conditionsTouched.plazo_entrega = true"
              hint="Máximo 45 caracteres."
            />
            <TextField
              v-model="header.validez_oferta"
              name="validez"
              label="Validez de la oferta (días)"
              type="text"
              input-mode="numeric"
              input-rule="digits"
              :max-length="3"
              :error="conditionError('validez_oferta')"
              @blur="conditionsTouched.validez_oferta = true"
              hint="Opcional: entre 1 y 99 días."
            />
            <label class="quote-textarea form-grid__full" for="quote-observaciones">
              <span>Observaciones</span>
              <textarea
                id="quote-observaciones"
                v-model="header.observaciones"
                name="observaciones"
                rows="4"
                :maxlength="QUOTE_LIMITS.observaciones"
                @blur="conditionsTouched.observaciones = true"
                :aria-invalid="Boolean(conditionError('observaciones'))"
                placeholder="Condiciones adicionales para esta cotización..."
              />
              <small v-if="conditionError('observaciones')" class="condition-error" role="alert">{{
                conditionError('observaciones')
              }}</small>
              <small v-else class="field-count"
                >{{ header.observaciones.length }}/250 caracteres</small
              >
            </label>
          </div>
        </section>

        <section
          v-if="currentStep === 3"
          class="quote-panel review-panel"
          aria-labelledby="revisar-title"
        >
          <div class="section-title">
            <div class="section-title__identity">
              <span class="section-icon"><ClipboardCheck :size="22" aria-hidden="true" /></span>
              <div>
                <p class="section-kicker">04 · COMPROBACIÓN</p>
                <h2 id="revisar-title">Revisar</h2>
                <p>Comprueba los datos registrados antes de guardar o emitir.</p>
              </div>
            </div>
          </div>
          <div class="review-grid">
            <Card class="review-summary-card"
              ><h3><PackageOpen :size="17" aria-hidden="true" />Productos</h3>
              <p>{{ lineas.length }} línea(s)</p>
              <button @click="currentStep = 0">Corregir productos</button></Card
            >
            <Card class="review-summary-card"
              ><h3><UserRound :size="17" aria-hidden="true" />Cliente</h3>
              <p>
                {{
                  clienteMode === 'pendiente'
                    ? 'Pendiente'
                    : clienteMode === 'nuevo'
                      ? nuevoCliente.empresa || `${nuevoCliente.nombres} ${nuevoCliente.apellidos}`
                      : nombreClienteVisible()
                }}
              </p>
              <button @click="currentStep = 1">Corregir cliente</button></Card
            >
            <Card class="review-summary-card"
              ><h3><SlidersHorizontal :size="17" aria-hidden="true" />Condiciones</h3>
              <p>{{ header.plazo_entrega || 'Plazo pendiente' }} · {{ header.moneda_codigo }}</p>
              <button @click="currentStep = 2">Corregir condiciones</button></Card
            >
          </div>
          <Card class="commercial-preview"
            ><div class="preview-brand">
              <span class="preview-mark">H</span>
              <p class="brand">HOMEX · VISTA PREVIA</p>
            </div>
            <h3>{{ header.titulo || 'Cotización comercial' }}</h3>
            <div v-for="line in lineas" :key="line.localId" class="review-line">
              <div v-if="line.producto" class="review-thumbnail">
                <ProductImage :image="quoteImages[line.producto] ?? null" :alt="line.nombre" sizes="48px" />
              </div>
              <span><strong>{{ line.nombre }}</strong> —
              <template v-if="line.modo_calculo === 'TOTAL_NEGOCIADO'">
                importe negociado {{ money(Number(line.importe_negociado || 0)) }}
              </template>
              <template v-else-if="totalEstimadoLinea(line) !== null">
                cantidad {{ line.cantidad }}, precio {{ money(Number(line.precio_unitario)) }}
              </template>
              <template v-else>precio pendiente</template>
              <span v-if="line.descripcion"><br />{{ line.descripcion }}</span></span>
            </div>
            <p v-if="header.plazo_entrega"><strong>Plazo:</strong> {{ header.plazo_entrega }}</p>
            <p v-if="header.validez_oferta">
              <strong>Validez:</strong> {{ header.validez_oferta }} días
            </p>
            <div class="whatsapp-share" @input.stop @change.stop>
              <div class="whatsapp-share__summary">
                <span class="whatsapp-share__icon"
                  ><MessageCircle :size="20" aria-hidden="true"
                /></span>
                <div class="whatsapp-share__heading">
                  <strong>Mensaje para WhatsApp</strong>
                  <small>Personaliza el saludo para acompañar el PDF.</small>
                </div>
                <div class="whatsapp-share__controls">
                  <Button
                    type="button"
                    variant="secondary"
                    :disabled="!canShareWhatsApp || !whatsappDraft.trim()"
                    @click="copyCommercialSummary"
                    >Copiar mensaje</Button
                  >
                  <button
                    type="button"
                    class="whatsapp-share__toggle"
                    :aria-expanded="whatsappExpanded"
                    aria-controls="whatsapp-message-content"
                    :aria-label="
                      whatsappExpanded
                        ? 'Ocultar mensaje de WhatsApp'
                        : 'Mostrar mensaje de WhatsApp'
                    "
                    @click="whatsappExpanded = !whatsappExpanded"
                  >
                    <ChevronUp v-if="whatsappExpanded" :size="20" aria-hidden="true" />
                    <ChevronDown v-else :size="20" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <p v-if="!canShareWhatsApp" class="whatsapp-share__hint">
                Selecciona un cliente o completa los datos del nuevo cliente para copiar el mensaje.
              </p>
              <div
                v-show="whatsappExpanded"
                id="whatsapp-message-content"
                class="whatsapp-share__content"
              >
                <label for="whatsapp-message">Contenido del mensaje</label>
                <textarea
                  id="whatsapp-message"
                  :value="whatsappDraft"
                  rows="5"
                  @input="editWhatsapp(($event.target as HTMLTextAreaElement).value)"
                />
                <div class="whatsapp-share__edit-actions">
                  <small
                    >Al copiar se incluye únicamente el texto. Adjunta el PDF por separado.</small
                  >
                  <Button
                    v-if="whatsappEdited"
                    type="button"
                    variant="secondary"
                    @click="resetWhatsapp"
                    >Restaurar mensaje sugerido</Button
                  >
                </div>
              </div>
            </div></Card
          >
          <div class="totals">
            <template v-if="persisted && !dirty">
              <span>Total confirmado por HOMEX</span>
              <strong>{{ money(Number(persisted.total)) }}</strong>
              <small>Importe guardado y calculado por el servidor.</small>
            </template>
            <template v-else>
              <span>Estimación local</span>
              <strong v-if="totalPreview !== null">{{ money(totalPreview) }}</strong>
              <strong v-else class="pending-value">Total pendiente</strong>
              <small>El total confirmado será el que devuelva HOMEX al guardar.</small>
              <small v-if="persisted">
                Último total guardado: {{ money(Number(persisted.total)) }}. Los cambios actuales
                aún no se guardaron.
              </small>
            </template>
          </div>
          <div v-if="emissionIssues.length" class="emission-checklist">
            <div class="emission-checklist__header">
              <span class="emission-checklist__icon"
                ><ClipboardCheck :size="22" aria-hidden="true"
              /></span>
              <div class="emission-checklist__heading">
                <h3>Verificación de la proforma</h3>
                <p>Completa la información necesaria antes de emitir.</p>
              </div>
              <span class="emission-checklist__count" aria-live="polite">
                {{ emissionIssues.length }}
                {{ emissionIssues.length === 1 ? 'pendiente' : 'pendientes' }}
              </span>
            </div>
            <ul>
              <li v-for="issue in emissionIssues" :key="issue.id">
                <CircleAlert :size="18" aria-hidden="true" />
                <div class="emission-checklist__detail">
                  <strong>{{ issue.title }}</strong>
                  <p>{{ issue.description }}</p>
                </div>
                <button type="button" @click="currentStep = issue.step">
                  {{ issue.action }} <ChevronRight :size="16" aria-hidden="true" />
                </button>
              </li>
            </ul>
          </div>
          <div v-else class="emission-ready" role="status">
            <CheckCircle2 :size="19" aria-hidden="true" />
            <span>
              {{
                isReview
                  ? 'Esta proforma ya está en revisión. Puedes guardar correcciones o consultar su resumen.'
                  : 'Información completa. La proforma está lista para enviar a revisión.'
              }}
            </span>
          </div>
        </section>

        <footer class="editor-actions">
          <div class="editor-actions__inner">
            <div class="editor-actions__navigation">
              <Button variant="secondary" :disabled="currentStep === 0" @click="currentStep--"
                ><ArrowLeft :size="17" aria-hidden="true" />Anterior</Button
              >
              <Button v-if="currentStep < 3" @click="currentStep++"
                >Continuar<ArrowRight :size="17" aria-hidden="true"
              /></Button>
            </div>
            <div class="editor-actions__operations">
              <Button variant="secondary" :processing="saving" @click="persist(false)">{{
                isReview ? 'Guardar cambios' : 'Guardar borrador'
              }}</Button>
              <Button
                v-if="!isReview"
                :disabled="!canEmit"
                :processing="saving"
                @click="requestReview"
                >Enviar a revisión</Button
              >
              <Button
                v-if="persisted"
                variant="secondary"
                @click="router.push({ path: `/proformas/${persisted.id}`, query: listQuery })"
                >Ver resumen y documentos</Button
              >
            </div>
          </div>
        </footer>
      </template>

      <Modal
        :open="Boolean(readingLine)"
        :title="readingLine?.nombre ?? 'Detalle de línea'"
        @close="closeLineRead"
      >
        <div v-if="readingLine" class="read-line">
          <p>
            <strong>Tipo:</strong> {{ tipos.find((x) => x.id === readingLine?.tipo_item)?.nombre }}
          </p>
          <p>
            <strong>SKU:</strong>
            {{
              readMaster?.sku ||
              (readingLine.producto
                ? 'Producto #' + readingLine.producto
                : 'Variante pendiente / mueble a pedido')
            }}
          </p>
          <p>
            <strong>Descripción:</strong>
            {{ readingLine.descripcion || 'Sin descripción adicional' }}
          </p>
          <p>
            <strong>Cantidad:</strong> {{ readingLine.cantidad }}
            {{ unidades.find((x) => x.id === readingLine?.unidad)?.nombre }}
          </p>
          <p v-if="readingLine.familia_producto && !readingLine.producto" role="status">
            Variante pendiente; no se reserva stock.
          </p>
          <p v-if="readingLine.modo_calculo === 'TOTAL_NEGOCIADO'">
            <strong>Importe negociado histórico:</strong> {{ readingLine.importe_negociado }}
          </p>
          <p v-else>
            <strong>Precio unitario cotizado:</strong>
            {{ money(Number(readingLine.precio_unitario)) }}
          </p>
          <p><strong>Descuento:</strong> {{ money(Number(readingLine.descuento)) }}</p>
          <p>
            <strong>Importe estimado:</strong>
            {{
              totalEstimadoLinea(readingLine) === null
                ? 'Pendiente'
                : money(totalEstimadoLinea(readingLine)!)
            }}
          </p>
          <template v-if="readMaster">
            <h3>Datos actuales del catálogo · solo lectura</h3>
            <p>{{ readMaster.nombre }} · {{ readMaster.categoria_info?.nombre }}</p>
            <p>Precio vigente de referencia BOB: {{ readMaster.precio_vigente }}</p>
            <p>Disponibilidad referencial: {{ readMaster.disponibilidad_referencial }}</p>
            <p v-if="readMaster.silla">Silla: {{ readMaster.silla.modelo }}</p>
            <p v-if="readMaster.piso">
              Piso: {{ readMaster.piso.modelo }} · {{ readMaster.piso.espesor_mm }} mm
            </p>
          </template>
          <template v-if="readingLine.especificacion">
            <h3>Ficha técnica · solo lectura</h3>
            <p v-if="readingLine.especificacion.tipo_mueble">
              Tipo de mueble:
              {{
                tiposMueble.find((t) => t.id === readingLine?.especificacion?.tipo_mueble)
                  ?.nombre ?? 'Histórico'
              }}
            </p>
            <p v-if="readingLine.especificacion.observaciones">
              Observaciones: {{ readingLine.especificacion.observaciones }}
            </p>
            <h4>Características y dimensiones</h4>
            <p>{{ readableTechnical(readingTechnical.caracteristicas_generales) }}</p>
            <h4>Conjuntos</h4>
            <ul>
              <li v-for="g in readingTechnical.conjuntos ?? []" :key="g.uid">{{ g.nombre }}</li>
            </ul>
            <h4>Componentes</h4>
            <ul>
              <li v-for="(c, i) in readingTechnical.componentes ?? []" :key="c.uid ?? i">
                <strong>{{ c.nombre }}</strong>
                <span v-if="c.cantidad_interna"> · {{ c.cantidad_interna }} por mueble</span>
                <span v-if="c.material"> · {{ c.material }}</span>
                <span v-if="c.espesor"> · {{ c.espesor }}</span>
                <span v-if="c.color"> · {{ c.color }}</span>
                <span v-if="c.dimensiones"> · {{ readableTechnical(c.dimensiones) }}</span>
                <span v-for="a in c.atributos ?? []" :key="a.codigo || a.nombre">
                  · {{ a.nombre }}: {{ a.valor }} {{ a.unidad ?? '' }}
                </span>
              </li>
            </ul>
            <h4>Accesorios</h4>
            <ul>
              <li v-for="(a, i) in readingTechnical.accesorios ?? []" :key="i">{{ a }}</li>
            </ul>
            <h4 v-if="readingTechnical.advertencias?.length">Información pendiente histórica</h4>
            <ul>
              <li v-for="(a, i) in readingTechnical.advertencias ?? []" :key="i">{{ a }}</li>
            </ul>
            <p v-if="readingTechnical.descripcion_original">
              Descripción original: {{ readingTechnical.descripcion_original }}
            </p>
          </template>
          <div class="actions">
            <Button
              v-if="readingLine.modo_calculo !== 'TOTAL_NEGOCIADO'"
              variant="secondary"
              @click="editReadLine"
              >Editar</Button
            >
            <Button variant="secondary" @click="closeLineRead">Cerrar</Button>
          </div>
        </div>
      </Modal>
      <Modal
        wide
        :open="lineModal"
        :title="editingLine === null ? 'Agregar producto' : 'Editar producto'"
        @close="closeLineModal"
      >
        <DetalleForm
          :key="lineFormVersion"
          :tipos
          :categorias="catalogCategories"
          :unidades
          :familias
          :moneda="header.moneda_codigo"
          :detail="editableDetail"
          :existing-product-ids="existingProductIds"
          :processing="saving"
          :initial-product-id="preferredProductId"
          :initial-draft="pendingLineDraft ?? undefined"
          @save="saveLine"
          @duplicate-product="focusDuplicateProduct"
          @create-product="createProductContextually"
          @changed="lineModalDirty = true"
          @cancel="closeLineModal"
        />
      </Modal>
    </div>
    <MuebleStudio
      v-if="furnitureOpen"
      :key="editableSpecDetail?.localId"
      :form-version="specRenderVersion"
      :galeria-id="editableSpecDetail?.galeria_id"
      :detalle-id="editableSpecDetail?.id"
      @gallery="
        (id) => {
          if (editableSpecDetail) {
            editableSpecDetail.galeria_id = id
            markDirty()
          }
        }
      "
      :nueva="Boolean(draftingFurniture)"
      :dirty="specModalDirty"
      :sesion="sesionBorrador"
      :moneda="header.moneda_codigo === 'USD' ? 'USD' : 'BOB'"
      :proforma="proformaId"
      :tipos="tiposMueble"
      :especificacion="editableSpec"
      :detalle="editableSpecDetail"
      :unidades="unidades"
      :pendientes-asistencia="draftingFurniture ? pendientesAsistencia : []"
      :processing="voiceProcessing"
      :external-error="error"
      @save="saveSpec"
      @type-created="registrarTipoMueble"
      @changed="specModalDirty = true"
      @cancel="closeSpec"
      @applied="aplicarCaptura"
      @processing="voiceProcessing = $event"
    />
  </div>
</template>

<style scoped>
.quote-workspace {
  --quote-shadow: 0 4px 24px rgb(0 0 0 / 4%);
  --quote-muted: color-mix(in srgb, var(--color-surface) 76%, var(--color-background));
  --quote-border: color-mix(in srgb, var(--color-border) 80%, transparent);
  display: grid;
  align-content: start;
  gap: 0;
  padding-bottom: var(--space-8);
}
.quote-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 0.69rem;
  font-weight: 700;
  letter-spacing: 0.11em;
}
.quote-divider {
  padding: 0 var(--space-2);
  color: var(--color-border-strong);
}
.quote-progress {
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.quote-topline__right {
  display: grid;
  justify-items: end;
  flex-shrink: 0;
  gap: var(--space-2);
  max-width: min(100%, 26rem);
  text-align: right;
  letter-spacing: normal;
}
.quote-save-status {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  max-width: 100%;
  color: var(--color-text-secondary);
  font-size: 0.76rem;
  font-weight: 600;
  line-height: 1.35;
}
.quote-save-status svg {
  flex-shrink: 0;
  color: var(--color-text-muted);
}
.quote-save-status--saved svg {
  color: var(--color-success);
}
.quote-save-status--warning,
.quote-save-status--warning svg {
  color: var(--color-danger);
}
.quote-save-reference {
  color: var(--color-text-secondary);
  font-size: 0.68rem;
  font-weight: 500;
}
.quote-workspace :deep(.page-header) {
  margin-bottom: var(--space-6);
}
.quote-workspace :deep(.page-header h1) {
  font-size: clamp(1.65rem, 2.4vw, 2.25rem);
  font-weight: 750;
  letter-spacing: -0.035em;
}
.steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}
.steps button {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 4.1rem;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-weight: 600;
  text-align: left;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}
.steps button:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}
.steps button:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.steps button.active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
}
.step-number {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.6rem;
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 750;
}
.steps button.active .step-number {
  color: #fff;
  background: var(--color-primary);
}
.step-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.step-marker {
  position: absolute;
  right: var(--space-4);
  bottom: -1px;
  left: var(--space-4);
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: transparent;
}
.steps button.active .step-marker {
  background: var(--color-primary);
}
.quote-panel {
  display: grid;
  min-width: 0;
  gap: var(--space-5);
  padding: clamp(1rem, 2.5vw, 2rem);
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  background: var(--color-surface);
  box-shadow: var(--quote-shadow);
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--quote-border);
}
.section-title__identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-4);
}
.section-icon {
  display: grid;
  width: 3.15rem;
  height: 3.15rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 12%, transparent);
  border-radius: 0.85rem;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.section-title h2 {
  margin: 0.1rem 0 0;
  color: var(--color-text);
  font-size: 1.35rem;
  letter-spacing: -0.025em;
}
.section-title p:not(.section-kicker) {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
}
.section-kicker {
  margin: 0;
  color: var(--color-primary-accent);
  font-size: 0.67rem;
  font-weight: 750;
  letter-spacing: 0.12em;
}
.section-title__tools {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.count-pill {
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  font-weight: 650;
  white-space: nowrap;
}
.choice-panel {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--quote-muted);
}
.choice-panel__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}
.choice-panel h3 {
  margin: var(--space-1) 0;
  font-size: 1.05rem;
}
.choice-panel__heading p:last-child {
  margin: var(--space-2) 0 0;
  color: var(--color-text-secondary);
}
.choice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.choice-card {
  display: flex;
  min-width: 0;
  min-height: 7.75rem;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    transform var(--transition-fast);
}
.choice-card:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  transform: translateY(-1px);
}
.choice-card:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.choice-card > svg {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--color-text-secondary);
}
.choice-card__icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--radius-card);
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
}
.choice-card__copy {
  display: grid;
  min-width: 0;
  gap: 0.45rem;
}
.choice-card__copy strong {
  font-size: 0.95rem;
}
.choice-card__copy small {
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.empty-products {
  display: grid;
  min-height: 16rem;
  justify-items: center;
  align-content: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-5);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-card);
  background: var(--quote-muted);
  text-align: center;
}
.empty-products__icon {
  display: grid;
  width: 4rem;
  height: 4rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  background: var(--color-surface);
  color: var(--color-primary-accent);
}
.empty-products h3 {
  margin: var(--space-2) 0 0;
  font-size: 1.12rem;
}
.empty-products p {
  max-width: 32rem;
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
}
.line-card {
  display: flex;
  position: relative;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border-color: var(--quote-border);
  box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
}
.line-card:hover {
  border-color: var(--color-border-strong);
}
.line-index {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.6rem;
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  font-weight: 700;
}
.line-summary {
  min-width: 0;
  flex: 1;
  cursor: pointer;
}
.line-summary strong {
  display: block;
  overflow-wrap: anywhere;
  font-size: 0.94rem;
}
.line-summary p {
  margin: var(--space-2) 0 0;
  color: var(--color-text-secondary);
  font-size: 0.83rem;
}
.line-summary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
  border-radius: 2px;
}
.line-card > strong {
  flex: 0 0 auto;
  color: var(--color-text);
  white-space: nowrap;
}
.line-menu {
  position: relative;
  z-index: 30;
  flex: 0 0 auto;
}
.menu-trigger {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 1.25rem;
  cursor: pointer;
}
.menu-trigger:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}
.menu-panel {
  position: absolute;
  z-index: 10;
  top: calc(100% + 0.3rem);
  right: 0;
  display: grid;
  min-width: 11rem;
  gap: 0.15rem;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-raised);
  box-shadow: 0 12px 26px rgb(0 0 0 / 16%);
}
.menu-panel button {
  padding: 0.65rem 0.8rem;
  border: 0;
  border-radius: 0.35rem;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}
.menu-panel button:hover:not(:disabled),
.menu-panel button:focus-visible {
  background: var(--color-surface-hover);
}
.menu-panel button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.undo,
.context-note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--quote-muted);
  color: var(--color-text-secondary);
}
.context-note svg {
  flex-shrink: 0;
  color: var(--color-info);
}
.context-note p {
  margin: 0;
}
.undo button {
  border: 0;
  background: transparent;
  color: var(--color-primary-accent);
  text-decoration: underline;
  cursor: pointer;
}
.client-panel {
  align-content: start;
}
.mode {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}
.client-option {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}
.client-option:hover {
  border-color: var(--color-border-strong);
  background: var(--quote-muted);
}
.client-option--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}
.client-option input {
  margin-top: 0.2rem;
  flex: 0 0 auto;
  accent-color: var(--color-primary);
}
.client-option span {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
}
.client-option strong {
  font-size: 0.87rem;
}
.client-option small {
  color: var(--color-text-secondary);
  line-height: 1.45;
}
.client-option:focus-within {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.client-fields {
  border-color: var(--quote-border);
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
}
.form-grid__full {
  grid-column: 1 / -1;
}
.form-grid__full > small {
  display: block;
  margin-top: var(--space-2);
  color: var(--color-text-secondary);
}
.quote-textarea {
  display: grid;
  gap: var(--space-2);
  color: var(--color-text);
  font-weight: 600;
}
.quote-textarea textarea {
  display: block;
  width: 100%;
  min-height: 7.5rem;
  resize: vertical;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 400;
  line-height: 1.6;
}
.quote-textarea textarea::placeholder {
  color: var(--color-text-muted);
}
.quote-textarea textarea:hover {
  border-color: var(--color-text-muted);
}
.quote-textarea textarea:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 1px;
}
.review-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}
.review-summary-card {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-4);
  background: var(--quote-muted);
  border-color: var(--quote-border);
}
.review-summary-card h3 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: 0.84rem;
}
.review-summary-card h3 svg {
  color: var(--color-primary-accent);
}
.review-summary-card p {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--color-text-secondary);
}
.review-summary-card button {
  justify-self: start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary-accent);
  cursor: pointer;
  font-weight: 650;
}
.review-summary-card button:hover {
  text-decoration: underline;
}
.commercial-preview {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-6);
  border-color: var(--quote-border);
}
.preview-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--quote-border);
}
.preview-mark {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.45rem;
  background: var(--color-primary);
  color: #fff;
  font-weight: 800;
}
.brand {
  margin: 0;
  color: var(--color-primary-accent);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.1em;
}
.commercial-preview h3 {
  margin: 0;
  font-size: 1.2rem;
  letter-spacing: -0.02em;
}
.review-line {
  margin: 0;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--quote-border);
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.review-line strong {
  color: var(--color-text);
}
.commercial-preview :deep(.button) {
  justify-self: start;
}
.totals {
  display: grid;
  justify-items: end;
  gap: var(--space-2);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-raised);
  text-align: right;
}
.totals span {
  color: var(--color-text-secondary);
  font-weight: 650;
}
.totals strong {
  color: var(--color-text);
  font-size: clamp(1.5rem, 3vw, 2rem);
  letter-spacing: -0.04em;
}
.totals small {
  color: var(--color-text-secondary);
}
.error,
.warning {
  color: var(--color-danger);
}
.error-summary,
.warning {
  margin: 0;
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-danger) 24%, var(--color-border));
  border-radius: var(--radius-card);
  background: var(--color-danger-soft);
}
.error-summary ul,
.warning ul {
  margin-bottom: 0;
}
.success {
  margin: 0 0 var(--space-3);
  color: var(--color-success);
  font-weight: 650;
}
.pending-value {
  color: var(--color-warning);
}
.read-line {
  display: grid;
  gap: var(--space-2);
}
.read-line p {
  margin: 0;
  overflow-wrap: anywhere;
}
.read-line pre {
  max-width: 100%;
  overflow: auto;
  white-space: pre-wrap;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.editor-actions {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: var(--space-5);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-background) 96%, transparent);
  backdrop-filter: blur(12px);
}
.editor-actions__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 0 var(--space-2);
}
.editor-actions__navigation,
.editor-actions__operations {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.editor-actions__operations {
  justify-content: flex-end;
}
.editor-actions :deep(.button) {
  white-space: normal;
  text-align: center;
}
@media (max-width: 64rem) {
  .steps button {
    justify-content: center;
    padding: var(--space-3);
    gap: var(--space-2);
  }
  .choice-card {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .choice-card > svg {
    margin-left: auto;
  }
}
@media (max-width: 48rem) {
  .steps button {
    min-height: 3.7rem;
  }
  .step-number {
    width: 1.7rem;
    height: 1.7rem;
  }
  .quote-panel {
    padding: var(--space-5);
  }
  .mode,
  .review-grid {
    grid-template-columns: 1fr;
  }
  .editor-actions__inner {
    flex-direction: column;
    align-items: stretch;
  }
  .editor-actions__navigation,
  .editor-actions__operations {
    justify-content: flex-end;
  }
  .editor-actions__navigation {
    justify-content: space-between;
  }
}
@media (max-width: 36rem) {
  .quote-topline {
    align-items: flex-start;
  }
  .steps {
    gap: 0.35rem;
  }
  .steps button {
    min-height: 4.25rem;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.55rem 0.25rem;
    text-align: center;
  }
  .step-label {
    width: 100%;
    font-size: 0.69rem;
  }
  .step-marker {
    right: 0.3rem;
    left: 0.3rem;
  }
  .section-title {
    align-items: stretch;
    flex-direction: column;
  }
  .section-title__identity {
    align-items: flex-start;
    gap: var(--space-3);
  }
  .section-icon {
    width: 2.6rem;
    height: 2.6rem;
  }
  .section-title__tools :deep(.button) {
    flex: 1;
  }
  .choice-panel__heading {
    flex-direction: column;
  }
  .choice-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }
  .form-grid__full {
    grid-column: auto;
  }
  .choice-card {
    min-height: 5.5rem;
    flex-wrap: nowrap;
  }
  .empty-products {
    padding: var(--space-6) var(--space-3);
  }
  .empty-actions {
    width: 100%;
  }
  .empty-actions :deep(.button) {
    width: 100%;
  }
  .line-card {
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .line-summary {
    flex-basis: calc(100% - 4rem);
  }
  .line-card > strong {
    margin-left: 3rem;
  }
  .line-menu {
    margin-left: auto;
  }
  .editor-actions {
    position: static;
  }
  .editor-actions__navigation,
  .editor-actions__operations {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .editor-actions__operations :deep(.button:last-child:nth-child(3)) {
    grid-column: 1 / -1;
  }
  .editor-actions :deep(.button) {
    min-width: 0;
    width: 100%;
  }
  .commercial-preview,
  .totals {
    padding: var(--space-4);
  }
}
@media (prefers-reduced-motion: reduce) {
  .steps button,
  .choice-card,
  .client-option {
    transition: none;
    transform: none;
  }
}

.currency-choice {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.currency-choice legend {
  margin-bottom: var(--space-2);
  color: var(--color-text);
  font-weight: 600;
}
.currency-choice__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.currency-choice__option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  cursor: pointer;
}
.currency-choice__option--selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}
.currency-choice__option:hover {
  border-color: var(--color-border-strong);
}
.currency-choice__option:focus-within {
  box-shadow: var(--focus-ring);
}
.currency-choice__option input {
  accent-color: var(--color-primary);
}
.currency-choice__option span {
  display: grid;
  gap: var(--space-1);
}
.currency-choice__option small {
  color: var(--color-text-secondary);
}
.condition-error {
  color: var(--color-danger);
}
.field-count {
  color: var(--color-text-secondary);
  justify-self: end;
  font-weight: 400;
}
.whatsapp-share {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.whatsapp-share__summary {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.whatsapp-share__icon {
  display: grid;
  flex: 0 0 auto;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-raised);
  color: var(--color-success);
}
.whatsapp-share__heading {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: var(--space-1);
}
.whatsapp-share__heading strong {
  color: var(--color-text);
  font-size: 0.9rem;
}
.whatsapp-share__heading small,
.whatsapp-share__hint {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  line-height: 1.5;
}
.whatsapp-share__controls {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: var(--space-2);
}
.whatsapp-share__toggle {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
}
.whatsapp-share__toggle:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}
.whatsapp-share__toggle:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.whatsapp-share__hint {
  margin: 0;
  padding-left: 3.25rem;
}
.whatsapp-share__content {
  display: grid;
  gap: var(--space-2);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.whatsapp-share__content label {
  color: var(--color-text);
  font-weight: 600;
}
.whatsapp-share__content textarea {
  width: 100%;
  min-height: 10rem;
  padding: var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  line-height: 1.65;
  resize: vertical;
}
.whatsapp-share__content textarea:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 1px;
}
.whatsapp-share__edit-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.whatsapp-share__edit-actions small {
  color: var(--color-text-secondary);
}
.emission-checklist,
.emission-ready {
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-raised);
}
.emission-checklist {
  display: grid;
  gap: var(--space-4);
}
.emission-checklist__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.emission-checklist__icon {
  display: grid;
  width: 2.7rem;
  height: 2.7rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}
.emission-checklist__heading {
  flex: 1;
  min-width: 0;
}
.emission-checklist__heading h3 {
  margin: 0;
  color: var(--color-text);
  font-size: 1rem;
}
.emission-checklist__heading p {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
  font-size: 0.82rem;
}
.emission-checklist__count {
  flex-shrink: 0;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  font-size: 0.75rem;
  font-weight: 650;
  white-space: nowrap;
}
.emission-checklist ul {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.emission-checklist li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) 0;
  border-top: 1px solid var(--color-border);
}
.emission-checklist li > svg {
  flex: 0 0 auto;
  color: var(--color-warning);
}
.emission-checklist__detail {
  display: grid;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}
.emission-checklist__detail strong {
  color: var(--color-text);
  font-size: 0.86rem;
}
.emission-checklist__detail p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  overflow-wrap: anywhere;
}
.emission-checklist li button {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-primary-accent);
  cursor: pointer;
  font-weight: 650;
  font-size: 0.81rem;
}
.emission-checklist li button:hover,
.emission-checklist li button:focus-visible {
  background: var(--color-primary-soft);
}
.emission-ready {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text);
}
.emission-ready svg {
  flex-shrink: 0;
  color: var(--color-success);
}
@media (max-width: 36rem) {
  .currency-choice__options {
    grid-template-columns: 1fr;
  }
  .quote-topline {
    flex-wrap: wrap;
  }
  .quote-topline__right {
    margin-left: auto;
  }
  .whatsapp-share__summary {
    flex-wrap: wrap;
  }
  .whatsapp-share__controls {
    width: 100%;
    justify-content: flex-end;
  }
  .whatsapp-share__hint {
    padding-left: 0;
  }
  .emission-checklist__header {
    flex-wrap: wrap;
  }
  .emission-checklist__count {
    margin-left: auto;
  }
  .emission-checklist li {
    flex-wrap: wrap;
  }
  .emission-checklist li button {
    margin-left: auto;
  }
}
.line-heading { display: flex; gap: .8rem; align-items: center; min-width: 0; }
.line-heading strong { overflow-wrap: anywhere; }
.line-thumbnail { width: 4rem; height: 4rem; flex: none; overflow: hidden;
  border: 1px solid var(--color-border); border-radius: var(--radius-control); }
.line-thumbnail :deep(.product-image) { width: 100%; height: 100%; min-height: 0; aspect-ratio: 1 !important; }
.line-thumbnail :deep(.fallback span) { display: none; }
.review-thumbnail { flex: none; width: 3rem; height: 3rem; border-radius: var(--radius-control); overflow: hidden; }
.review-thumbnail :deep(.product-image) { width: 100%; height: 100%; min-height: 0; aspect-ratio: 1 !important; }
.review-thumbnail :deep(.fallback span) { display: none; }
.review-line { display: flex; align-items: center; gap: .6rem; }
</style>
