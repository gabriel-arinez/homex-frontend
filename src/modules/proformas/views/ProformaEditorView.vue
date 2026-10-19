<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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
} from '@/generated/api'
import { ApiError } from '@/shared/api'
import Button from '@/shared/ui/Button.vue'
import Card from '@/shared/ui/Card.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import Modal from '@/shared/ui/Modal.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'
import ClienteSelector from '../components/ClienteSelector.vue'
import ClienteFormFields from '@/modules/clientes/components/ClienteFormFields.vue'
import DetalleForm from '../components/DetalleForm.vue'
import CatalogoContextual from '../components/CatalogoContextual.vue'
import type { CatalogoContextState } from '../services/catalogoContext'
import EspecificacionForm from '../components/EspecificacionForm.vue'
import { proformasService } from '../services/proformasService'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { productosService } from '@/modules/productos/services/productosService'
import {
  cloneEditorData,
  consumeEditorDraft,
  removeLocalLine,
  restoreLocalLine,
  saveEditorDraft,
} from '../services/editorLocal'
import { totalEstimadoCompleto, totalEstimadoLinea } from '../services/presentacionComercial'

type LineaLocal = DetalleIntegralWritable & { localId: string }
const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const proformaId = computed(() => (route.params.id ? Number(route.params.id) : null))
const steps = ['Productos', 'Cliente', 'Condiciones', 'Revisar'] as const
const currentStep = ref(0)
const loading = ref(Boolean(proformaId.value))
const saving = ref(false)
const referenceLoading = ref(true)
const error = ref('')
const success = ref('')
const fields = ref<Record<string, string[]>>({})
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
const removedLines = ref<{ line: LineaLocal; index: number }[]>([])
const contextualNavigation = ref(false)
const preferredProductId = ref<number | null>(null)
const pendingLineDraft = ref<Record<string, string> | null>(null)
const duplicateOrigin = ref<string | null>(null)
const duplicateSpec = ref<EspecificacionMuebleWritable | null>(null)
const clienteMode = ref<'existente' | 'nuevo' | 'pendiente'>('existente')
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
  nuevoCliente[field] = value
}
const lineas = ref<LineaLocal[]>([])
const reviewedCurrency = ref('BOB')
const priceReviewRequired = computed(
  () => lineas.value.length > 0 && header.moneda_codigo !== reviewedCurrency.value,
)
const existingProductIds = computed(() =>
  lineas.value.flatMap((line) => (line.producto ? [line.producto] : [])),
)
const totalPreview = computed(() => totalEstimadoCompleto(lineas.value))
const emissionPending = computed(() => {
  const pendientes: string[] = []
  if (!lineas.value.length) pendientes.push('agregar al menos una línea')
  if (priceReviewRequired.value)
    pendientes.push('revisar explícitamente precios y descuentos tras cambiar de moneda')
  if (clienteMode.value === 'pendiente') pendientes.push('elegir o registrar un cliente')
  if (clienteMode.value === 'existente' && !header.cliente) pendientes.push('elegir un cliente')
  if (clienteMode.value === 'nuevo') {
    if (!nuevoCliente.tipo_cliente) pendientes.push('indicar el tipo de cliente')
    const tipo = tiposCliente.value.find((item) => String(item.id) === nuevoCliente.tipo_cliente)
    const contacto = Boolean(nuevoCliente.nombres.trim() && nuevoCliente.apellidos.trim())
    if (!contacto) pendientes.push('completar nombre y apellidos del contacto')
    if (/EMPRESA|JURID/.test(tipo?.codigo ?? '') && !nuevoCliente.empresa.trim()) {
      pendientes.push('completar la razón social')
    }
  }
  return pendientes
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
const editableSpecDetail = computed(() =>
  draftingFurniture.value ?? (specLine.value === null ? null : (lineas.value[specLine.value] ?? null)),
)
const editableSpec = computed(() => {
  if (draftingFurniture.value) return draftingFurniture.value.especificacion as EspecificacionMueble | null
  if (specLine.value === null) return null
  return (lineas.value[specLine.value]?.especificacion ?? null) as EspecificacionMueble | null
})
const canEmit = computed(() => {
  if (!lineas.value.length || priceReviewRequired.value) return false
  if (clienteMode.value === 'existente') return Boolean(header.cliente)
  if (clienteMode.value !== 'nuevo' || !nuevoCliente.tipo_cliente) return false
  const tipo = tiposCliente.value.find((item) => String(item.id) === nuevoCliente.tipo_cliente)
  const esEmpresa = /EMPRESA|JURID/.test(tipo?.codigo ?? '')
  const contacto = Boolean(nuevoCliente.nombres.trim() && nuevoCliente.apellidos.trim())
  return esEmpresa ? contacto && Boolean(nuevoCliente.empresa.trim()) : contacto
})

function markDirty() {
  dirty.value = true
}
function confirmCurrencyReview() {
  reviewedCurrency.value = header.moneda_codigo
  markDirty()
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
  reviewedCurrency.value = value.moneda_info.codigo
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
      especificacion: previous.especificacion,
    }
  }
  lineModal.value = false
  lineModalDirty.value = false
  editingLine.value = null
  additionMode.value = 'none'
  markDirty()
  const isFurniture =
    tipos.value.find((x) => x.id === Number(body.tipo_item))?.codigo === 'MUEBLE_MEDIDA'
  if (wasNew && isFurniture && duplicateSource) {
    duplicateOrigin.value = duplicateSource
    specLine.value = lineas.value.length - 1
    specModalDirty.value = false
  } else duplicateOrigin.value = null
}
function saveSpec(
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
      ? lineas.value.find((line) => line.localId === duplicateOrigin.value) : null
    if (original) {
      const commercialKeys = ['nombre', 'descripcion', 'cantidad', 'unidad', 'precio_unitario', 'descuento'] as const
      const sameCommercial = commercialKeys.every(
        (key) => String(original[key] ?? '') === String(candidate[key] ?? ''),
      )
      const sameSpec = JSON.stringify(original.especificacion ?? null) === JSON.stringify(body)
      if (sameCommercial && sameSpec) {
        if (!window.confirm('La copia es idéntica. ¿Aumentar la cantidad de la línea original?'))
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
      JSON.stringify(original.especificacion ?? null) === JSON.stringify(body)
    if (identical) {
      if (!window.confirm('La copia completa es idéntica. ¿Sumar su cantidad a la línea original?'))
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
function closeSpec() {
  if (
    specModalDirty.value &&
    !window.confirm('Hay cambios sin guardar en la ficha técnica. ¿Deseas descartarlos?')
  )
    return
  specLine.value = null
  specModalDirty.value = false
}
function removeLine(index: number) {
  const result = removeLocalLine(lineas.value, index)
  lineas.value = result.lines
  if (result.removed) removedLines.value.push(result.removed)
  markDirty()
}
function undoRemove() {
  const removed = removedLines.value.pop()
  if (!removed) return
  lineas.value = restoreLocalLine(lineas.value, removed)
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
  specLine.value = null
  lineModal.value = false
  specModalDirty.value = false
}
function duplicateFurniture(index: number) {
  const original = lineas.value[index]
  if (!original || tipos.value.find((x) => x.id === original.tipo_item)?.codigo !== 'MUEBLE_MEDIDA')
    return
  duplicateOrigin.value = original.localId
  openFurnitureDraft(original)
  success.value = 'Revisa la copia y su ficha técnica antes de incorporarla.'
}
function editorSnapshot() {
  return {
    userId: session.identity?.id ?? null,
    expiresAt: Date.now() + 60 * 60 * 1000,
    header: cloneEditorData(header),
    reviewedCurrency: reviewedCurrency.value,
    nuevoCliente: cloneEditorData(nuevoCliente),
    clienteMode: clienteMode.value,
    clienteSeleccionado: cloneEditorData(clienteSeleccionado.value),
    lineModalDirty: lineModalDirty.value,
    lineas: cloneEditorData(lineas.value),
    removedLines: cloneEditorData(removedLines.value),
    additionMode: additionMode.value,
    catalogInitialized: catalogInitialized.value,
    catalogState: cloneEditorData(catalogState.value),
    currentStep: currentStep.value,
    key: key.value,
    lineDraft: cloneEditorData(pendingLineDraft.value),
    editingLine: editingLine.value,
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
  if (!session.can('comercial.administrar')) return
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
  const token = typeof route.query.draft === 'string' ? route.query.draft : ''
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
  reviewedCurrency.value = snapshot.reviewedCurrency ?? header.moneda_codigo
  Object.assign(nuevoCliente, snapshot.nuevoCliente)
  clienteMode.value = snapshot.clienteMode
  clienteSeleccionado.value =
    snapshot.clienteSeleccionado ?? persisted.value?.cliente_resumen ?? null
  lineas.value = snapshot.lineas
  removedLines.value = snapshot.removedLines ?? []
  additionMode.value = snapshot.additionMode ?? 'none'
  catalogInitialized.value = snapshot.catalogInitialized ?? false
  catalogState.value = snapshot.catalogState ?? null
  currentStep.value = snapshot.currentStep
  key.value = snapshot.key
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
  const client =
    clienteMode.value === 'nuevo'
      ? nuevoCliente.empresa || `${nuevoCliente.nombres} ${nuevoCliente.apellidos}`.trim()
      : nombreClienteVisible()
  const lines = lineas.value
    .map((line) =>
      line.modo_calculo === 'TOTAL_NEGOCIADO'
        ? `• ${line.nombre}: importe negociado ${money(Number(line.importe_negociado || 0))}`
        : totalEstimadoLinea(line) === null
          ? `• ${line.nombre}: precio pendiente`
          : `• ${line.nombre}: ${line.cantidad} × ${money(Number(line.precio_unitario))}`,
    )
    .join('\n')
  const conditions = [
    header.plazo_entrega && `Plazo: ${header.plazo_entrega}`,
    header.validez_oferta && `Validez: ${header.validez_oferta} días`,
  ]
    .filter(Boolean)
    .join('\n')
  await navigator.clipboard.writeText(
    `HOMEX — Cotización\n${client}\n${lines}\n${totalPreview.value === null ? 'Total estimado pendiente' : `Total estimado: ${money(totalPreview.value)}`}${conditions ? `\n${conditions}` : ''}`,
  )
  success.value = 'Resumen copiado. Puedes pegarlo manualmente en WhatsApp.'
}

function closeLineModal() {
  if (
    lineModalDirty.value &&
    !window.confirm('Hay cambios sin agregar en esta línea. ¿Deseas descartarlos?')
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
  if (existingProductIds.value.includes(product.id)) {
    void focusDuplicateProduct(product.id)
    return
  }
  preferredProductId.value = product.id
  openLine()
}
function chooseManualFurniture() {
  preferredProductId.value = null
  openLine()
  const tipo = tipos.value.find((x) => x.codigo === 'MUEBLE_MEDIDA')
  const unidad = unidades.value.find((x) => x.codigo === 'PIEZA')
  pendingLineDraft.value = {
    tipo_item: String(tipo?.id ?? ''),
    unidad: String(unidad?.id ?? ''),
  }
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
    !window.confirm(
      'La variante ya está incluida. ¿Deseas descartar esta edición y ver la línea existente?',
    )
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
    ...(proformaId.value && persisted.value ? { revision_esperada: persisted.value.revision } : {}),
    emitir,
    cliente: clienteMode.value === 'existente' && header.cliente ? Number(header.cliente) : null,
    cliente_nuevo:
      clienteMode.value === 'nuevo'
        ? ({
            ...nuevoCliente,
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
async function persist(emitir: boolean) {
  if (saving.value) return
  if (priceReviewRequired.value) {
    currentStep.value = 2
    error.value = 'Antes de guardar, revisa los precios negociados y confirma la nueva moneda.'
    return
  }
  saving.value = true
  error.value = ''
  success.value = ''
  conflicted.value = false
  fields.value = {}
  try {
    const result = proformaId.value
      ? await proformasService.updateIntegral(proformaId.value, body(emitir))
      : await proformasService.saveIntegral(body(emitir))
    fill(result)
    removedLines.value = []
    key.value = crypto.randomUUID()
    success.value = emitir ? 'Proforma emitida para revisión.' : 'Borrador guardado.'
    if (!proformaId.value) await router.replace(`/proformas/${result.id}/editar`)
  } catch (cause) {
    if (cause instanceof ApiError) fields.value = cause.fields
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la proforma.'
    if (cause instanceof ApiError && cause.status === 409 && proformaId.value) {
      conflicted.value = true
      error.value = `${error.value} Se conservaron tus cambios locales. Puedes copiarlos o descartarlos y recargar.`
    }
  } finally {
    saving.value = false
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value && !lineModalDirty.value && !specModalDirty.value) return
  event.preventDefault()
}
onBeforeRouteLeave(
  () =>
    contextualNavigation.value ||
    (!dirty.value && !lineModalDirty.value && !specModalDirty.value) ||
    window.confirm('Hay cambios sin guardar. ¿Deseas salir?'),
)
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  await Promise.all([loadReferences(), load()])
  restoreContextualDraft()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div @input="markDirty" @change="markDirty">
    <PageHeader
      :title="persisted ? `Editar proforma #${persisted.numero}` : 'Nueva proforma'"
      description="Prepara productos, cliente y condiciones antes de guardar."
      show-menu
      @menu="emit('openMenu')"
    />
    <LoadingSkeleton v-if="loading || referenceLoading" :lines="8" />
    <ErrorState v-else-if="error && !tipos.length" :description="error">
      <button @click="loadReferences">Reintentar</button>
    </ErrorState>
    <template v-else>
      <nav class="steps" aria-label="Apartados de la proforma">
        <button
          v-for="(step, index) in steps"
          :key="step"
          :class="{ active: currentStep === index }"
          :aria-current="currentStep === index ? 'step' : undefined"
          @click="currentStep = index"
        >
          <span>{{ index + 1 }}</span
          >{{ step }}
        </button>
      </nav>
      <p v-if="success" role="status" class="success">{{ success }}</p>
      <div class="editor-status" role="status" aria-live="polite">
        <span>{{ editingStatus }}</span>
        <span v-if="persisted">
          Estado comercial: <strong>{{ persisted.estado_info.nombre }}</strong> · Proforma
          {{ persisted.numero }}
        </span>
      </div>
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

      <section v-show="currentStep === 0" aria-labelledby="productos-title">
        <div class="section-title">
          <div>
            <h2 id="productos-title">Productos</h2>
            <p>Agrega productos antes o después de elegir cliente.</p>
          </div>
          <Button @click="additionMode = 'choose'">Añadir ítem</Button>
        </div>
        <div v-if="additionMode === 'choose'" class="choice-panel">
          <h3>¿Qué deseas incorporar a la cotización?</h3>
          <div class="actions">
            <Button @click="chooseCatalog">Producto de catálogo</Button>
            <Button variant="secondary" @click="chooseManualFurniture">Mueble a pedido</Button>
            <Button variant="secondary" @click="additionMode = 'none'">Cancelar</Button>
          </div>
        </div>
        <div v-if="catalogInitialized" v-show="additionMode === 'catalog'">
          <CatalogoContextual
            :categorias="catalogCategories"
            :familias="familias"
            :existing-product-ids="existingProductIds"
            :can-admin="session.can('comercial.administrar')"
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
            <strong>{{ line.nombre }}</strong>
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
        <p v-if="!lineas.length" class="empty">Aún no agregaste productos.</p>
        <p v-if="lineas.some((line) => line.modo_calculo === 'TOTAL_NEGOCIADO')" class="warning">
          Las líneas de importe histórico negociado se conservan sin conversión automática.
        </p>
      </section>

      <section v-show="currentStep === 1" aria-labelledby="cliente-title">
        <h2 id="cliente-title">Cliente</h2>
        <div class="mode" role="radiogroup" aria-label="Origen del cliente">
          <label><input v-model="clienteMode" type="radio" value="pendiente" /> Pendiente</label>
          <label><input v-model="clienteMode" type="radio" value="existente" /> Existente</label>
          <label><input v-model="clienteMode" type="radio" value="nuevo" /> Registrar nuevo</label>
        </div>
        <ClienteSelector
          v-if="clienteMode === 'existente'"
          v-model="header.cliente"
          label="Cliente existente"
          @select="clienteSeleccionado = $event"
        />
        <Card v-if="clienteMode === 'nuevo'">
          <ClienteFormFields
            :model="nuevoCliente"
            :tipos="tiposCliente"
            :errors="clientErrors"
            prefix="proforma-cliente"
            @change="updateNuevoCliente"
          />
        </Card>
        <p v-if="clienteMode === 'pendiente'">
          Puedes guardar el borrador sin cliente. Para emitir deberás definirlo.
        </p>
      </section>

      <section v-show="currentStep === 2" aria-labelledby="condiciones-title">
        <h2 id="condiciones-title">Condiciones</h2>
        <div class="form-grid">
          <TextField v-model="header.titulo" name="titulo" label="Título" />
          <Select
            v-model="header.moneda_codigo"
            name="moneda"
            label="Moneda"
            :options="monedas.map((x) => ({ label: `${x.nombre} (${x.codigo})`, value: x.codigo }))"
          />
          <TextField v-model="header.plazo_entrega" name="plazo" label="Plazo de entrega" />
          <TextField
            v-model="header.validez_oferta"
            name="validez"
            label="Validez de la oferta (días)"
            type="number"
            min="1"
          />
          <TextField
            v-model="header.porcentaje_adelanto"
            name="adelanto"
            label="Adelanto (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
          />
          <TextField v-model="header.observaciones" name="observaciones" label="Observaciones" />
        </div>
        <div v-if="priceReviewRequired" class="warning" role="status">
          <p>
            La moneda cambió. Los precios y descuentos existentes no se convirtieron
            automáticamente.
          </p>
          <p>Revisa cada importe en {{ header.moneda_codigo }} antes de continuar.</p>
          <Button variant="secondary" @click="confirmCurrencyReview"
            >He revisado los precios en esta moneda</Button
          >
        </div>
      </section>

      <section v-if="currentStep === 3" aria-labelledby="revisar-title">
        <h2 id="revisar-title">Revisar</h2>
        <div class="review-grid">
          <Card
            ><h3>Productos</h3>
            <p>{{ lineas.length }} línea(s)</p>
            <button @click="currentStep = 0">Corregir productos</button></Card
          >
          <Card
            ><h3>Cliente</h3>
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
          <Card
            ><h3>Condiciones</h3>
            <p>{{ header.plazo_entrega || 'Plazo pendiente' }} · {{ header.moneda_codigo }}</p>
            <button @click="currentStep = 2">Corregir condiciones</button></Card
          >
        </div>
        <Card class="commercial-preview"
          ><p class="brand">HOMEX</p>
          <h3>{{ header.titulo || 'Cotización comercial' }}</h3>
          <p v-for="line in lineas" :key="line.localId">
            <strong>{{ line.nombre }}</strong> —
            <template v-if="line.modo_calculo === 'TOTAL_NEGOCIADO'">
              importe negociado {{ money(Number(line.importe_negociado || 0)) }}
            </template>
            <template v-else-if="totalEstimadoLinea(line) !== null">
              cantidad {{ line.cantidad }}, precio {{ money(Number(line.precio_unitario)) }}
            </template>
            <template v-else>precio pendiente</template>
            <span v-if="line.descripcion"><br />{{ line.descripcion }}</span>
          </p>
          <p v-if="header.plazo_entrega"><strong>Plazo:</strong> {{ header.plazo_entrega }}</p>
          <p v-if="header.validez_oferta">
            <strong>Validez:</strong> {{ header.validez_oferta }} días
          </p>
          <Button type="button" variant="secondary" @click="copyCommercialSummary"
            >Copiar resumen para compartir manualmente</Button
          ></Card
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
              Último total guardado: {{ money(Number(persisted.total)) }}. Los cambios actuales aún
              no se guardaron.
            </small>
          </template>
        </div>
        <div v-if="!canEmit" class="warning" role="status">
          <strong>Antes de emitir:</strong>
          <ul>
            <li v-for="pending in emissionPending" :key="pending">{{ pending }}.</li>
          </ul>
        </div>
      </section>

      <footer class="editor-actions">
        <Button variant="secondary" :disabled="currentStep === 0" @click="currentStep--"
          >Anterior</Button
        >
        <Button v-if="currentStep < 3" @click="currentStep++">Continuar</Button>
        <Button variant="secondary" :processing="saving" @click="persist(false)"
          >Guardar borrador</Button
        >
        <Button :disabled="!canEmit" :processing="saving" @click="persist(true)"
          >Emitir proforma</Button
        >
        <Button
          v-if="persisted"
          variant="secondary"
          @click="router.push(`/proformas/${persisted.id}`)"
        >
          Ver detalle, aprobar y gestionar adjuntos
        </Button>
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
          <strong>Descripción:</strong> {{ readingLine.descripcion || 'Sin descripción adicional' }}
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
          <h3>Ficha técnica</h3>
          <p>{{ readingLine.especificacion.observaciones }}</p>
          <pre>{{ JSON.stringify(readingLine.especificacion.datos_tecnicos, null, 2) }}</pre>
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
    <Modal
      :open="specLine !== null"
      title="Configurador integral de mueble a pedido"
      fullscreen
      @close="closeSpec"
    >
      <EspecificacionForm
        :key="specLine ?? -1"
        :tipos="tiposMueble"
        :especificacion="editableSpec"
        :detalle="editableSpecDetail"
        @save="saveSpec"
        @changed="specModalDirty = true"
        @cancel="closeSpec"
      />
    </Modal>
  </div>
</template>

<style scoped>
.steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}
.steps button {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}
.steps button.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 700;
}
.steps span {
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--color-surface-muted);
}
section {
  display: grid;
  gap: var(--space-4);
}
.section-title,
.line-card,
.editor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.choice-panel {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.choice-panel h3 {
  margin-top: 0;
}
.line-summary {
  cursor: pointer;
  min-width: 0;
  flex: 1;
}
.line-summary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.line-menu {
  position: relative;
  flex-shrink: 0;
}
.menu-trigger {
  padding: var(--space-2);
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 1.25rem;
  cursor: pointer;
}
.menu-panel {
  position: absolute;
  z-index: 10;
  top: 100%;
  right: 0;
  min-width: 10rem;
  display: grid;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  box-shadow: 0 4px 16px #0002;
}
.menu-panel button {
  text-align: left;
  padding: var(--space-2);
  background: transparent;
  color: var(--color-text);
  border: 0;
  cursor: pointer;
}
.menu-panel button:focus-visible {
  outline: 2px solid var(--color-primary);
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
.line-card {
  margin-bottom: var(--space-3);
}
.actions,
.mode {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.form-grid,
.client-grid,
.review-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
.review-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.totals {
  display: grid;
  justify-items: end;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
.totals strong {
  font-size: 1.5rem;
}
.editor-actions {
  position: sticky;
  bottom: 0;
  margin-top: var(--space-6);
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
  background: var(--color-background);
}
.error,
.warning {
  color: var(--color-danger);
}
.success {
  color: var(--color-success);
}
.editor-status {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2) var(--space-5);
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}
.pending-value {
  color: var(--color-warning-text, var(--color-text-secondary));
}
.error-summary ul,
.warning ul {
  margin-bottom: 0;
}
.empty {
  padding: var(--space-6);
  text-align: center;
  border: 1px dashed var(--color-border);
}
@media (max-width: 48rem) {
  .steps {
    grid-template-columns: repeat(2, 1fr);
  }
  .review-grid {
    grid-template-columns: 1fr;
  }
  .editor-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 35rem) {
  .steps,
  .form-grid,
  .client-grid,
  .editor-actions {
    grid-template-columns: 1fr;
  }
  .line-card,
  .section-title {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
