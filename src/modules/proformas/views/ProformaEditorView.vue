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
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  CircleX,
  MessageCircle,
  CircleAlert,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  Coins,
  Info,
  PackageOpen,
  Plus,
  ReceiptText,
  RotateCcw,
  SlidersHorizontal,
  Sofa,
  UserCheck,
  UserPlus,
  UserRound,
  Pencil,
  Copy,
  Trash2,
  Wrench,
  Save,
  Send,
  Eye,
  FileText,
} from '@lucide/vue'
import Button from '@/shared/ui/Button.vue'
import Badge from '@/shared/ui/Badge.vue'
import Card from '@/shared/ui/Card.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import Modal from '@/shared/ui/Modal.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Toast from '@/shared/ui/Toast.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog.vue'
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
import ProductoVistaRapida from '@/modules/productos/components/ProductoVistaRapida.vue'
import GalleryPhoto from '@/shared/media/GalleryPhoto.vue'
import { useQuoteFurnitureCovers } from '../composables/useQuoteFurnitureCovers'
import { useQuoteProductImages } from '../composables/useQuoteProductImages'
import {
  cloneEditorData,
  consumeEditorDraft,
  removeLocalLine,
  restoreLocalLine,
  saveEditorDraft,
} from '../services/editorLocal'
import { totalEstimadoCompleto, totalEstimadoLinea } from '../services/presentacionComercial'
import { downloadBlob } from '@/shared/download/downloadBlob'
import DocumentViewerModal from '../components/DocumentViewerModal.vue'
import { useProformaPdf } from '../composables/useProformaPdf'

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
const steps = [
  { id: 'productos', titulo: 'Productos', icono: PackageOpen },
  { id: 'cliente', titulo: 'Cliente', icono: UserRound },
  { id: 'condiciones', titulo: 'Condiciones', icono: SlidersHorizontal },
  { id: 'revision', titulo: 'Revisar', icono: ClipboardCheck },
] as const
const currentStep = ref(0)
const loading = ref(Boolean(proformaId.value))
const saving = ref(false)
const referenceLoading = ref(true)
const error = ref('')
const success = ref('')
const errorToast = ref('')
watch(error, (message) => {
  if (message) {
    success.value = ''
    errorToast.value = message
  }
})
watch(success, (message) => {
  if (message) errorToast.value = ''
})
const fields = ref<Record<string, string[]>>({})
const validationAttempted = ref(false)
const emissionAttempted = ref(false)
const localErrors = ref<Record<string, string>>({})
const conditionsTouched = ref<Record<string, boolean>>({})
function conditionError(field: keyof ReturnType<typeof validateQuoteConditions>): string {
  return (
    localErrors.value[field] ||
    (conditionsTouched.value[field] || validationAttempted.value
      ? validateQuoteConditions(header, { forEmission: emissionAttempted.value })[field] || ''
      : '')
  )
}
const dirty = ref(false)
const savedContent = ref('')
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
const readLoading = ref(false)
const readError = ref('')
let readRequestId = 0
const specLine = ref<number | null>(null)
const draftingFurniture = ref<LineaLocal | null>(null)
const studioRef = ref<InstanceType<typeof MuebleStudio> | null>(null)
const lineFormRef = ref<InstanceType<typeof DetalleForm> | null>(null)
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
    if (result.texto_transcrito_original && linea.especificacion) {
      const dt = leerDatosTecnicos(linea.especificacion.datos_tecnicos)
      if (!dt.descripcion_original) {
        dt.descripcion_original = result.texto_transcrito_original
        linea.especificacion.datos_tecnicos = dt
      }
    }
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
const confirmation = ref<{
  title: string
  description: string
  confirmLabel: string
  saveLabel?: string
  onSave?: () => void | Promise<void>
} | null>(null)
let confirmResolver: ((answer: boolean) => void) | null = null
function askConfirmation(
  description: string,
  title = 'Confirmar acción',
  confirmLabel = 'Continuar',
  saveLabel?: string,
  onSave?: () => void | Promise<void>,
) {
  if (confirmResolver) confirmResolver(false)
  confirmation.value = { title, description, confirmLabel, saveLabel, onSave }
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
async function saveConfirmation() {
  const callback = confirmation.value?.onSave
  answerConfirmation(false)
  await callback?.()
}
const leaveDialog = ref(false)
const leaveSaving = ref(false)
const leaveSaveError = ref('')
let leaveResolver: ((allowed: boolean) => void) | null = null
function askLeaveConfirmation(): Promise<boolean> {
  if (leaveResolver) leaveResolver(false)
  leaveDialog.value = true
  leaveSaveError.value = ''
  return new Promise<boolean>((resolve) => {
    leaveResolver = resolve
  })
}
function discardLeave() {
  if (leaveSaving.value) return
  sessionStorage.removeItem(`homex:ap5:draft:${autosaveToken()}`)
  answerLeave(true)
}
function answerLeave(allowed: boolean) {
  if (leaveSaving.value) return
  leaveDialog.value = false
  leaveSaveError.value = ''
  const resolve = leaveResolver
  leaveResolver = null
  resolve?.(allowed)
}
async function saveAndLeave() {
  if (leaveSaving.value || saving.value) return
  leaveSaving.value = true
  leaveSaveError.value = ''
  try {
    const saved = await persist(false, true)
    if (!saved) {
      leaveSaveError.value = error.value || 'No se pudieron guardar los cambios.'
      return
    }
  } catch (cause) {
    leaveSaveError.value =
      cause instanceof Error ? cause.message : 'No se pudo guardar la proforma.'
    return
  } finally {
    leaveSaving.value = false
  }
  answerLeave(true)
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
const isClientStepComplete = computed(() => {
  if (clienteMode.value === 'existente') return Boolean(header.cliente)
  if (clienteMode.value === 'nuevo') {
    if (!nuevoCliente.tipo_cliente) return false
    const tipo = tiposCliente.value.find((item) => String(item.id) === nuevoCliente.tipo_cliente)
    return Object.keys(validateClient(nuevoCliente, tipo?.codigo === 'EMPRESA')).length === 0
  }
  return false
})
const isConditionsStepComplete = computed(() => {
  return Object.keys(validateQuoteConditions(header, { forEmission: true })).length === 0
})
function isStepComplete(index: number): boolean {
  if (index === 0) return lineas.value.length > 0
  if (index === 1) return isClientStepComplete.value
  if (index === 2) return isConditionsStepComplete.value
  return false
}
const existingProductIds = computed(() =>
  lineas.value.flatMap((line) => (line.producto ? [line.producto] : [])),
)
const {
  images: quoteImages,
  ensure: ensureQuoteImages,
  remember: rememberQuoteImage,
} = useQuoteProductImages()
watch(existingProductIds, (ids) => void ensureQuoteImages(ids), { immediate: true })
const {
  coverFor: furnitureCoverFor,
  galleryFor: furnitureGalleryFor,
  ensureLines: ensureFurnitureCovers,
  refreshLine: refreshFurnitureCover,
} = useQuoteFurnitureCovers()
function onFurnitureGalleryChanged() {
  specModalDirty.value = true
  const line = editableSpecDetail.value
  if (line) void refreshFurnitureCover(line, proformaId.value)
}
watch(
  () => lineas.value.map((line) => `${line.id ?? ''}:${line.galeria_id ?? ''}`).join('|'),
  () => void ensureFurnitureCovers(lineas.value, proformaId.value),
  { immediate: true },
)
function furnitureCoverSource(line: LineaLocal) {
  const cover = furnitureCoverFor(line, proformaId.value)
  return cover?.variantes?.['320'] ?? cover?.url ?? ''
}
function canEditCatalogProduct(product: Producto): boolean {
  return (
    session.can('comercial.administrar') ||
    (session.can('catalogo.crear_producto') && product.created_by === session.identity?.id)
  )
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
  const errors = validateQuoteConditions(header, { forEmission: true })
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
const readingLineForViewer = computed(() => {
  const line = readingLine.value
  if (!line) return null
  const estimated = totalEstimadoLinea(line)
  return {
    ...line,
    tipo_item_info: tipos.value.find((item) => item.id === line.tipo_item) ?? {
      nombre: 'No especificado',
    },
    unidad_info: unidades.value.find((item) => item.id === line.unidad) ?? {
      nombre: 'No especificada',
    },
    total: estimated === null ? 'Pendiente' : money(estimated),
  } as unknown as DetalleProforma
})
const readingFurnitureGallery = computed(() => {
  const line = readingLine.value
  return line ? furnitureGalleryFor(line, proformaId.value) : []
})
const readingProductGalleryEndpoint = computed(() =>
  readingLine.value?.producto
    ? `/api/v1/catalogo/productos/${readingLine.value.producto}/imagenes/`
    : '',
)
async function openLineRead(id: string) {
  readingLineId.value = id
  menuLineId.value = null
  readMaster.value = null
  readError.value = ''
  const token = ++readRequestId
  const productId = readingLine.value?.producto
  if (!productId) {
    if (readingLine.value) void ensureFurnitureCovers([readingLine.value], proformaId.value)
    return
  }
  readLoading.value = true
  try {
    const product = await productosService.get(productId)
    if (token === readRequestId) readMaster.value = product
  } catch {
    if (token === readRequestId)
      readError.value = 'No se pudieron cargar los datos actuales del catálogo.'
  } finally {
    if (token === readRequestId) readLoading.value = false
  }
}
function closeLineRead() {
  readRequestId++
  readingLineId.value = null
  readMaster.value = null
  readLoading.value = false
  readError.value = ''
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
    const condition = validateQuoteConditions(header, { forEmission: emissionAttempted.value })
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
function unitName(unitId: number) {
  return unidades.value.find((unit) => unit.id === unitId)?.nombre ?? 'unidad'
}
function formatQuantity(val: string | number | null | undefined): string {
  if (val == null || val === '') return ''
  const str = String(val).trim()
  const num = Number.parseFloat(str)
  if (!Number.isFinite(num)) return str
  if (num === Math.trunc(num)) return String(Math.trunc(num))
  return String(Number(num.toFixed(4)))
}
function itemTypeLabel(line: LineaLocal): string {
  if (line.tipo_item) {
    const found = tipos.value.find((x) => x.id === Number(line.tipo_item))
    if (found?.nombre) return found.nombre
  }
  return line.producto ? 'Catálogo' : 'Mueble a medida'
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

const documentModalOpen = ref(false)
const downloadingDocument = ref(false)

const {
  blob: documentBlob,
  url: documentUrl,
  loading: documentLoading,
  error: documentError,
  load: loadDocument,
  clear: clearDocument,
} = useProformaPdf()
watch(documentModalOpen, (open) => {
  if (open && persisted.value?.id) void loadDocument(persisted.value.id)
  else clearDocument()
})
function openDocumentPreview() {
  if (!persisted.value?.id) {
    error.value = 'Guarda primero el borrador para generar el PDF.'
    return
  }
  documentModalOpen.value = true
}

async function downloadDocumentPdf() {
  if (downloadingDocument.value) return
  if (!persisted.value?.id) {
    error.value = 'Guarda primero la proforma para descargar el PDF.'
    return
  }
  const opened = documentModalOpen.value
  downloadingDocument.value = true
  try {
    const file = (opened && documentBlob.value) || (await loadDocument(persisted.value.id))
    if (!file) {
      if (!opened) error.value = documentError.value || 'No se pudo generar el PDF.'
      return
    }
    const prefix = isReview.value
      ? 'proforma-revision'
      : persisted.value.estado_info.codigo === 'BORRADOR'
        ? 'proforma-borrador'
        : 'proforma'
    downloadBlob(file, `${prefix}-${persisted.value.numero}.pdf`)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo descargar el PDF.'
  } finally {
    downloadingDocument.value = false
    if (!opened) clearDocument()
  }
}

function fill(value: Proforma) {
  clearDocument()
  persisted.value = value
  header.cliente = value.cliente ? String(value.cliente) : ''
  header.titulo = value.titulo ?? ''
  header.moneda_codigo = value.moneda_info.codigo
  header.plazo_entrega = value.plazo_entrega ?? ''
  header.validez_oferta = value.validez_oferta ? String(value.validez_oferta) : ''
  header.porcentaje_adelanto = value.porcentaje_adelanto
    ? String(Math.round(Number(value.porcentaje_adelanto)))
    : ''
  header.observaciones = value.observaciones ?? ''
  clienteMode.value = value.cliente ? 'existente' : 'pendiente'
  clienteSeleccionado.value = value.cliente_resumen ?? null
  lineas.value = value.detalles.map(normalizeLine)
  removedLines.value = []
  savedContent.value = currentContent()
  dirty.value = false
}

const lastPedidoId = ref<number | null>(null)
const transitionConfirm = ref<'approve' | 'not-completed' | 'reopen' | 'cancel' | null>(null)
const transitioning = ref(false)

const stateCode = computed(() => persisted.value?.estado_info.codigo ?? '')
const inReview = computed(() => ['EN_REVISION', 'ENVIADA'].includes(stateCode.value))
const canApprove = computed(
  () =>
    inReview.value &&
    Boolean(persisted.value?.cliente) &&
    Boolean(lineas.value.length) &&
    Number(persisted.value?.total ?? 0) > 0,
)
const tone = computed<'neutral' | 'success' | 'warning' | 'danger' | 'info'>(() => {
  if (stateCode.value === 'APROBADA') return 'success'
  if (stateCode.value === 'EN_REVISION') return 'warning'
  if (stateCode.value === 'ENVIADA') return 'info'
  if (stateCode.value === 'NO_CONCRETADA') return 'danger'
  if (stateCode.value === 'CANCELADA') return 'danger'
  return 'neutral'
})

async function confirmStatusTransition(action: 'approve' | 'not-completed' | 'reopen' | 'cancel') {
  if (transitioning.value || !persisted.value) return
  if (hasRealChanges.value || hasPendingEdits.value) {
    const shouldSave = await askConfirmation(
      'Hay cambios sin guardar. Para cambiar el estado de la proforma es necesario guardar los cambios primero. ¿Deseas guardarlos ahora?',
      'Guardar cambios pendientes',
      'Guardar y continuar',
    )
    if (!shouldSave) return
    const saved = await persist(false, true)
    if (!saved) return
  }
  transitionConfirm.value = action
}

async function executeTransition() {
  const action = transitionConfirm.value
  if (!action || transitioning.value || !persisted.value) return
  const id = persisted.value.id
  transitionConfirm.value = null
  transitioning.value = true
  error.value = ''
  success.value = ''
  try {
    if (action === 'approve') {
      if (!canApprove.value) {
        error.value = 'La proforma no cumple con las condiciones para ser aprobada.'
        return
      }
      const result = await proformasService.approve(id)
      lastPedidoId.value = result.pedido_id
      success.value = `Proforma aprobada. Pedido #${result.pedido_id} confirmado.`
    } else if (action === 'cancel') {
      await proformasService.cancel(id)
      success.value = 'Proforma anulada.'
    } else if (action === 'not-completed') {
      await proformasService.markNotCompleted(id)
      success.value = 'Proforma marcada como no concretada.'
    } else {
      await proformasService.reopen(id)
      success.value = 'Proforma reabierta en revisión.'
    }
    const updated = await proformasService.get(id)
    fill(updated)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'No se pudo completar la acción.'
    error.value =
      cause instanceof ApiError && cause.status === 409
        ? `${message} Se actualizará el estado para que puedas revisar la proforma.`
        : message
    try {
      const updated = await proformasService.get(id)
      fill(updated)
    } catch {
      error.value += ' No se pudo consultar el estado actualizado.'
    }
  } finally {
    transitioning.value = false
  }
}
async function load() {
  if (!proformaId.value) return
  loading.value = true
  try {
    const value = await proformasService.get(proformaId.value)
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
      'Hay cambios sin guardar en la ficha técnica. ¿Deseas guardarlos o descartarlos?',
      'Descartar ficha técnica',
      'Descartar cambios',
      'Guardar cambios',
      async () => {
        await studioRef.value?.save()
      },
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
    errorToast.value = 'El borrador temporal caducó. Recupera la última proforma guardada.'
    return
  }
  if (snapshot.userId != null && snapshot.userId !== session.identity?.id) {
    errorToast.value = 'Este borrador temporal corresponde a otra sesión y no será restaurado.'
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
  const created = Number(route.query.productoCreado)
  // Cancelar la creación contextual no debe reabrir el editor antiguo de líneas.
  lineModal.value = Boolean(created && pendingLineDraft.value)
  if (!created) {
    if (snapshot.lineDraft) {
      currentStep.value = 0
      additionMode.value = 'catalog'
      catalogInitialized.value = true
    }
    pendingLineDraft.value = null
    lineModalDirty.value = false
    editingLine.value = null
  }
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
function currentContent() {
  const data = body(false)
  return JSON.stringify([
    data.cliente,
    data.cliente_nuevo,
    data.titulo,
    data.moneda_codigo,
    data.plazo_entrega,
    data.validez_oferta,
    data.porcentaje_adelanto,
    data.observaciones,
    data.detalles,
  ])
}
const hasRealChanges = computed(
  () => Boolean(savedContent.value) && currentContent() !== savedContent.value,
)
const hasPendingEdits = computed(
  () =>
    (lineModal.value
      ? (lineFormRef.value?.hasRealChanges ?? lineModalDirty.value)
      : lineModalDirty.value) ||
    (furnitureOpen.value
      ? (studioRef.value?.hasRealChanges ?? specModalDirty.value)
      : specModalDirty.value),
)
const documentNotice = computed(() => {
  if (!hasRealChanges.value && !hasPendingEdits.value) return ''
  const saveAction = isReview.value ? 'Guardar cambios' : 'Guardar borrador'
  return (
    'Hay cambios sin guardar o ediciones pendientes. El PDF refleja los datos guardados en el servidor, no los cambios pendientes. ' +
    'Cierra el visor, incorpora las ediciones pendientes con Guardar línea o desde la ficha del mueble, ' +
    `pulsa «${saveAction}» y vuelve a abrir Vista previa PDF para generar el documento actualizado.`
  )
})
async function requestReview() {
  if (saving.value) return
  if (!canEmit.value) {
    emissionAttempted.value = true
    validationAttempted.value = true
    localErrors.value = validateQuoteConditions(header, { forEmission: true })
    if (Object.keys(localErrors.value).length) {
      error.value = 'Revisa las condiciones requeridas antes de enviar a revisión.'
      currentStep.value = 2
    }
    return
  }
  const confirmed = await askConfirmation(
    'La proforma se guardará y pasará a revisión. Todavía no se creará un pedido; la aprobación es una acción posterior.',
    'Enviar proforma a revisión',
    'Enviar a revisión',
  )
  if (confirmed) await persist(true)
}
async function persist(emitir: boolean, skipNavigation = false): Promise<boolean> {
  if (saving.value || (emitir && (isReview.value || !canEmit.value))) return false
  if (hasPendingEdits.value) {
    error.value =
      'Incorpora primero las ediciones pendientes con Guardar línea o desde la ficha del mueble antes de guardar la proforma.'
    return false
  }
  validationAttempted.value = true
  if (emitir) emissionAttempted.value = true
  localErrors.value = validateQuoteConditions(header, { forEmission: emitir })
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
    return false
  }
  saving.value = true
  error.value = ''
  success.value = ''
  conflicted.value = false
  fields.value = {}
  let completed = false
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
    if (documentModalOpen.value) void loadDocument(result.id)
    removedLines.value = []
    key.value = crypto.randomUUID()
    success.value = emitir
      ? 'Proforma enviada a revisión.'
      : result.estado_info.codigo === 'EN_REVISION'
        ? 'Cambios guardados en la proforma en revisión.'
        : 'Borrador guardado.'
    allowNavigationAfterSave = true
    if (!skipNavigation) {
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
    }
    completed = true
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
  return completed
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
  return askLeaveConfirmation()
})
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  await Promise.all([loadReferences(), load()])
  if (!persisted.value) savedContent.value = currentContent()
  restoreContextualDraft()
  editorReady.value = true
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div class="quote-workspace" @input="markDirty" @change="markDirty">
    <Toast :visible="Boolean(success)" :message="success" tone="success" @close="success = ''" />
    <Toast
      :visible="Boolean(errorToast) && !loading && !referenceLoading"
      :message="errorToast"
      tone="danger"
      @close="errorToast = ''"
    />
    <ConfirmDialog
      :open="Boolean(transitionConfirm)"
      :variant="
        transitionConfirm === 'approve'
          ? 'success'
          : transitionConfirm === 'not-completed' || transitionConfirm === 'cancel'
            ? 'danger'
            : 'info'
      "
      :title="
        transitionConfirm === 'approve'
          ? 'Aprobar y crear pedido'
          : transitionConfirm === 'cancel'
            ? 'Anular proforma'
            : transitionConfirm === 'not-completed'
              ? 'Marcar como no concretada'
              : 'Reabrir en revisión'
      "
      :description="
        transitionConfirm === 'approve'
          ? 'Esta acción confirmará el pedido y aplicará los movimientos de inventario correspondientes. No se podrá deshacer desde la proforma.'
          : transitionConfirm === 'cancel'
            ? 'La proforma quedará anulada y no podrá editarse ni aprobarse.'
            : transitionConfirm === 'not-completed'
              ? 'La cotización quedará registrada como no concretada y podrá reabrirse posteriormente.'
              : 'La proforma volverá a EN REVISIÓN y podrá corregirse antes de aprobarla.'
      "
      :confirm-label="transitionConfirm === 'approve' ? 'Aprobar y crear pedido' : 'Confirmar'"
      @close="transitionConfirm = null"
      @confirm="executeTransition"
    />
    <ConfirmDialog
      :open="Boolean(confirmation)"
      :title="confirmation?.title || 'Confirmar'"
      :description="confirmation?.description || ''"
      :confirm-label="confirmation?.confirmLabel"
      :save-label="confirmation?.saveLabel"
      @close="answerConfirmation(false)"
      @confirm="answerConfirmation(true)"
      @save="saveConfirmation"
    />
    <UnsavedChangesDialog
      :open="leaveDialog"
      :saving="leaveSaving"
      :error="leaveSaveError"
      :in-review="isReview"
      @cancel="answerLeave(false)"
      @discard="discardLeave"
      @save="saveAndLeave"
    />
    <div v-if="!furnitureOpen" class="quote-main">
      <div class="quote-topline" aria-label="Ubicación en el proceso">
        <span>COMERCIAL <span class="quote-divider">/</span> PROFORMAS</span>
        <div class="quote-topline__right">
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
        </div>
      </div>
      <PageHeader
        :title="persisted ? `Editar proforma #${persisted.numero}` : 'Nueva proforma'"
        description="Prepara productos, cliente y condiciones antes de guardar."
        show-menu
        @menu="emit('openMenu')"
      >
        <template #actions>
          <div v-if="persisted" class="header-status-badge">
            <Badge :tone="tone">{{ persisted.estado_info.nombre }}</Badge>
          </div>
          <Button variant="secondary" @click="router.push(listPath)">
            <ArrowLeft :size="17" aria-hidden="true" /> Volver a proformas
          </Button>
          <Button
            v-if="persisted"
            variant="secondary"
            :processing="downloadingDocument"
            @click="openDocumentPreview"
          >
            <Eye :size="17" aria-hidden="true" /> Ver documento / PDF
          </Button>
          <Button
            v-if="persisted && (stateCode === 'BORRADOR' || stateCode === 'EN_REVISION')"
            variant="danger"
            :disabled="transitioning"
            @click="confirmStatusTransition('cancel')"
          >
            <Ban :size="17" aria-hidden="true" /> Anular proforma
          </Button>
          <Button
            v-if="inReview"
            variant="success"
            :disabled="transitioning || !canApprove"
            @click="confirmStatusTransition('approve')"
          >
            <Check :size="17" aria-hidden="true" />
            Aprobar y crear pedido
          </Button>
          <Button
            v-if="inReview"
            variant="secondary"
            :disabled="transitioning"
            @click="confirmStatusTransition('not-completed')"
          >
            <CircleX :size="17" aria-hidden="true" /> Marcar no concretada
          </Button>
          <Button
            v-if="stateCode === 'NO_CONCRETADA'"
            variant="secondary"
            :disabled="transitioning"
            @click="confirmStatusTransition('reopen')"
          >
            <RotateCcw :size="17" aria-hidden="true" /> Reabrir en revisión
          </Button>
        </template>
      </PageHeader>
      <div v-if="success && lastPedidoId" class="order-created-banner" role="status">
        <CheckCircle2 :size="18" aria-hidden="true" />
        <div class="order-created-banner__content">
          <span>{{ success }}</span>
          <RouterLink :to="`/pedidos/${lastPedidoId}`"
            >Consultar pedido #{{ lastPedidoId }}</RouterLink
          >
        </div>
      </div>
      <LoadingSkeleton v-if="loading || referenceLoading" :lines="8" />
      <ErrorState v-else-if="error && !tipos.length" :description="error">
        <button @click="loadReferences">Reintentar</button>
      </ErrorState>
      <template v-else>
        <nav class="steps" aria-label="Apartados de la proforma">
          <button
            v-for="(step, index) in steps"
            :key="step.id"
            type="button"
            :class="{ active: currentStep === index, complete: isStepComplete(index) }"
            :aria-current="currentStep === index ? 'step' : undefined"
            @click="currentStep = index"
          >
            <span class="step-icon">
              <component :is="step.icono" :size="18" aria-hidden="true" />
            </span>
            <span class="step-label">
              <small>{{ String(index + 1).padStart(2, '0') }}</small>
              {{ step.titulo }}
            </span>
            <CheckCircle2
              v-if="isStepComplete(index)"
              :size="16"
              class="step-complete"
              aria-hidden="true"
            />
          </button>
        </nav>

        <div v-if="error && conflicted" role="alert" class="error error-summary">
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
          <Card
            v-for="(line, index) in lineas"
            :key="line.localId"
            class="line-card"
            @click="openLineRead(line.localId)"
          >
            <span class="line-index" aria-hidden="true">{{
              String(index + 1).padStart(2, '0')
            }}</span>
            <div
              :id="`ap3-linea-${line.localId}`"
              class="line-summary"
              tabindex="0"
              role="button"
              :aria-label="'Ver detalle completo de ' + line.nombre"
              @keydown.enter.prevent="openLineRead(line.localId)"
              @keydown.space.prevent="openLineRead(line.localId)"
            >
              <div class="line-heading">
                <div v-if="line.producto" class="line-thumbnail">
                  <ProductImage
                    :image="quoteImages[line.producto] ?? null"
                    :alt="line.nombre"
                    sizes="96px"
                  />
                </div>
                <div v-else-if="furnitureCoverSource(line)" class="line-thumbnail">
                  <GalleryPhoto
                    :src="furnitureCoverSource(line)"
                    :alt="'Imagen principal de ' + line.nombre"
                  />
                </div>
                <div class="line-heading-copy">
                  <span class="line-type-badge">{{ itemTypeLabel(line) }}</span>
                  <strong>{{ line.nombre }}</strong>
                </div>
              </div>
            </div>
            <div v-if="line.modo_calculo === 'TOTAL_NEGOCIADO'" class="line-metrics">
              <div class="line-metric">
                <span>Modalidad</span><strong>Importe histórico negociado</strong>
              </div>
              <div class="line-metric">
                <span>Importe negociado</span>
                <strong>{{ money(Number(line.importe_negociado || 0)) }}</strong>
              </div>
              <div v-if="Number(line.descuento) > 0" class="line-metric">
                <span>Descuento aplicado</span>
                <strong>{{ money(Number(line.descuento)) }}</strong>
              </div>
            </div>
            <div v-else-if="totalEstimadoLinea(line) !== null" class="line-metrics">
              <div class="line-metric">
                <span>Cantidad</span
                ><strong>{{ formatQuantity(line.cantidad) }} {{ unitName(line.unidad) }}</strong>
              </div>
              <div class="line-metric">
                <span>Precio por unidad</span>
                <strong>{{ money(Number(line.precio_unitario)) }}</strong>
              </div>
              <div class="line-metric">
                <span>Descuento</span>
                <strong>{{
                  Number(line.descuento ?? 0) === 0 ? 'Ninguno' : money(Number(line.descuento))
                }}</strong>
              </div>
            </div>
            <p v-else class="line-metrics pending-value">Precio pendiente</p>
            <div class="line-total">
              <span>Importe de línea</span>
              <strong v-if="totalEstimadoLinea(line) !== null">
                {{ money(totalEstimadoLinea(line)!) }}
              </strong>
              <strong v-else class="pending-value">Pendiente</strong>
            </div>
            <div class="line-menu" @click.stop @keydown.esc="menuLineId = null">
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
                  <Pencil :size="16" aria-hidden="true" /> Editar
                </button>
                <button
                  v-if="tipos.find((x) => x.id === line.tipo_item)?.codigo === 'MUEBLE_MEDIDA'"
                  type="button"
                  role="menuitem"
                  @click="selectMenuAction('spec', index)"
                >
                  <Wrench :size="16" aria-hidden="true" /> Ficha técnica
                </button>
                <button
                  v-if="tipos.find((x) => x.id === line.tipo_item)?.codigo === 'MUEBLE_MEDIDA'"
                  type="button"
                  role="menuitem"
                  @click="selectMenuAction('duplicate', index)"
                >
                  <Copy :size="16" aria-hidden="true" /> Duplicar mueble
                </button>
                <button type="button" role="menuitem" @click="selectMenuAction('remove', index)">
                  <Trash2 :size="16" aria-hidden="true" /> Eliminar
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
              <span class="client-option__icon" aria-hidden="true">
                <Clock :size="18" />
              </span>
              <span class="client-option__copy">
                <strong>Pendiente</strong>
                <small>Completar el cliente más adelante</small>
              </span>
            </label>
            <label
              class="client-option"
              :class="{ 'client-option--active': clienteMode === 'existente' }"
            >
              <input v-model="clienteMode" type="radio" value="existente" />
              <span class="client-option__icon" aria-hidden="true">
                <UserCheck :size="18" />
              </span>
              <span class="client-option__copy">
                <strong>Existente</strong>
                <small>Seleccionar desde clientes registrados</small>
              </span>
            </label>
            <label
              class="client-option"
              :class="{ 'client-option--active': clienteMode === 'nuevo' }"
            >
              <input v-model="clienteMode" type="radio" value="nuevo" />
              <span class="client-option__icon" aria-hidden="true">
                <UserPlus :size="18" />
              </span>
              <span class="client-option__copy">
                <strong>Registrar nuevo</strong>
                <small>Registrar al guardar la proforma</small>
              </span>
            </label>
          </div>
          <Card v-if="clienteMode === 'existente'" class="client-fields client-fields--existing">
            <ClienteSelector
              :model-value="header.cliente"
              label="Cliente existente"
              @update:model-value="setExistingClient"
              @select="clienteSeleccionado = $event"
              @input.stop
              @change.stop
            />
          </Card>
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
            <span class="context-note__icon" aria-hidden="true">
              <Info :size="19" />
            </span>
            <div class="context-note__copy">
              <strong>Borrador flexible</strong>
              <p>
                Puedes guardar el borrador sin cliente. Para emitir a revisión deberás definirlo.
              </p>
            </div>
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
                hint="Describe brevemente el trabajo o pedido cotizado."
                @blur="conditionsTouched.titulo = true"
              />
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
                  <span class="currency-choice__icon" aria-hidden="true">
                    <Coins v-if="moneda.codigo === 'BOB'" :size="18" />
                    <CircleDollarSign v-else :size="18" />
                  </span>
                  <span class="currency-choice__copy">
                    <strong>{{
                      moneda.codigo === 'BOB' ? 'Bolivianos (BOB)' : 'Dólares (USD)'
                    }}</strong>
                    <small>{{
                      moneda.codigo === 'BOB' ? 'Moneda nacional' : 'Cotización en dólares'
                    }}</small>
                  </span>
                </label>
              </div>
            </fieldset>
            <div class="form-grid__triplet form-grid__full">
              <TextField
                v-model="header.porcentaje_adelanto"
                name="adelanto"
                label="Adelanto (%)"
                type="text"
                input-mode="numeric"
                input-rule="digits"
                :max-length="3"
                :error="conditionError('porcentaje_adelanto')"
                hint="Porcentaje inicial para confirmar el trabajo (0 a 100 %). El cero es válido."
                @blur="conditionsTouched.porcentaje_adelanto = true"
              />
              <TextField
                v-model="header.plazo_entrega"
                name="plazo"
                label="Plazo de entrega"
                input-rule="delivery"
                :max-length="QUOTE_LIMITS.plazo_entrega"
                :error="conditionError('plazo_entrega')"
                hint="Tiempo estimado de entrega o fabricación (ej. 15 días hábiles)."
                @blur="conditionsTouched.plazo_entrega = true"
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
                hint="Días de vigencia de los precios cotizados (1 a 100 días)."
                @blur="conditionsTouched.validez_oferta = true"
              />
            </div>
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
                placeholder="Condiciones adicionales, garantías o notas para el cliente..."
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
            <div class="section-title__tools">
              <span
                class="review-state-pill"
                :data-status="persisted?.estado_info?.codigo ?? 'BORRADOR'"
              >
                {{ persisted?.estado_info?.nombre ?? 'Borrador' }}
              </span>
            </div>
          </div>
          <div class="review-grid">
            <Card class="review-summary-card">
              <div class="review-summary-card__header">
                <span class="review-summary-card__icon" aria-hidden="true">
                  <PackageOpen :size="18" />
                </span>
                <span class="review-summary-card__title">Productos</span>
              </div>
              <p class="review-summary-card__detail">{{ lineas.length }} línea(s)</p>
              <button type="button" class="review-summary-card__action" @click="currentStep = 0">
                <span>Corregir productos</span>
                <ChevronRight :size="15" aria-hidden="true" />
              </button>
            </Card>
            <Card class="review-summary-card">
              <div class="review-summary-card__header">
                <span class="review-summary-card__icon" aria-hidden="true">
                  <UserRound :size="18" />
                </span>
                <span class="review-summary-card__title">Cliente</span>
              </div>
              <p class="review-summary-card__detail">
                {{
                  clienteMode === 'pendiente'
                    ? 'Pendiente'
                    : clienteMode === 'nuevo'
                      ? nuevoCliente.empresa || `${nuevoCliente.nombres} ${nuevoCliente.apellidos}`
                      : nombreClienteVisible()
                }}
              </p>
              <button type="button" class="review-summary-card__action" @click="currentStep = 1">
                <span>Corregir cliente</span>
                <ChevronRight :size="15" aria-hidden="true" />
              </button>
            </Card>
            <Card class="review-summary-card">
              <div class="review-summary-card__header">
                <span class="review-summary-card__icon" aria-hidden="true">
                  <SlidersHorizontal :size="18" />
                </span>
                <span class="review-summary-card__title">Condiciones</span>
              </div>
              <p class="review-summary-card__detail">
                {{ header.plazo_entrega || 'Plazo pendiente' }} · {{ header.moneda_codigo }}
              </p>
              <button type="button" class="review-summary-card__action" @click="currentStep = 2">
                <span>Corregir condiciones</span>
                <ChevronRight :size="15" aria-hidden="true" />
              </button>
            </Card>
          </div>
          <Card class="commercial-preview">
            <div class="preview-brand">
              <span class="preview-mark">H</span>
              <p class="brand">HOMEX · VISTA PREVIA</p>
            </div>
            <h3 class="commercial-preview__title">{{ header.titulo || 'Cotización comercial' }}</h3>
            <div v-if="lineas.length === 0" class="commercial-preview__empty">
              <PackageOpen :size="22" aria-hidden="true" />
              <p>Aún no has agregado productos a esta cotización.</p>
            </div>
            <div v-else class="commercial-preview__lines">
              <div v-for="line in lineas" :key="line.localId" class="review-product-card">
                <div class="review-product-card__main">
                  <div v-if="line.producto" class="review-thumbnail">
                    <ProductImage
                      :image="quoteImages[line.producto] ?? null"
                      :alt="line.nombre"
                      sizes="52px"
                    />
                  </div>
                  <div v-else-if="furnitureCoverSource(line)" class="review-thumbnail">
                    <GalleryPhoto
                      :src="furnitureCoverSource(line)"
                      :alt="'Imagen principal de ' + line.nombre"
                    />
                  </div>
                  <div class="review-product-card__info">
                    <span class="line-type-badge">{{ itemTypeLabel(line) }}</span>
                    <strong class="review-product-card__title">{{ line.nombre }}</strong>
                    <p v-if="line.descripcion" class="review-product-card__desc">
                      {{ line.descripcion }}
                    </p>
                  </div>
                </div>

                <div class="review-product-card__details">
                  <div
                    v-if="line.modo_calculo === 'TOTAL_NEGOCIADO'"
                    class="review-product-card__metric"
                  >
                    <span>Modalidad</span>
                    <strong>Importe negociado</strong>
                  </div>
                  <template v-else-if="totalEstimadoLinea(line) !== null">
                    <div class="review-product-card__metric">
                      <span>Cantidad</span>
                      <strong
                        >{{ formatQuantity(line.cantidad) }} {{ unitName(line.unidad) }}</strong
                      >
                    </div>
                    <div class="review-product-card__metric">
                      <span>Precio unitario</span>
                      <strong>{{ money(Number(line.precio_unitario)) }}</strong>
                    </div>
                    <div v-if="Number(line.descuento) > 0" class="review-product-card__metric">
                      <span>Descuento</span>
                      <strong>{{ money(Number(line.descuento)) }}</strong>
                    </div>
                  </template>
                  <div v-else class="review-product-card__metric">
                    <span class="pending-value">Precio pendiente</span>
                  </div>

                  <div class="review-product-card__total">
                    <span>Total de línea</span>
                    <strong v-if="line.modo_calculo === 'TOTAL_NEGOCIADO'">
                      {{ money(Number(line.importe_negociado || 0)) }}
                    </strong>
                    <strong v-else-if="totalEstimadoLinea(line) !== null">
                      {{ money(totalEstimadoLinea(line)!) }}
                    </strong>
                    <strong v-else class="pending-value">Pendiente</strong>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="header.plazo_entrega || header.validez_oferta"
              class="commercial-preview__meta"
            >
              <div v-if="header.plazo_entrega" class="commercial-preview__meta-item">
                <Clock :size="15" aria-hidden="true" />
                <span><strong>Plazo:</strong> {{ header.plazo_entrega }}</span>
              </div>
              <div v-if="header.validez_oferta" class="commercial-preview__meta-item">
                <Calendar :size="15" aria-hidden="true" />
                <span><strong>Validez:</strong> {{ header.validez_oferta }} días</span>
              </div>
            </div>
            <div class="whatsapp-share" @input.stop @change.stop>
              <div class="whatsapp-share__summary">
                <span class="whatsapp-share__icon">
                  <MessageCircle :size="20" aria-hidden="true" />
                </span>
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
            </div>
            <div class="document-preview-launcher">
              <div class="document-preview-launcher__summary">
                <span class="document-preview-launcher__icon" aria-hidden="true">
                  <FileText :size="20" />
                </span>
                <div class="document-preview-launcher__heading">
                  <strong>Documento comercial y vista previa PDF</strong>
                  <small
                    >Ficha en tamaño Carta con logotipo institucional, fichas técnicas y
                    condiciones.</small
                  >
                </div>
              </div>
              <Button
                type="button"
                variant="primary"
                class="document-preview-launcher__btn"
                @click="openDocumentPreview"
              >
                <Eye :size="16" aria-hidden="true" />
                <span>Ver documento / PDF</span>
              </Button>
            </div>
          </Card>
          <div class="totals">
            <div class="totals__identity">
              <span class="totals__icon" aria-hidden="true">
                <ReceiptText :size="22" />
              </span>
              <div class="totals__meta">
                <template v-if="persisted && !dirty">
                  <span>Total confirmado por HOMEX</span>
                  <small>Importe guardado y calculado por el servidor.</small>
                </template>
                <template v-else>
                  <span>Estimación local</span>
                  <small>El total confirmado será el que devuelva HOMEX al guardar.</small>
                  <small v-if="persisted">
                    Último total guardado: {{ money(Number(persisted.total)) }}. Los cambios
                    actuales aún no se guardaron.
                  </small>
                </template>
              </div>
            </div>
            <div class="totals__value">
              <strong v-if="persisted && !dirty" class="totals__amount">{{
                money(Number(persisted.total))
              }}</strong>
              <strong v-else-if="totalPreview !== null" class="totals__amount">{{
                money(totalPreview)
              }}</strong>
              <strong v-else class="totals__amount pending-value">Total pendiente</strong>
            </div>
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
              <Button
                variant="success"
                class="editor-save-draft"
                :disabled="!hasRealChanges"
                :processing="saving"
                @click="persist(false)"
              >
                <Save :size="17" aria-hidden="true" />
                {{ isReview ? 'Guardar cambios' : 'Guardar borrador' }}
              </Button>
              <Button
                v-if="!isReview"
                variant="info"
                :disabled="!canEmit"
                :processing="saving"
                @click="requestReview"
              >
                <Send :size="17" aria-hidden="true" />
                Enviar a revisión
              </Button>
              <Button
                type="button"
                variant="secondary"
                class="editor-preview-doc-btn"
                @click="openDocumentPreview"
              >
                <FileText :size="17" aria-hidden="true" />
                Vista previa PDF
              </Button>
            </div>
          </div>
        </footer>
      </template>

      <ProductoVistaRapida
        :open="Boolean(readingLine)"
        :line="readingLineForViewer"
        :product="readMaster"
        :moneda="header.moneda_codigo"
        :gallery="readingFurnitureGallery"
        :gallery-endpoint="readingProductGalleryEndpoint"
        :product-loading="readLoading"
        :product-error="readError"
        :action-label="
          readingLine && readingLine.modo_calculo !== 'TOTAL_NEGOCIADO' ? 'Editar línea' : ''
        "
        :detail-to="readMaster ? `/productos/${readMaster.id}` : ''"
        @close="closeLineRead"
        @retry="readingLine && void openLineRead(readingLine.localId)"
        @action="editReadLine"
      />
      <Modal
        wide
        :open="lineModal"
        :title="editingLine === null ? 'Agregar producto' : 'Editar producto'"
        @close="closeLineModal"
      >
        <DetalleForm
          ref="lineFormRef"
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
      ref="studioRef"
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
      @gallery-changed="onFurnitureGalleryChanged"
      @cancel="closeSpec"
      @applied="aplicarCaptura"
      @processing="voiceProcessing = $event"
    />

    <DocumentViewerModal
      :open="documentModalOpen"
      :title="persisted?.numero ? `Proforma #${persisted.numero}` : 'Cotización HOMEX'"
      :subtitle="`PDF de la versión guardada · Tamaño Carta · ${persisted?.estado_info?.nombre ?? 'Borrador'}`"
      :notice="documentNotice"
      :downloading="downloadingDocument"
      :can-download-pdf="true"
      :pdf-url="documentUrl"
      :loading="documentLoading"
      :error="documentError"
      @close="documentModalOpen = false"
      @retry="persisted?.id && loadDocument(persisted.id)"
      @download="downloadDocumentPdf"
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
  gap: 0.5rem;
  margin-bottom: var(--space-4);
}
.steps button {
  display: flex;
  gap: 0.65rem;
  align-items: center;
  min-width: 0;
  min-height: 4.25rem;
  text-align: left;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: 0.75rem;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font: inherit;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}
.steps button:hover {
  border-color: var(--color-border-strong);
}
.steps button:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.steps button.active {
  background: color-mix(in srgb, var(--color-primary-soft) 55%, var(--color-surface));
  color: var(--color-text);
  border-color: var(--color-primary);
  box-shadow: inset 0 -3px 0 var(--color-primary);
}
.steps button.active .step-icon {
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
}
.steps button.active .step-label small {
  color: var(--color-text-secondary);
}
.step-icon {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}
.step-label {
  display: grid;
  font-size: 0.81rem;
  font-weight: 700;
  gap: 0.15rem;
  min-width: 0;
}
.step-label small {
  font-size: 0.65rem;
  color: var(--color-text-secondary);
  font-weight: 500;
}
.step-complete {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--color-success);
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
  display: grid;
  position: relative;
  min-width: 0;
  align-items: center;
  grid-template-columns: auto minmax(14rem, 0.9fr) minmax(24rem, 1.5fr) auto auto;
  gap: var(--space-4);
  padding: 0.85rem 1rem;
  cursor: pointer;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}
.line-card:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}
.line-index {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.5rem;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  font-weight: 700;
}
.line-summary {
  min-width: 0;
  cursor: pointer;
}
.line-heading-copy {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}
.line-type-badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 0.12rem 0.5rem;
  border-radius: 9999px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
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
.line-metrics {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2) var(--space-5);
}
.line-metric {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.line-metric > span,
.line-total > span {
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 600;
}
.line-metric > strong {
  overflow-wrap: anywhere;
  font-size: 0.85rem;
}
.line-summary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
  border-radius: 2px;
}
.line-total {
  display: grid;
  justify-items: end;
  gap: 0.2rem;
  min-width: 8.5rem;
  padding: 0.55rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  text-align: right;
}
.line-total strong {
  flex: 0 0 auto;
  color: var(--color-text);
  white-space: nowrap;
}
.line-menu {
  position: relative;
  z-index: 30;
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
  align-items: center;
  gap: var(--space-4);
  margin: 0;
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: var(--color-text);
}
.context-note__icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.5rem;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-info);
}
.context-note__copy {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.context-note__copy strong {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
}
.context-note__copy p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
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
  align-items: center;
  gap: var(--space-3);
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}
.client-option:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}
.client-option--active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 45%, var(--color-surface));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.client-option input {
  margin: 0;
  flex: 0 0 auto;
  accent-color: var(--color-primary);
}
.client-option__icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.5rem;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
}
.client-option--active .client-option__icon {
  background: var(--color-primary-soft);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
  color: var(--color-primary-accent);
}
.client-option__copy {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}
.client-option strong {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
}
.client-option small {
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  line-height: 1.35;
}
.client-option:focus-within {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.client-fields {
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: var(--space-5);
}
.client-fields--existing {
  padding: var(--space-4) var(--space-5);
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
}
.form-grid__full {
  grid-column: 1 / -1;
}
.form-grid__triplet {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
}
@media (max-width: 54rem) {
  .form-grid__triplet {
    grid-template-columns: 1fr;
  }
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: var(--color-text);
  font: inherit;
  font-weight: 400;
  line-height: 1.6;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}
.quote-textarea textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
  outline: 0;
}
.quote-textarea textarea:hover:not(:focus) {
  border-color: var(--color-border-strong);
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
  gap: var(--space-4);
}
.review-summary-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
  padding: 1rem 1.15rem;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}
.review-summary-card:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}
.review-summary-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.review-summary-card__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.5rem;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-primary-accent);
}
.review-summary-card__title {
  color: var(--color-text);
  font-size: 0.88rem;
  font-weight: 650;
}
.review-summary-card__detail {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--color-text-secondary);
  font-size: 0.86rem;
  line-height: 1.45;
}
.review-summary-card__action {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary-accent);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 650;
  transition:
    color var(--transition-fast),
    gap var(--transition-fast);
}
.review-summary-card__action:hover {
  color: var(--color-primary);
  gap: 0.45rem;
  text-decoration: none;
}
.commercial-preview {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
.commercial-preview__title {
  margin: 0;
  color: var(--color-text);
  font-size: 1.2rem;
  letter-spacing: -0.02em;
}
.commercial-preview__empty {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 0.88rem;
}
.commercial-preview__empty svg {
  color: var(--color-text-muted);
  flex-shrink: 0;
}
.commercial-preview__empty p {
  margin: 0;
}
.commercial-preview__lines {
  display: grid;
  gap: 0;
}
.commercial-preview__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}
.commercial-preview__meta-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
.commercial-preview__meta-item svg {
  color: var(--color-primary-accent);
}
.commercial-preview__meta-item strong {
  color: var(--color-text);
}
.preview-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
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
.commercial-preview__lines {
  display: grid;
  gap: var(--space-3);
}
.review-product-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 0.85rem 1.15rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}
.review-product-card:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}
.review-product-card__main {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  flex: 1;
}
.review-product-card__info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}
.review-product-card__title {
  color: var(--color-text);
  font-size: 0.94rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.review-product-card__desc {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.review-product-card__details {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-shrink: 0;
}
.review-product-card__metric {
  display: grid;
  gap: 0.15rem;
  text-align: right;
  min-width: 0;
}
.review-product-card__metric span {
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.review-product-card__metric strong {
  color: var(--color-text);
  font-size: 0.86rem;
  font-weight: 600;
  white-space: nowrap;
}
.review-product-card__total {
  display: grid;
  gap: 0.15rem;
  text-align: right;
  min-width: 6.5rem;
  padding: 0.45rem 0.75rem;
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
}
.review-product-card__total span {
  color: var(--color-text-secondary);
  font-size: 0.7rem;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.review-product-card__total strong {
  color: var(--color-text);
  font-size: 0.96rem;
  font-weight: 750;
  letter-spacing: -0.02em;
  white-space: nowrap;
}
@media (max-width: 54rem) {
  .review-product-card {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
  }
  .review-product-card__details {
    justify-content: space-between;
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border);
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .review-product-card__metric {
    text-align: left;
  }
  .review-product-card__total {
    margin-left: auto;
  }
}
.commercial-preview :deep(.button) {
  justify-self: start;
}
.totals {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 1.25rem 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  transition: border-color var(--transition-fast);
}
.totals:hover {
  border-color: var(--color-border-strong);
}
.totals__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.totals__icon {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.6rem;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-primary-accent);
}
.totals__meta {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.totals__meta span {
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.totals__meta small {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  line-height: 1.4;
}
.totals__value {
  display: grid;
  justify-items: end;
  flex-shrink: 0;
}
.totals__amount {
  color: var(--color-text);
  font-size: clamp(1.4rem, 2.5vw, 1.85rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}
@media (max-width: 48rem) {
  .totals {
    flex-direction: column;
    align-items: flex-start;
  }
  .totals__value {
    justify-items: start;
    width: 100%;
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border);
  }
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
  .line-card {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
  }
  .line-summary {
    grid-column: 2;
    grid-row: 1;
  }
  .line-metrics {
    grid-column: 2;
    grid-row: 2;
    margin-top: var(--space-3);
  }
  .line-total {
    grid-column: 3;
    grid-row: 1 / 3;
  }
  .line-menu {
    grid-column: 4;
    grid-row: 1 / 3;
  }
  .steps button {
    padding: 0.65rem;
    gap: 0.5rem;
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
  .step-icon {
    display: none;
  }
  .steps button {
    min-height: 3.25rem;
    padding: 0.55rem 0.65rem;
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
    min-height: 3.5rem;
    flex-direction: column;
    justify-content: center;
    gap: 0.15rem;
    padding: 0.45rem 0.25rem;
    text-align: center;
  }
  .step-label {
    width: 100%;
    font-size: 0.69rem;
    align-items: center;
  }
  .step-label small {
    font-size: 0.6rem;
  }
  .step-complete {
    display: none;
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
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  .line-summary {
    grid-column: 2 / 4;
    grid-row: 1;
  }
  .line-metrics {
    grid-column: 1 / -1;
    grid-row: 2;
    margin-left: 0;
    gap: var(--space-2) var(--space-3);
  }
  .line-total {
    grid-column: 1 / 3;
    grid-row: 3;
    justify-self: start;
  }
  .line-menu {
    grid-column: 3;
    grid-row: 3;
    justify-self: end;
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
  font-size: 0.88rem;
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
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}
.currency-choice__option:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}
.currency-choice__option--selected {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 45%, var(--color-surface));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.currency-choice__option:focus-within {
  box-shadow: var(--focus-ring);
}
.currency-choice__option input {
  margin: 0;
  flex: 0 0 auto;
  accent-color: var(--color-primary);
}
.currency-choice__icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.5rem;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
}
.currency-choice__option--selected .currency-choice__icon {
  background: var(--color-primary-soft);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
  color: var(--color-primary-accent);
}
.currency-choice__copy {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}
.currency-choice__copy strong {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
}
.currency-choice__copy small {
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  line-height: 1.35;
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
  padding: 1.15rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
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
  border: 1px solid color-mix(in srgb, #25d366 30%, var(--color-border));
  border-radius: var(--radius-control);
  background: color-mix(in srgb, #25d366 12%, var(--color-surface));
  color: #25d366;
}
.whatsapp-share__heading {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 0.15rem;
}
.whatsapp-share__heading strong {
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 650;
}
.whatsapp-share__heading small,
.whatsapp-share__hint {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  line-height: 1.45;
}
.whatsapp-share__hint {
  margin: 0;
  padding-left: 3.25rem;
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
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
}
.whatsapp-share__toggle:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
  border-color: var(--color-border-strong);
}
.whatsapp-share__toggle:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.whatsapp-share__content {
  display: grid;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}
.whatsapp-share__content label {
  color: var(--color-text);
  font-size: 0.84rem;
  font-weight: 600;
}
.whatsapp-share__content textarea {
  width: 100%;
  min-height: 9rem;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: var(--color-text);
  font: inherit;
  line-height: 1.6;
  resize: vertical;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}
.whatsapp-share__content textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
  outline: 0;
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

.review-state-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.review-state-pill[data-status='APROBADA'] {
  background: color-mix(in srgb, var(--color-success) 14%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
  color: var(--color-success);
}

.review-state-pill[data-status='EN_REVISION'] {
  background: color-mix(in srgb, var(--color-warning) 14%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
  color: var(--color-warning);
}

.document-preview-launcher {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-4);
  padding: 1.15rem 1.25rem;
  border: 1.5px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));
  flex-wrap: wrap;
}

.document-preview-launcher__summary {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  flex: 1;
}

.document-preview-launcher__icon {
  display: grid;
  flex: 0 0 auto;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
  color: var(--color-primary-accent);
}

.document-preview-launcher__heading {
  display: grid;
  gap: 0.15rem;
}

.document-preview-launcher__heading strong {
  color: var(--color-text);
  font-size: 0.92rem;
  font-weight: 650;
}

.document-preview-launcher__heading small {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  line-height: 1.4;
}

.document-preview-launcher__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
.emission-checklist,
.emission-ready {
  padding: 1.25rem 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
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
  width: 2.6rem;
  height: 2.6rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.5rem;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-warning);
}
.emission-checklist__heading {
  flex: 1;
  min-width: 0;
}
.emission-checklist__heading h3 {
  margin: 0;
  color: var(--color-text);
  font-size: 0.96rem;
  font-weight: 650;
}
.emission-checklist__heading p {
  margin: 0.15rem 0 0;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
.emission-checklist__count {
  flex-shrink: 0;
  padding: 0.3rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--color-warning) 35%, var(--color-border));
  border-radius: 999px;
  color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 12%, var(--color-surface));
  font-size: 0.74rem;
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
  padding: 0.85rem 0;
  border-top: 1px solid var(--color-border);
}
.emission-checklist li > svg {
  flex: 0 0 auto;
  color: var(--color-warning);
}
.emission-checklist__detail {
  display: grid;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}
.emission-checklist__detail strong {
  color: var(--color-text);
  font-size: 0.86rem;
  font-weight: 600;
}
.emission-checklist__detail p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}
.emission-checklist li button {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 0.25rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  color: var(--color-text);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}
.emission-checklist li button:hover,
.emission-checklist li button:focus-visible {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
}
.emission-ready {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 1.1rem 1.4rem;
  border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
  background: color-mix(in srgb, var(--color-success) 8%, var(--color-surface));
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
.editor-actions :deep(.button.editor-save-draft) {
  box-shadow: none;
}
.line-heading {
  display: flex;
  gap: 0.8rem;
  align-items: center;
  min-width: 0;
}
.line-heading strong {
  overflow-wrap: anywhere;
}
.line-thumbnail {
  width: 6rem;
  height: 6rem;
  flex: none;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
.line-thumbnail :deep(.product-image) {
  width: 100%;
  height: 100%;
  min-height: 0;
  aspect-ratio: 1 !important;
}
.line-thumbnail :deep(img),
.review-thumbnail :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.line-thumbnail :deep(.fallback span) {
  display: none;
}
.review-thumbnail {
  flex: none;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  overflow: hidden;
}
.review-thumbnail :deep(.product-image) {
  width: 100%;
  height: 100%;
  min-height: 0;
  aspect-ratio: 1 !important;
}
.review-thumbnail :deep(.fallback span) {
  display: none;
}
.menu-panel [role='menuitem'] {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}
.header-status-badge {
  display: flex;
  align-items: center;
}
.order-created-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  padding: 0.9rem 1.25rem;
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-success) 35%, transparent);
  color: var(--color-text);
}
.order-created-banner svg {
  color: var(--color-success);
  flex-shrink: 0;
}
.order-created-banner__content {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}
.order-created-banner__content a {
  font-weight: 700;
  color: var(--color-primary);
  text-decoration: underline;
}
</style>
