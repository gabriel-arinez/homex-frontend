<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import type {
  AtributoMueble,
  PendienteAsistida,
  EspecificacionMueble,
  EspecificacionMuebleWritable,
  ValorCatalogoPublico,
} from '@/generated/api'
import { ApiError } from '@/shared/api/errors'
import Button from '@/shared/ui/Button.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'
import TextAreaField from '@/shared/ui/TextAreaField.vue'
import Toast from '@/shared/ui/Toast.vue'
import MuebleOptionPicker from './MuebleOptionPicker.vue'
import {
  Pencil,
  ArrowUp,
  ArrowDown,
  MessageSquareText,
  AlertCircle,
  Check,
  CheckCircle2,
  Layers3,
  Plus,
  Save,
  Tag,
  Ruler,
  SlidersHorizontal,
  Package,
  Wrench,
  Wallet,
  Calculator,
  Trash2,
  Copy,
} from '@lucide/vue'
import { asignarEspesorPendiente, pendienteResuelto } from '../services/pendientesAsistencia'
import { proformasService } from '../services/proformasService'
import {
  clonarTecnica,
  fusionarDatosTecnicos,
  leerDatosTecnicos,
  tecnicaIgual,
  validarDatosTecnicos,
  type AtributoTecnico,
  type ComponenteTecnico,
  type ConjuntoTecnico,
} from '../services/muebleTecnico'

import { calcularUnitarioExacto, totalComercialCoincide } from '../services/precioAsistido'

const props = defineProps<{
  tipos: ValorCatalogoPublico[]
  studio?: boolean
  activeSection?: 'general' | 'estructura' | 'accesorios' | 'imagenes' | 'comercial' | 'revision'
  especificacion?: EspecificacionMueble | null
  pendientesAsistencia?: PendienteAsistida[]
  processing?: boolean
  externalError?: string
  unidades?: ValorCatalogoPublico[]
  moneda?: 'BOB' | 'USD'
  detalle?: {
    tipo_item?: number
    descripcion?: string | null
    nombre?: string
    cantidad?: string | number
    unidad?: string | number
    precio_unitario?: string | number | null
    descuento?: string | number
    total?: string | number
  } | null
}>()
type ComercialMuebleEdit = {
  nombre: string
  descripcion: string
  cantidad: string
  unidad: number
  precio_unitario: string
  descuento: string
}
const emit = defineEmits<{
  save: [body: EspecificacionMuebleWritable, comercial: ComercialMuebleEdit]
  cancel: []
  changed: []
  typeCreated: [tipo: ValorCatalogoPublico]
  requestSection: [section: 'general' | 'estructura' | 'accesorios' | 'comercial' | 'revision']
  sectionStatus: [
    statuses: Record<
      'general' | 'estructura' | 'accesorios' | 'comercial' | 'revision',
      'pending' | 'issues' | 'complete'
    >,
  ]
}>()
const base = leerDatosTecnicos(props.especificacion?.datos_tecnicos)
const catalogo = ref<AtributoMueble[]>([])
const limites = reactive({ max_conjuntos: 10, max_componentes: 40 })
const catalogError = ref('')
const error = ref('')
const aviso = ref('')
const search = ref('')
const componentSearch = reactive<Record<string, string>>({})
const nuevoTipo = ref('')
const creatingType = ref(false)
const submitAttempted = ref(false)
const touched = reactive({ nombre: false, precio: false, cantidad: false, descuento: false })
const touchedMedidas = reactive<Record<string, boolean>>({})
const touchedPiezas = reactive<Record<string, boolean>>({})
const touchedGrupos = reactive<Record<string, boolean>>({})
const touchedAccesorios = reactive<Record<number, boolean>>({})
const tiposLocales = ref([...props.tipos])
const tiposParecidos = computed(() => {
  const buscar = normalized(nuevoTipo.value)
  if (buscar.length < 2) return []
  return tiposLocales.value
    .filter((tipo) => {
      const nombre = normalized(tipo.nombre)
      return (
        nombre.includes(buscar) ||
        buscar.includes(nombre) ||
        nombre.split(' ').some((parte) => parte.length >= 3 && buscar.includes(parte))
      )
    })
    .slice(0, 5)
})
const form = reactive({
  tipo_mueble: String(props.especificacion?.tipo_mueble ?? ''),
  observaciones: props.especificacion?.observaciones ?? '',
})
function normalizarCantidadInicial(valor: string | number | null | undefined): string {
  if (valor === undefined || valor === null) return '1'
  const texto = String(valor).trim()
  if (!texto) return ''
  const numero = Number(texto)
  if (Number.isFinite(numero) && Number.isInteger(numero) && /^[+-]?\d+(?:\.0+)?$/.test(texto)) {
    return String(numero)
  }
  return texto
}

const comercial = reactive({
  nombre: String(props.detalle?.nombre ?? ''),
  descripcion: String(props.detalle?.descripcion ?? ''),
  cantidad: normalizarCantidadInicial(props.detalle?.cantidad),
  unidad: String(
    props.detalle?.unidad ?? props.unidades?.find((x) => x.codigo === 'PIEZA')?.id ?? '',
  ),
  precio_unitario: String(props.detalle?.precio_unitario ?? ''),
  descuento: String(props.detalle?.descuento ?? '0.00'),
})
const unidadComercialNombre = computed(
  () => props.unidades?.find((u) => String(u.id) === comercial.unidad)?.nombre ?? 'unidad',
)
const destinosEspesor = reactive<Record<number, string>>({})
const espesoresConfirmados = reactive<Record<number, string>>({})

// El total dictado llega estructurado; nunca se extraen números de mensajes.
type PendienteComercial = PendienteAsistida & {
  total_negociado?: string | null
  moneda_codigo?: 'BOB' | 'USD'
}
const totalDictado = computed(() =>
  (props.pendientesAsistencia as PendienteComercial[] | undefined)?.find(
    (p) => p.codigo === 'TOTAL_NEGOCIADO' && p.total_negociado,
  ),
)
const unitarioSugerido = computed(() => {
  const total = totalDictado.value
  return total
    ? calcularUnitarioExacto(total.total_negociado!, comercial.cantidad, comercial.descuento)
    : null
})
const diferenciaComercial = computed(
  () =>
    !!totalDictado.value &&
    !!comercial.precio_unitario &&
    !totalComercialCoincide(
      totalDictado.value.total_negociado ?? '',
      comercial.cantidad,
      comercial.precio_unitario,
      comercial.descuento,
    ),
)
const diferenciaConfirmada = ref(false)
watch(
  () => [comercial.cantidad, comercial.precio_unitario, comercial.descuento],
  () => {
    diferenciaConfirmada.value = false
  },
)
// Propuesta exacta: completar de forma automática, sin botón de aceptación.
// Un precio ya ingresado o modificado manualmente nunca se sobrescribe.
const ultimoUnitarioAutomatico = ref<string | null>(null)
const precioEditadoManualmente = ref(Boolean(comercial.precio_unitario))
watch(
  () => comercial.precio_unitario,
  (valor) => {
    if (ultimoUnitarioAutomatico.value !== null && valor !== ultimoUnitarioAutomatico.value)
      precioEditadoManualmente.value = true
  },
  { flush: 'sync' },
)
watch(
  unitarioSugerido,
  (unitario) => {
    if (!totalDictado.value || precioEditadoManualmente.value) return
    if (unitario) {
      if (comercial.precio_unitario && ultimoUnitarioAutomatico.value === null) return
      ultimoUnitarioAutomatico.value = unitario
      comercial.precio_unitario = unitario
      changed()
    } else if (
      ultimoUnitarioAutomatico.value !== null &&
      comercial.precio_unitario === ultimoUnitarioAutomatico.value
    ) {
      ultimoUnitarioAutomatico.value = null
      comercial.precio_unitario = ''
      changed()
    }
  },
  { immediate: true, flush: 'sync' },
)
const pendientesVisibles = computed(() =>
  (props.pendientesAsistencia ?? [])
    .map((p, indice) => ({ ...p, indice }))
    .filter((p) => {
      if (p.codigo === 'TIPO_NO_RESUELTO') return !form.tipo_mueble
      if (p.codigo === 'NO_QUANTITY') return !comercial.cantidad || Number(comercial.cantidad) <= 0
      if (p.codigo === 'TOTAL_NEGOCIADO' || p.codigo === 'INVALID_PRICE')
        return !comercial.precio_unitario || Number(comercial.precio_unitario) <= 0
      if (p.codigo === 'ESPESOR_SIN_COMPONENTE') {
        const uid = espesoresConfirmados[p.indice]
        const valor = p.resolucion?.valor?.trim()
        return !uid || !componentes.some((c) => c.uid === uid && c.espesor?.trim() === valor)
      }
      return !pendienteResuelto(p, medidas, componentes, atributosGenerales)
    }),
)

function aplicarEspesor(p: PendienteAsistida & { indice: number }) {
  const uid = destinosEspesor[p.indice]
  if (!uid || !asignarEspesorPendiente(p, uid, componentes)) {
    error.value =
      'Seleccione un componente válido. No se reemplazará un espesor diferente sin revisión.'
    return
  }
  espesoresConfirmados[p.indice] = uid
  error.value = ''
  changed()
}
const cantidadValida = computed(
  () =>
    comercial.cantidad.trim() !== '' &&
    Number.isInteger(Number(comercial.cantidad)) &&
    Number(comercial.cantidad) > 0,
)
const precioValido = computed(
  () =>
    comercial.precio_unitario.trim() !== '' &&
    Number.isFinite(Number(comercial.precio_unitario)) &&
    Number(comercial.precio_unitario) > 0,
)
const descuentoValido = computed(
  () =>
    comercial.descuento.trim() !== '' &&
    Number.isFinite(Number(comercial.descuento)) &&
    Number(comercial.descuento) >= 0,
)
const totalEstimado = computed(() => {
  const cantidad = Number(comercial.cantidad)
  const precio = Number(comercial.precio_unitario)
  const descuento = Number(comercial.descuento)
  return comercial.precio_unitario.trim() &&
    comercial.cantidad.trim() &&
    comercial.descuento.trim() &&
    Number.isFinite(cantidad) &&
    Number.isFinite(precio) &&
    Number.isFinite(descuento) &&
    cantidad > 0 &&
    precio > 0 &&
    descuento >= 0 &&
    descuento <= cantidad * precio
    ? cantidad * precio - descuento
    : null
})
type Medida = { clave: string; valor: string; unidad: string; original?: unknown }
const clavesIniciales = ['ancho', 'alto', 'profundidad']
const unidadesPermitidas = ['mm', 'cm', 'm', 'pulgadas']

const generales = (base.caracteristicas_generales ?? {}) as Record<string, unknown>
const dimensiones = (
  generales.dimensiones &&
  typeof generales.dimensiones === 'object' &&
  !Array.isArray(generales.dimensiones)
    ? generales.dimensiones
    : {}
) as Record<string, unknown>
const medidas = reactive<Medida[]>(
  [...new Set([...clavesIniciales, ...Object.keys(dimensiones)])].map((clave) => {
    const original = dimensiones[clave]
    const objeto =
      original !== null && typeof original === 'object' && !Array.isArray(original)
        ? (original as Record<string, unknown>)
        : null
    return {
      clave,
      valor: String(
        objeto?.valor ??
          (typeof original === 'string' || typeof original === 'number' ? original : ''),
      ),
      unidad: String(
        objeto?.unidad ??
          (original === undefined &&
          !props.pendientesAsistencia?.some(
            (p) => p.resolucion?.tipo === 'DIMENSION' && p.resolucion.clave === clave,
          )
            ? 'cm'
            : ''),
      ),
      original: structuredClone(original),
    }
  }),
)
function pendientesDimension(clave: string) {
  return pendientesVisibles.value.filter(
    (p) => p.resolucion?.tipo === 'DIMENSION' && p.resolucion.clave === clave,
  )
}
function enfocarDimension(clave: string) {
  document.getElementById(`unidad-${clave}`)?.focus()
}

const nuevaMedida = ref('')
const opcionesMedidas = ['largo', 'diámetro', 'lado_1', 'lado_2', 'altura_total', 'ancho_mesón']
const medidasSugeridasDisponibles = computed(() =>
  opcionesMedidas.filter((x) => !medidas.some((m) => m.clave === x)),
)
function etiquetaMedidaVisual(clave: string) {
  const texto = clave.replace(/_/g, ' ').trim()
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : clave
}
function agregarMedidaElegida(value: string) {
  nuevaMedida.value = value
  agregarMedida()
}
function crearTipoDesdeBuscador(nombre: string) {
  nuevoTipo.value = nombre
  void createType()
}
function elegirAtributoGeneral(value: string) {
  const item = catalogo.value.find((x) => String(x.id) === value)
  if (item) addAttribute(atributosGenerales, item)
}
function agregarMedida() {
  const clave = nuevaMedida.value.trim().toLowerCase().replace(/\s+/g, '_')
  if (!clave) {
    aviso.value = 'Escribe el nombre de la medida.'
    return
  }
  if (medidas.some((x) => normalized(x.clave) === normalized(clave))) {
    aviso.value = 'Esta medida ya está agregada al mueble.'
    return
  }
  medidas.push({ clave, valor: '', unidad: 'cm' })
  nuevaMedida.value = ''
  changed()
}
function eliminarMedida(clave: string) {
  const index = medidas.findIndex((m) => m.clave === clave)
  if (index >= 0 && !clavesIniciales.includes(clave)) {
    medidas.splice(index, 1)
    changed()
  }
}
function serializarDimensiones(): unknown {
  const legado = generales.dimensiones
  const hayCambios = medidas.some((medida) => {
    const original = medida.original
    const objeto =
      original && typeof original === 'object' && !Array.isArray(original)
        ? (original as Record<string, unknown>)
        : null
    const valor = String(
      objeto?.valor ??
        (typeof original === 'string' || typeof original === 'number' ? original : ''),
    )
    const unidad = String(
      objeto?.unidad ??
        (original === undefined &&
        !props.pendientesAsistencia?.some(
          (p) => p.resolucion?.tipo === 'DIMENSION' && p.resolucion.clave === medida.clave,
        )
          ? 'cm'
          : ''),
    )
    return medida.valor !== valor || medida.unidad !== unidad
  })
  if (
    legado !== undefined &&
    (typeof legado !== 'object' || legado === null || Array.isArray(legado)) &&
    !hayCambios
  )
    return structuredClone(legado)
  const resultado: Record<string, unknown> = structuredClone(dimensiones)
  for (const medida of medidas) {
    const original = medida.original
    const viejo =
      original && typeof original === 'object' && !Array.isArray(original)
        ? (original as Record<string, unknown>)
        : null
    const viejoValor = String(
      viejo?.valor ??
        (typeof original === 'string' || typeof original === 'number' ? original : ''),
    )
    const viejaUnidad = String(viejo?.unidad ?? (original === undefined ? 'cm' : ''))
    if (medida.valor === viejoValor && medida.unidad === viejaUnidad && original !== undefined)
      continue
    if (!medida.valor.trim()) {
      delete resultado[medida.clave]
    } else {
      resultado[medida.clave] = {
        ...viejo,
        valor: medida.valor,
        ...(medida.unidad ? { unidad: medida.unidad } : {}),
      }
    }
  }
  for (const clave of Object.keys(resultado)) {
    if (!clavesIniciales.includes(clave) && !medidas.some((m) => m.clave === clave))
      delete resultado[clave]
  }
  return resultado
}
const conjuntos = reactive<ConjuntoTecnico[]>(structuredClone(base.conjuntos ?? []))
const componentes = reactive<ComponenteTecnico[]>(structuredClone(base.componentes ?? []))
const activeComponentUid = ref(componentes[0]?.uid ?? (componentes.length ? '0' : ''))
const gruposArbol = computed(() =>
  [
    ...conjuntos.map((grupo) => ({
      id: grupo.uid,
      nombre: grupo.nombre.trim() || 'Conjunto pendiente de nombre',
      piezas: componentes
        .map((pieza, index) => ({ pieza, index }))
        .filter((x) => x.pieza.conjunto_uid === grupo.uid),
    })),
    {
      id: 'independientes',
      nombre: 'Piezas independientes',
      piezas: componentes
        .map((pieza, index) => ({ pieza, index }))
        .filter((x) => !x.pieza.conjunto_uid),
    },
  ].filter((grupo) => grupo.piezas.length > 0),
)
const accesorios = reactive<string[]>(structuredClone(base.accesorios ?? []))
const accesorioEnEdicion = ref<number | null>(null)
const componentesRetirados = ref<Array<{ item: ComponenteTecnico; index: number }>>([])
const accesoriosRetirados = ref<Array<{ item: string; index: number }>>([])
const conjuntoPorEliminar = ref<string | null>(null)
const destinoDelConjunto = ref('')
const atributosGenerales = reactive<AtributoTecnico[]>(
  structuredClone((generales.atributos as AtributoTecnico[] | undefined) ?? []),
)
const atributosGeneralesDisponibles = computed(() =>
  catalogo.value.filter(
    (x) =>
      (!Array.isArray(x.ambitos) || !x.ambitos.length || x.ambitos.includes('mueble')) &&
      !atributosGenerales.some(
        (actual) =>
          (actual.codigo && actual.codigo === x.codigo) ||
          normalized(actual.nombre) === normalized(x.nombre),
      ),
  ),
)
function normalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}
function matchingAttributes(query: string, ambit?: string) {
  const q = normalized(query)
  return catalogo.value
    .filter((a) => {
      const ambitos = Array.isArray(a.ambitos) ? (a.ambitos as string[]) : []
      return !ambit || !ambitos.length || ambitos.includes(ambit)
    })
    .filter(
      (a) =>
        !q ||
        normalized(
          [a.nombre, ...(Array.isArray(a.sinonimos) ? (a.sinonimos as string[]) : [])].join(' '),
        ).includes(q),
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, 12)
}
const resultados = computed(() => {
  const q = normalized(search.value)
  return matchingAttributes(q, 'mueble').slice(0, q ? 12 : 8)
})
function changed() {
  emit('changed')
}
function elegirTipoSimilar(id: number) {
  form.tipo_mueble = String(id)
  nuevoTipo.value = ''
  changed()
}
function readableDimension(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'object') return String(value)
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${key}: ${readableDimension(item)}`)
    .join(' · ')
}
function uid() {
  return crypto.randomUUID()
}
function addConjunto() {
  if (conjuntos.length >= limites.max_conjuntos) {
    aviso.value = 'Has alcanzado el máximo de conjuntos permitidos.'
    return
  }
  if (conjuntos.some((g) => !componentes.some((c) => c.conjunto_uid === g.uid))) {
    aviso.value = 'Completa el conjunto existente con una pieza antes de crear otro.'
    return
  }
  conjuntos.push({ uid: uid(), nombre: '' })
  changed()
}
function removeConjunto(index: number) {
  const id = conjuntos[index]?.uid
  if (!id) return
  if (componentes.some((c) => c.conjunto_uid === id)) {
    conjuntoPorEliminar.value = id
    destinoDelConjunto.value = ''
    return
  }
  conjuntos.splice(index, 1)
  changed()
}
function confirmarDestinoDelConjunto(id: string) {
  if (conjuntoPorEliminar.value !== id) return
  const index = conjuntos.findIndex((g) => g.uid === id)
  if (index < 0) return
  const destino = destinoDelConjunto.value
  if (destino && (destino === id || !conjuntos.some((g) => g.uid === destino))) return
  for (const parte of componentes) {
    if (parte.conjunto_uid === id) {
      if (destino) parte.conjunto_uid = destino
      else delete parte.conjunto_uid
    }
  }
  conjuntos.splice(index, 1)
  conjuntoPorEliminar.value = null
  destinoDelConjunto.value = ''
  changed()
}
const piezasFrecuentes = ['Tablero', 'Mesón', 'Estructura', 'Puerta', 'Cajón', 'Estante']
function addComponente(conjunto_uid?: string, nombreInicial = '') {
  if (componentes.length >= limites.max_componentes) {
    aviso.value = 'Has alcanzado el máximo de componentes permitidos.'
    return
  }
  if (componentes.some((c) => !c.nombre.trim())) {
    aviso.value = 'Asigna un nombre al componente sin completar antes de agregar otro.'
    return
  }
  const nuevoUid = uid()
  componentes.push({
    uid: nuevoUid,
    conjunto_uid: conjunto_uid || undefined,
    nombre: nombreInicial,
    cantidad_interna: 1,
    atributos: [],
  })
  activeComponentUid.value = nuevoUid
  changed()
}
function resumenComponente(pieza: ComponenteTecnico): string {
  const partes: string[] = []
  if (pieza.cantidad_interna != null) {
    partes.push(`${pieza.cantidad_interna} ${pieza.cantidad_interna === 1 ? 'unidad' : 'unidades'}`)
  }
  if (pieza.material?.trim()) partes.push(pieza.material.trim())
  if (pieza.espesor?.trim()) partes.push(pieza.espesor.trim())
  if (pieza.color?.trim()) partes.push(pieza.color.trim())
  return partes.length ? partes.join(' · ') : 'Sin especificaciones aún'
}
function piezaConProblemas(pieza: ComponenteTecnico): boolean {
  if (!pieza.nombre?.trim())
    return Boolean(submitAttempted.value || touchedPiezas[pieza.uid ?? pieza.nombre])
  if (
    pieza.cantidad_interna !== undefined &&
    (!Number.isInteger(pieza.cantidad_interna) || pieza.cantidad_interna <= 0)
  )
    return true
  return Boolean(pieza.atributos?.some((a) => Boolean(errorAtributo(a))))
}
function atributosComponenteDisponibles(componente: ComponenteTecnico) {
  const actuales = componente.atributos ?? []
  return catalogo.value.filter(
    (x) =>
      (!Array.isArray(x.ambitos) || !x.ambitos.length || x.ambitos.includes('componente')) &&
      !actuales.some(
        (actual) =>
          (actual.codigo && actual.codigo === x.codigo) ||
          normalized(actual.nombre) === normalized(x.nombre),
      ),
  )
}
function elegirAtributoComponente(componente: ComponenteTecnico, value: string) {
  const item = catalogo.value.find((x) => String(x.id) === value)
  if (item) addAttribute(componente.atributos || (componente.atributos = []), item)
}
function crearAtributoComponente(componente: ComponenteTecnico, nombre: string) {
  addAttribute(componente.atributos || (componente.atributos = []), undefined, nombre)
}
function setCantidadInterna(componente: ComponenteTecnico, event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (value === '') delete componente.cantidad_interna
  else componente.cantidad_interna = Number(value)
  changed()
}
function removeComponente(index: number) {
  const item = componentes[index]
  if (!item) return
  componentesRetirados.value.push({
    item: JSON.parse(JSON.stringify(item)) as ComponenteTecnico,
    index,
  })
  componentes.splice(index, 1)
  if (activeComponentUid.value === (item.uid || String(index)))
    activeComponentUid.value = componentes[0]?.uid ?? (componentes.length ? '0' : '')
  changed()
}
function deshacerComponente() {
  const removed = componentesRetirados.value.pop()
  if (!removed) return
  componentes.splice(Math.min(removed.index, componentes.length), 0, removed.item)
  activeComponentUid.value = removed.item.uid ?? String(removed.index)
  changed()
}
const accesoriosFrecuentes = [
  'Pasacables',
  'Correderas telescópicas',
  'Bisagras cierre suave',
  'Tiradores metálicos',
  'Cerradura',
  'Tomacorrientes integrados',
  'Niveladores regulables',
]
const accesoriosRegistradosCount = computed(() => accesorios.filter((a) => a.trim()).length)
const accesoriosFrecuentesDisponibles = computed(() =>
  accesoriosFrecuentes.filter(
    (frecuente) => !accesorios.some((actual) => normalized(actual) === normalized(frecuente)),
  ),
)
function focusAccesorio(index: number) {
  if (!props.studio) return
  void nextTick(() => {
    document.getElementById(`accesorio-${index}`)?.focus()
  })
}
function editarAccesorio(index: number) {
  accesorioEnEdicion.value = index
  focusAccesorio(index)
}
function addAccesorio() {
  const emptyIndex = accesorios.findIndex((item) => !item.trim())
  if (emptyIndex >= 0) {
    if (props.studio) {
      editarAccesorio(emptyIndex)
      touchedAccesorios[emptyIndex] = true
    } else {
      aviso.value = 'Completa o elimina el accesorio sin descripción antes de agregar otro.'
    }
    return
  }
  accesorios.push('')
  accesorioEnEdicion.value = accesorios.length - 1
  focusAccesorio(accesorios.length - 1)
  changed()
}
function addAccesorioRapido(nombre: string) {
  const emptyIndex = accesorios.findIndex((item) => !item.trim())
  if (emptyIndex >= 0) {
    accesorios[emptyIndex] = nombre
    delete touchedAccesorios[emptyIndex]
    accesorioEnEdicion.value = null
    changed()
    return
  }
  accesorios.push(nombre)
  accesorioEnEdicion.value = null
  changed()
}
function onAccesorioKeydown(event: KeyboardEvent, index: number) {
  if (!props.studio) return
  if (event.key === 'Enter') {
    event.preventDefault()
    if (accesorios[index]?.trim()) {
      accesorioEnEdicion.value = null
    } else {
      touchedAccesorios[index] = true
    }
  } else if (event.key === 'Escape') {
    event.preventDefault()
    if (!accesorios[index]?.trim()) {
      accesorios.splice(index, 1)
      delete touchedAccesorios[index]
    }
    accesorioEnEdicion.value = null
  }
}
function removeAccesorio(index: number) {
  const item = accesorios[index]
  if (item === undefined) return
  accesoriosRetirados.value.push({ item, index })
  accesorios.splice(index, 1)
  accesorioEnEdicion.value = null
  changed()
}
function deshacerAccesorio() {
  const removed = accesoriosRetirados.value.pop()
  if (!removed) return
  accesorios.splice(Math.min(removed.index, accesorios.length), 0, removed.item)
  changed()
}
function duplicateComponente(index: number) {
  if (componentes.length >= limites.max_componentes) {
    aviso.value = 'No puedes duplicar: se alcanzó el máximo de componentes.'
    return
  }
  if (componentes.some((c) => !c.nombre.trim())) {
    aviso.value = 'Completa primero los componentes sin nombre.'
    return
  }
  const copy = clonarTecnica(componentes[index]!)
  copy.uid = uid()
  componentes.splice(index + 1, 0, copy)
  activeComponentUid.value = copy.uid
  changed()
}
function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= componentes.length) return
  const [item] = componentes.splice(index, 1)
  if (item) componentes.splice(target, 0, item)
  changed()
}
function addAttribute(target: AtributoTecnico[], option?: AtributoMueble, localName?: string) {
  const nombre = option?.nombre ?? localName?.trim() ?? search.value.trim()
  if (!nombre.trim()) {
    aviso.value = 'Escribe el nombre de la característica.'
    return
  }
  if (
    target.some((a) => normalized(a.codigo || a.nombre) === normalized(option?.codigo || nombre))
  ) {
    aviso.value = 'Esta característica ya está agregada.'
    return
  }
  target.push({
    ...(option ? { codigo: option.codigo, tipo_entrada: option.tipo_entrada } : {}),
    nombre,
    valor: '',
  })
  if (!localName) search.value = ''
  changed()
}
function addComponentAttribute(component: ComponenteTecnico, key: string, option?: AtributoMueble) {
  const query = componentSearch[key] || ''
  addAttribute(component.atributos || (component.atributos = []), option, query)
  componentSearch[key] = ''
}
async function loadCatalog() {
  try {
    const value = await proformasService.furnitureAttributes()
    catalogo.value = value.atributos
    Object.assign(limites, value.limites)
  } catch {
    catalogError.value =
      'Las sugerencias no están disponibles. Puedes añadir atributos personalizados.'
  }
}
async function createType() {
  if (!nuevoTipo.value.trim() || creatingType.value) return
  creatingType.value = true
  error.value = ''
  try {
    const value = await proformasService.createFurnitureType({ nombre: nuevoTipo.value })
    const creado: ValorCatalogoPublico = { ...value, concepto_codigo: 'TIPO_MUEBLE' }
    tiposLocales.value.push(creado)
    emit('typeCreated', creado)
    form.tipo_mueble = String(value.id)
    nuevoTipo.value = ''
    changed()
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 409 && cause.fields['existente.id']?.[0]) {
      const id = cause.fields['existente.id'][0]
      const nombre = cause.fields['existente.nombre']?.[0] ?? nuevoTipo.value.trim()
      const codigo = cause.fields['existente.codigo']?.[0] ?? ''
      const existente: ValorCatalogoPublico = {
        id: Number(id),
        codigo,
        nombre,
        concepto_codigo: 'TIPO_MUEBLE',
      }
      if (!tiposLocales.value.some((item) => String(item.id) === id)) {
        tiposLocales.value.push(existente)
      }
      emit('typeCreated', existente)
      form.tipo_mueble = id
      nuevoTipo.value = ''
      error.value = 'Ese tipo ya existía y fue seleccionado.'
      changed()
    } else error.value = cause instanceof Error ? cause.message : 'No se pudo crear el tipo.'
  } finally {
    creatingType.value = false
  }
}
type SeccionStudio = 'general' | 'estructura' | 'accesorios' | 'comercial' | 'revision'
const pasosValidacion: SeccionStudio[] = ['general', 'estructura', 'accesorios', 'comercial']
const erroresSecciones = computed<Record<SeccionStudio, string[]>>(() => {
  const problemas: Record<SeccionStudio, string[]> = {
    general: [],
    estructura: [],
    accesorios: [],
    comercial: [],
    revision: [],
  }
  if (!comercial.nombre.trim()) problemas.general.push('Indica el nombre comercial del mueble.')
  for (const medida of medidas) {
    if (!medida.valor.trim() || dimensionSinModificar(medida)) continue
    const numero = Number(medida.valor)
    if (!Number.isFinite(numero) || numero <= 0)
      problemas.general.push(
        'Introduce una medida válida y positiva para ' + medida.clave.replace(/_/g, ' ') + '.',
      )
    if (!medida.unidad)
      problemas.general.push('Confirma la unidad de ' + medida.clave.replace(/_/g, ' ') + '.')
  }
  if (atributosGenerales.some((a) => !a.nombre.trim() || !a.valor.trim()))
    problemas.general.push('Completa o quita las características generales sin valor.')
  if (conjuntos.some((g) => !g.nombre.trim()))
    problemas.estructura.push('Pon un nombre a cada conjunto.')
  if (componentes.some((c) => !c.nombre.trim()))
    problemas.estructura.push('Pon un nombre a cada componente.')
  if (
    componentes.some(
      (c) =>
        c.cantidad_interna !== undefined &&
        (!Number.isInteger(c.cantidad_interna) || c.cantidad_interna <= 0),
    )
  )
    problemas.estructura.push('La cantidad de cada componente debe ser un número entero positivo.')
  if (conjuntos.some((g) => !componentes.some((c) => c.conjunto_uid === g.uid)))
    problemas.estructura.push('Cada conjunto necesita al menos un componente.')
  if (componentes.some((c) => c.atributos?.some((a) => !a.nombre.trim() || !a.valor.trim())))
    problemas.estructura.push('Completa o quita las características vacías de los componentes.')
  if (accesorios.some((a) => !a.trim()))
    problemas.accesorios.push('Completa o quita los accesorios sin descripción.')
  if (
    !comercial.cantidad.trim() ||
    !Number.isInteger(Number(comercial.cantidad)) ||
    Number(comercial.cantidad) <= 0
  )
    problemas.comercial.push('La cantidad cotizada debe ser un número entero mayor que cero.')
  if (
    !props.unidades?.some(
      (u) => ['PIEZA', 'JUEGO'].includes(u.codigo) && String(u.id) === comercial.unidad,
    )
  )
    problemas.comercial.push('Elige una unidad comercial válida.')
  if (
    !comercial.precio_unitario.trim() ||
    !Number.isFinite(Number(comercial.precio_unitario)) ||
    Number(comercial.precio_unitario) <= 0
  )
    problemas.comercial.push('Introduce un precio unitario mayor que cero.')
  if (
    !comercial.descuento.trim() ||
    !Number.isFinite(Number(comercial.descuento)) ||
    Number(comercial.descuento) < 0
  )
    problemas.comercial.push('Indica un descuento válido; escribe cero si no hay descuento.')
  else if (
    Number(comercial.descuento) >
    Number(comercial.cantidad) * Number(comercial.precio_unitario)
  )
    problemas.comercial.push('El descuento no puede superar el subtotal.')
  if (diferenciaComercial.value && !diferenciaConfirmada.value)
    problemas.comercial.push(
      'Confirma la diferencia entre el precio dictado y el importe indicado.',
    )
  return problemas
})
const tieneErroresRevision = computed(() =>
  Object.values(erroresSecciones.value).some((lista) => lista.length > 0),
)
const revisionCompleta = computed(
  () => !tieneErroresRevision.value && pendientesVisibles.value.length === 0,
)
const accesoriosRegistrados = computed(() => accesorios.filter((a) => a.trim()))
const medidasRegistradas = computed(() => medidas.filter((m) => m.valor.trim()))
const nombreTipoMueble = computed(
  () => tiposLocales.value.find((x) => String(x.id) === form.tipo_mueble)?.nombre ?? '',
)
function piezaTieneDetalles(pieza: ComponenteTecnico): boolean {
  return Boolean(
    pieza.material || pieza.espesor || pieza.color || pieza.dimensiones || pieza.atributos?.length,
  )
}
const estadoSecciones = computed<Record<SeccionStudio, 'pending' | 'issues' | 'complete'>>(() => ({
  general: erroresSecciones.value.general.length
    ? comercial.nombre.trim() || submitAttempted.value
      ? 'issues'
      : 'pending'
    : 'complete',
  estructura: erroresSecciones.value.estructura.length
    ? 'issues'
    : componentes.length
      ? 'complete'
      : 'pending',
  accesorios: erroresSecciones.value.accesorios.length
    ? 'issues'
    : accesorios.length || form.observaciones.trim()
      ? 'complete'
      : 'pending',
  comercial: erroresSecciones.value.comercial.length
    ? comercial.precio_unitario.trim() || submitAttempted.value
      ? 'issues'
      : 'pending'
    : 'complete',
  revision: 'pending',
}))
watch(estadoSecciones, (value) => emit('sectionStatus', value), { immediate: true })
function dimensionSinModificar(medida: Medida): boolean {
  const original = medida.original
  if (original === undefined) return false
  if (typeof original === 'object' && original !== null && !Array.isArray(original)) {
    const dim = original as Record<string, unknown>
    return String(dim.valor ?? '') === medida.valor && String(dim.unidad ?? '') === medida.unidad
  }
  return String(original) === medida.valor
}
function errorMedida(medida: Medida): string {
  if (!touchedMedidas[medida.clave] && !submitAttempted.value) return ''
  if (!medida.valor.trim() || dimensionSinModificar(medida)) return ''
  if (!Number.isFinite(Number(medida.valor)) || Number(medida.valor) <= 0)
    return 'Introduce una medida numérica mayor que cero.'
  if (!medida.unidad) return 'Confirma la unidad de la medida.'
  return ''
}
function errorAtributo(a: AtributoTecnico): string {
  if (!submitAttempted.value) return ''
  if (!a.nombre.trim() || !a.valor.trim()) return 'Completa esta característica o quítala.'
  if (a.tipo_entrada === 'entero' && (!Number.isInteger(Number(a.valor)) || Number(a.valor) < 0))
    return 'Introduce un número entero válido.'
  if (a.tipo_entrada === 'numero_unidad') {
    if (!Number.isFinite(Number(a.valor))) return 'Introduce un número válido.'
    if (!a.unidad?.trim()) return 'Selecciona una unidad.'
  }
  return ''
}
function errorGrupo(grupo: ConjuntoTecnico): string {
  return (submitAttempted.value || touchedGrupos[grupo.uid]) && !grupo.nombre.trim()
    ? 'Pon un nombre a este conjunto.'
    : ''
}
function errorAccesorio(index: number): string {
  return (submitAttempted.value || touchedAccesorios[index]) && !accesorios[index]?.trim()
    ? 'Describe el accesorio o quítalo.'
    : ''
}
function errorPieza(pieza: ComponenteTecnico): string {
  if (!touchedPiezas[pieza.uid ?? pieza.nombre] && !submitAttempted.value) return ''
  return pieza.nombre.trim() ? '' : 'Introduce el nombre de este componente.'
}
function errorCampo(seccion: SeccionStudio, index: number, touchedField = false): string {
  if (!submitAttempted.value && !touchedField) return ''
  if (seccion === 'general' && index === 0)
    return !comercial.nombre.trim() ? 'Indica el nombre comercial del mueble.' : ''
  if (seccion !== 'comercial') return ''
  if (index === 0)
    return !comercial.cantidad.trim() ||
      !Number.isInteger(Number(comercial.cantidad)) ||
      Number(comercial.cantidad) <= 0
      ? 'Introduce una cantidad entera mayor que cero.'
      : ''
  if (index === 2)
    return !comercial.precio_unitario.trim() ||
      !Number.isFinite(Number(comercial.precio_unitario)) ||
      Number(comercial.precio_unitario) <= 0
      ? 'Introduce un precio unitario mayor que cero.'
      : ''
  if (index === 3)
    return !comercial.descuento.trim() ||
      !Number.isFinite(Number(comercial.descuento)) ||
      Number(comercial.descuento) < 0 ||
      Number(comercial.descuento) > Number(comercial.cantidad) * Number(comercial.precio_unitario)
      ? 'El descuento debe ser válido y no superar el subtotal.'
      : ''
  return ''
}
function irASeccion(seccion: SeccionStudio) {
  emit('requestSection', seccion)
}

function submit(): boolean {
  submitAttempted.value = true
  const dim = serializarDimensiones()
  const generalesActuales: Record<string, unknown> = { ...generales }
  const dimensionesPresentes =
    dim != null && typeof dim === 'object' && !Array.isArray(dim)
      ? Object.keys(dim).length > 0
      : dim !== null && dim !== undefined
  if (Object.prototype.hasOwnProperty.call(generales, 'dimensiones') || dimensionesPresentes)
    generalesActuales.dimensiones = dim
  if (Object.prototype.hasOwnProperty.call(generales, 'atributos') || atributosGenerales.length)
    generalesActuales.atributos = atributosGenerales
  const cambios: Parameters<typeof fusionarDatosTecnicos>[1] = {}
  if (
    Object.prototype.hasOwnProperty.call(base, 'caracteristicas_generales') ||
    Object.keys(generalesActuales).length
  )
    cambios.caracteristicas_generales = generalesActuales
  if (Object.prototype.hasOwnProperty.call(base, 'conjuntos') || conjuntos.length)
    cambios.conjuntos = conjuntos
  if (Object.prototype.hasOwnProperty.call(base, 'componentes') || componentes.length)
    cambios.componentes = componentes
  if (Object.prototype.hasOwnProperty.call(base, 'accesorios') || accesorios.length)
    cambios.accesorios = accesorios
  const datos = fusionarDatosTecnicos(base, cambios)
  // Un histórico anterior a PRF-03 puede exceder 10/40.
  // Solo admitir ese exceso si las colecciones permanecen idénticas.
  const limitesCompatibles = {
    max_conjuntos:
      conjuntos.length > limites.max_conjuntos && tecnicaIgual(conjuntos, base.conjuntos ?? [])
        ? conjuntos.length
        : limites.max_conjuntos,
    max_componentes:
      componentes.length > limites.max_componentes &&
      tecnicaIgual(componentes, base.componentes ?? [])
        ? componentes.length
        : limites.max_componentes,
  }
  const errores = validarDatosTecnicos(datos, limitesCompatibles)
  for (const medida of medidas) {
    if (!medida.valor.trim() || dimensionSinModificar(medida)) continue
    if (!Number.isFinite(Number(medida.valor)) || Number(medida.valor) <= 0)
      errores.push('La medida ' + medida.clave.replace(/_/g, ' ') + ' debe ser un número positivo.')
    if (!medida.unidad) errores.push('Indica la unidad de ' + medida.clave.replace(/_/g, ' ') + '.')
  }
  const atributos = [
    ...atributosGenerales,
    ...componentes.flatMap((parte) => parte.atributos ?? []),
  ]
  for (const atributo of atributos) {
    if (
      atributo.tipo_entrada === 'entero' &&
      (!/^\d+$/.test(atributo.valor.trim()) || Number(atributo.valor) < 0)
    )
      errores.push(`El atributo ${atributo.nombre} debe tener un número entero válido.`)
    if (atributo.tipo_entrada === 'numero_unidad') {
      if (!atributo.unidad?.trim()) errores.push(`Indica la unidad de ${atributo.nombre}.`)
      if (!atributo.valor.trim() || !Number.isFinite(Number(atributo.valor)))
        errores.push(`El atributo ${atributo.nombre} requiere un número válido.`)
    }
  }
  if (accesorios.some((item) => !item.trim()))
    errores.push('Completa o elimina el accesorio sin descripción.')
  const cantidad = Number(comercial.cantidad)
  const precio = Number(comercial.precio_unitario)
  const descuento = Number(comercial.descuento)
  if (!comercial.nombre.trim()) errores.push('Indica el nombre comercial del mueble.')
  if (!Number.isInteger(cantidad) || cantidad <= 0)
    errores.push('La cantidad cotizada debe ser un entero positivo.')
  if (
    !props.unidades?.some(
      (u) => ['PIEZA', 'JUEGO'].includes(u.codigo) && String(u.id) === comercial.unidad,
    )
  )
    errores.push('La unidad debe ser PIEZA o JUEGO.')
  if (!Number.isFinite(precio) || precio <= 0)
    errores.push('El precio unitario negociado debe ser positivo.')
  if (!comercial.descuento.trim())
    errores.push('Indica el descuento de línea; usa cero si no hay descuento.')
  else if (!Number.isFinite(descuento) || descuento < 0 || descuento > cantidad * precio)
    errores.push('El descuento de línea no puede superar el importe bruto.')
  if (diferenciaComercial.value && !diferenciaConfirmada.value)
    errores.push('Confirma la diferencia entre el total dictado y el importe comercial ingresado.')
  if (errores.length) {
    error.value = errores.join(' ')
    return false
  }
  emit(
    'save',
    {
      tipo_mueble: form.tipo_mueble ? Number(form.tipo_mueble) : null,
      datos_tecnicos: datos,
      observaciones: form.observaciones || null,
    },
    {
      nombre: comercial.nombre.trim(),
      descripcion: comercial.descripcion,
      cantidad: comercial.cantidad,
      unidad: Number(comercial.unidad),
      precio_unitario: comercial.precio_unitario,
      descuento: comercial.descuento,
    },
  )
  return true
}
defineExpose({ submit })
onMounted(loadCatalog)
</script>

<template>
  <form
    class="configurator"
    :class="{ 'configurator--studio': studio }"
    @input="changed"
    @change="changed"
    @submit.prevent="submit"
  >
    <Toast :visible="Boolean(aviso)" :message="aviso" tone="info" @close="aviso = ''" />
    <header v-if="!studio" class="config-header">
      <div>
        <p class="eyebrow">Mueble a pedido · Sin guardar</p>
        <h2>{{ detalle?.nombre || 'Nuevo mueble a pedido' }}</h2>
      </div>
      <nav aria-label="Apartados del configurador">
        <a href="#identificacion">Identificación</a><a href="#dimensiones">Dimensiones</a
        ><a href="#componentes">Componentes</a><a href="#accesorios">Accesorios</a
        ><a href="#comercial">Datos comerciales</a><a href="#revision">Revisar</a>
      </nav>
    </header>
    <div class="configurator-layout">
      <div class="configurator-fields">
        <aside
          v-if="pendientesVisibles.length && !studio"
          class="pending-summary"
          aria-label="Información pendiente"
          aria-live="polite"
        >
          <h3>Información pendiente</h3>
          <ul>
            <li v-for="p in pendientesVisibles" :key="p.indice">
              <span>{{ p.mensaje }}</span>
              <Button
                v-if="
                  p.resolucion?.tipo === 'DIMENSION' &&
                  medidas.some((m) => m.clave === p.resolucion?.clave)
                "
                variant="secondary"
                @click="enfocarDimension(p.resolucion.clave!)"
                >Revisar {{ p.resolucion.clave }}</Button
              >
              <div
                v-if="
                  p.codigo === 'ESPESOR_SIN_COMPONENTE' &&
                  p.resolucion?.tipo === 'ESPESOR_SIN_COMPONENTE' &&
                  p.resolucion.valor
                "
                class="inline"
              >
                <label>
                  Componente para {{ p.resolucion.valor }}
                  <select v-model="destinosEspesor[p.indice]">
                    <option value="">Seleccione un componente</option>
                    <option v-for="c in componentes" :key="c.uid" :value="c.uid">
                      {{ c.nombre }}
                    </option>
                  </select>
                </label>
                <Button variant="secondary" @click="aplicarEspesor(p)"> Asignar espesor </Button>
              </div>
            </li>
          </ul>
        </aside>
        <section id="identificacion" v-show="!studio || activeSection === 'general'">
          <h3>
            <span class="section-heading-main"
              ><Tag v-if="studio" :size="19" aria-hidden="true" />Identificación</span
            >
            <span v-if="studio" class="section-badge section-badge--required"
              >Nombre obligatorio</span
            >
          </h3>
          <p v-if="studio" class="section-guidance">
            Identifica el mueble con un nombre claro para reconocerlo en la proforma y clasifícalo
            si corresponde.
          </p>
          <div class="studio-identification-fields">
            <TextField
              v-model="comercial.nombre"
              name="mueble-nombre-comercial"
              label="Nombre comercial del mueble *"
              :placeholder="studio ? 'Ej. Mesa de reunión para 10 personas' : undefined"
              :max-length="200"
              :error="errorCampo('general', 0, touched.nombre)"
              @blur="touched.nombre = true"
            />
            <MuebleOptionPicker
              v-if="studio"
              v-model="form.tipo_mueble"
              name="tipo-mueble-buscador"
              label="Tipo de mueble (opcional)"
              :options="tiposLocales.map((x) => ({ label: x.nombre, value: String(x.id) }))"
              placeholder="Buscar o crear un tipo..."
              allow-create
              create-label="Crear nuevo tipo"
              :busy="creatingType"
              @create="crearTipoDesdeBuscador"
            />
            <template v-else>
              <Select
                v-model="form.tipo_mueble"
                name="tipo-mueble"
                label="Tipo de mueble"
                :options="[
                  { label: 'Sin especificar', value: '' },
                  ...tiposLocales.map((x) => ({ label: x.nombre, value: String(x.id) })),
                ]"
              />
              <div class="inline">
                <TextField
                  v-model="nuevoTipo"
                  name="nuevo-tipo"
                  label="Buscar o crear tipo de mueble"
                /><Button variant="secondary" :processing="creatingType" @click="createType"
                  >Crear tipo</Button
                >
              </div>
              <div
                v-if="tiposParecidos.length"
                class="suggestions"
                role="group"
                aria-label="Tipos de mueble similares existentes"
              >
                <p>Tipos existentes similares; selecciónalos para evitar duplicados:</p>
                <button
                  v-for="tipo in tiposParecidos"
                  :key="tipo.id"
                  type="button"
                  @click="elegirTipoSimilar(tipo.id)"
                >
                  {{ tipo.nombre }}
                </button>
              </div>
            </template>
          </div>
        </section>
        <section
          id="dimensiones"
          class="dimensions-section"
          v-show="!studio || activeSection === 'general'"
        >
          <h3>
            <span class="section-heading-main"
              ><Ruler v-if="studio" :size="19" aria-hidden="true" />{{
                studio ? 'Dimensiones generales' : 'Dimensiones generales opcionales'
              }}</span
            >
            <span v-if="studio" class="section-badge">Opcional</span>
          </h3>
          <p>
            {{
              studio
                ? 'Registra las medidas principales del mueble. Puedes dejar vacías las que no apliquen o sumar otras.'
                : 'Cada medida conserva su unidad y los datos técnicos originales.'
            }}
          </p>
          <div class="measure-grid">
            <div
              v-for="medida in medidas"
              :key="medida.clave"
              class="inline measure-row"
              :class="{
                'measure-row--removable': !clavesIniciales.includes(medida.clave),
                'measure-row--filled': Boolean(medida.valor.trim()),
              }"
            >
              <TextField
                v-model="medida.valor"
                :name="medida.clave"
                :label="medida.clave.replace(/_/g, ' ')"
                :placeholder="studio ? 'Sin definir' : undefined"
                input-mode="decimal"
                :error="errorMedida(medida)"
                @blur="touchedMedidas[medida.clave] = true"
              />
              <label class="measure-unit"
                ><span :class="{ 'sr-only': studio }">Unidad</span>
                <select
                  :id="`unidad-${medida.clave}`"
                  v-model="medida.unidad"
                  :aria-label="'Unidad de ' + medida.clave"
                  :aria-invalid="pendientesDimension(medida.clave).length ? true : undefined"
                  :aria-describedby="
                    pendientesDimension(medida.clave).length
                      ? `pendiente-${medida.clave}`
                      : undefined
                  "
                >
                  <option value="">{{ studio ? 'Sin unidad' : 'Sin unidad identificada' }}</option>
                  <option v-for="unidad in unidadesPermitidas" :key="unidad" :value="unidad">
                    {{ unidad }}
                  </option>
                </select>
              </label>
              <button
                v-if="studio && !clavesIniciales.includes(medida.clave)"
                type="button"
                class="card-remove-action"
                :aria-label="`Quitar medida ${medida.clave.replace(/_/g, ' ')}`"
                @click="eliminarMedida(medida.clave)"
              >
                <Trash2 :size="14" aria-hidden="true" /> Quitar
              </button>
              <p
                v-if="pendientesDimension(medida.clave).length"
                :id="`pendiente-${medida.clave}`"
                class="dimension-pending"
              >
                <strong>Revisar {{ medida.clave }}:</strong>
                {{
                  pendientesDimension(medida.clave)
                    .map((p) => p.mensaje)
                    .join(' ')
                }}
              </p>
              <Button
                v-if="!studio && !clavesIniciales.includes(medida.clave)"
                variant="secondary"
                @click="eliminarMedida(medida.clave)"
                >Quitar medida</Button
              >
            </div>
          </div>
          <div v-if="!studio" class="inline">
            <label
              >Nueva medida
              <input v-model="nuevaMedida" list="medidas-sugeridas" aria-label="Nueva medida" />
            </label>
            <datalist id="medidas-sugeridas">
              <option v-for="opcion in opcionesMedidas" :key="opcion" :value="opcion" />
            </datalist>
            <Button variant="secondary" :disabled="!nuevaMedida.trim()" @click="agregarMedida"
              >Añadir medida</Button
            >
          </div>
          <div v-else class="section-adder">
            <div v-if="medidasSugeridasDisponibles.length" class="quick-chips">
              <span class="quick-chips__label">Medidas frecuentes:</span>
              <button
                v-for="sugerida in medidasSugeridasDisponibles"
                :key="sugerida"
                type="button"
                class="quick-chip"
                @click="agregarMedidaElegida(sugerida)"
              >
                <Plus :size="14" aria-hidden="true" /> {{ etiquetaMedidaVisual(sugerida) }}
              </button>
            </div>
            <MuebleOptionPicker
              :model-value="''"
              name="agregar-medida"
              label="Agregar medida"
              placeholder="Buscar o escribir una medida, por ejemplo: diámetro"
              :options="
                medidasSugeridasDisponibles.map((x) => ({
                  value: x,
                  label: etiquetaMedidaVisual(x),
                }))
              "
              allow-create
              create-label="Agregar medida personalizada"
              @update:model-value="agregarMedidaElegida"
              @create="agregarMedidaElegida"
            />
          </div>
        </section>
        <section
          id="caracteristicas-generales"
          class="general-attributes-section"
          v-show="!studio || activeSection === 'general'"
        >
          <h3>
            <span class="section-heading-main"
              ><SlidersHorizontal v-if="studio" :size="19" aria-hidden="true" />Características
              generales</span
            >
            <span v-if="studio" class="section-badge">Opcional</span>
          </h3>
          <p v-if="studio" class="section-guidance">
            Añade materiales, acabados u otros detalles generales cuando correspondan.
          </p>
          <p v-if="catalogError" role="status">{{ catalogError }}</p>
          <p v-if="studio && !atributosGenerales.length" class="general-attributes-empty">
            Sin características generales registradas. Puedes sumar material principal, acabado o
            tono desde el buscador de abajo.
          </p>
          <div v-if="atributosGenerales.length" class="studio-attributes-grid">
            <div
              v-for="(a, i) in atributosGenerales"
              :key="a.codigo || a.nombre"
              class="inline studio-attribute-row"
              :class="{ 'studio-attribute-row--with-unit': a.tipo_entrada === 'numero_unidad' }"
            >
              <label v-if="a.tipo_entrada === 'entero'" class="studio-attribute-field">
                <span>{{ a.nombre }}</span>
                <input v-model="a.valor" :name="`general-${i}`" type="number" step="1" />
              </label>
              <label v-else-if="a.tipo_entrada === 'numero_unidad'" class="studio-attribute-field">
                <span>{{ a.nombre }}</span>
                <input v-model="a.valor" :name="`general-${i}`" type="number" step="any" />
              </label>
              <TextField
                v-else
                v-model="a.valor"
                :name="`general-${i}`"
                :label="a.nombre"
                :placeholder="studio ? 'Especifica el valor' : undefined"
              />
              <label v-if="a.tipo_entrada === 'numero_unidad'" class="studio-attribute-unit"
                ><span :class="{ 'sr-only': studio }">Unidad de {{ a.nombre }}</span>
                <select v-model="a.unidad" :aria-label="`Unidad de ${a.nombre}`">
                  <option value="">No especificada</option>
                  <option v-for="unidad in unidadesPermitidas" :key="unidad" :value="unidad">
                    {{ unidad }}
                  </option>
                </select>
              </label>
              <button
                v-if="studio"
                type="button"
                class="card-remove-action"
                :aria-label="`Quitar característica ${a.nombre}`"
                @click="atributosGenerales.splice(i, 1)"
              >
                <Trash2 :size="14" aria-hidden="true" /> Quitar
              </button>
              <Button v-else variant="secondary" @click="atributosGenerales.splice(i, 1)"
                >Quitar</Button
              >
              <p v-if="errorAtributo(a)" class="studio-attribute-error" role="alert">
                {{ errorAtributo(a) }}
              </p>
            </div>
          </div>
          <div class="attribute-search" :class="{ 'section-adder': studio }">
            <div v-if="studio && atributosGeneralesDisponibles.length" class="quick-chips">
              <span class="quick-chips__label">Sugeridas:</span>
              <button
                v-for="sugerido in atributosGeneralesDisponibles.slice(0, 5)"
                :key="sugerido.id"
                type="button"
                class="quick-chip"
                @click="elegirAtributoGeneral(String(sugerido.id))"
              >
                <Plus :size="14" aria-hidden="true" /> {{ sugerido.nombre }}
              </button>
            </div>
            <MuebleOptionPicker
              v-if="studio"
              :model-value="''"
              name="buscar-atributo-estudio"
              label="Agregar característica"
              placeholder="Buscar o crear característica (ej. material, acabado)..."
              :options="
                atributosGeneralesDisponibles.map((x) => ({ value: String(x.id), label: x.nombre }))
              "
              allow-create
              create-label="Agregar característica personalizada"
              @update:model-value="elegirAtributoGeneral"
              @create="addAttribute(atributosGenerales, undefined, $event)"
            />
            <TextField
              v-else
              v-model="search"
              name="buscar-atributo"
              label="Buscar característica"
            />
            <div v-if="search && !studio" class="suggestions">
              <button
                v-for="item in resultados"
                :key="item.id"
                type="button"
                @click="addAttribute(atributosGenerales, item)"
              >
                {{ item.nombre }} · {{ item.grupo }}</button
              ><button type="button" @click="addAttribute(atributosGenerales)">
                Añadir “{{ search }}” como atributo local
              </button>
            </div>
          </div>
        </section>
        <section
          v-show="!studio || activeSection === 'estructura'"
          :class="{
            'studio-group-management': studio,
            'studio-group-management--compact': studio && !conjuntos.length,
          }"
        >
          <div class="heading group-management-header">
            <div class="group-management-copy">
              <h3>
                <span class="section-heading-main"
                  ><Layers3 v-if="studio" :size="19" aria-hidden="true" />{{
                    studio
                      ? 'Conjuntos'
                      : `Conjuntos (${conjuntos.length}/${limites.max_conjuntos})`
                  }}</span
                >
                <span v-if="studio" class="section-badge">{{
                  conjuntos.length
                    ? `${conjuntos.length} ${conjuntos.length === 1 ? 'módulo' : 'módulos'}${conjuntos.length >= limites.max_conjuntos - 2 ? ` de ${limites.max_conjuntos}` : ''}`
                    : 'Opcional'
                }}</span>
              </h3>
              <p v-if="studio" class="structure-guidance">
                {{
                  conjuntos.length
                    ? 'Agrupa piezas relacionadas por cada módulo o sección del mueble.'
                    : 'Úsalos solo si el mueble se divide en módulos (ej. escritorio + cajonera).'
                }}
              </p>
            </div>
            <Button
              variant="secondary"
              :disabled="
                !studio &&
                (conjuntos.length >= limites.max_conjuntos ||
                  conjuntos.some((g) => !componentes.some((c) => c.conjunto_uid === g.uid)))
              "
              @click="addConjunto"
              ><Plus v-if="studio" :size="15" aria-hidden="true" />Añadir conjunto</Button
            >
          </div>
          <div v-if="conjuntos.length" class="studio-groups-list">
            <article v-for="(g, gi) in conjuntos" :key="g.uid" class="card studio-group-card">
              <div class="inline studio-group-card__row">
                <TextField
                  v-model="g.nombre"
                  :name="`grupo-${gi}`"
                  label="Nombre del conjunto *"
                  :placeholder="studio ? 'Ej. Módulo principal, Cajonera lateral' : undefined"
                  :error="errorGrupo(g)"
                  @blur="touchedGrupos[g.uid] = true"
                />
                <span v-if="studio" class="studio-group-card__count">
                  {{ componentes.filter((c) => c.conjunto_uid === g.uid).length }}
                  {{
                    componentes.filter((c) => c.conjunto_uid === g.uid).length === 1
                      ? 'pieza'
                      : 'piezas'
                  }}
                </span>
                <div class="studio-group-card__actions">
                  <Button variant="secondary" @click="addComponente(g.uid)"
                    >Añadir componente</Button
                  ><Button variant="secondary" @click="removeConjunto(gi)">Quitar conjunto</Button>
                </div>
              </div>
              <div
                v-if="conjuntoPorEliminar === g.uid"
                class="conjunto-destino"
                role="group"
                :aria-label="'Reasignación del conjunto ' + g.nombre"
              >
                <p>Elige a dónde mover sus componentes. Ninguna pieza se eliminará.</p>
                <div class="conjunto-destino__controls">
                  <label class="conjunto-destino__select"
                    ><span>Destino de componentes</span>
                    <select v-model="destinoDelConjunto" aria-label="Destino de componentes">
                      <option value="">Sin conjunto</option>
                      <option
                        v-for="otro in conjuntos.filter((c) => c.uid !== g.uid)"
                        :key="otro.uid"
                        :value="otro.uid"
                      >
                        {{ otro.nombre }}
                      </option>
                    </select>
                  </label>
                  <Button variant="secondary" @click="confirmarDestinoDelConjunto(g.uid)">
                    Mover componentes y quitar conjunto
                  </Button>
                  <Button variant="secondary" @click="conjuntoPorEliminar = null"
                    >Cancelar traslado</Button
                  >
                </div>
              </div>
            </article>
          </div>
        </section>
        <section id="componentes" v-show="!studio || activeSection === 'estructura'">
          <div class="heading components-section-header">
            <div class="components-section-copy">
              <h3>
                <span class="section-heading-main"
                  ><Package v-if="studio" :size="19" aria-hidden="true" />{{
                    studio
                      ? 'Componentes del mueble'
                      : `Componentes (${componentes.length}/${limites.max_componentes})`
                  }}</span
                >
                <span v-if="studio" class="section-badge">{{
                  componentes.length
                    ? `${componentes.length} ${componentes.length === 1 ? 'pieza' : 'piezas'}${componentes.length >= limites.max_componentes - 5 ? ` de ${limites.max_componentes}` : ''}`
                    : 'Opcional'
                }}</span>
              </h3>
              <p v-if="studio" class="structure-guidance">
                Detalla las piezas principales (tablero, estructura, puertas) para orientar la
                cotización y fabricación.
              </p>
            </div>
            <Button
              variant="secondary"
              :disabled="
                !studio &&
                (componentes.length >= limites.max_componentes ||
                  componentes.some((c) => !c.nombre.trim()))
              "
              @click="addComponente()"
              ><Plus v-if="studio" :size="15" aria-hidden="true" />Agregar componente</Button
            >
          </div>
          <div
            class="studio-component-layout"
            :class="{ 'studio-component-layout--empty': studio && !componentes.length }"
          >
            <aside
              v-if="studio && componentes.length"
              class="studio-component-tree"
              aria-label="Explorador de componentes"
            >
              <p class="tree-heading">
                <Layers3 :size="15" aria-hidden="true" /> PIEZAS DEL MUEBLE
              </p>
              <div v-for="grupo in gruposArbol" :key="grupo.id" class="tree-group">
                <h4 v-if="conjuntos.length">
                  {{ grupo.nombre }} <small>{{ grupo.piezas.length }}</small>
                </h4>
                <button
                  v-for="item in grupo.piezas"
                  :key="item.pieza.uid || item.index"
                  type="button"
                  class="tree-item"
                  :class="{
                    'tree-item--active':
                      activeComponentUid === (item.pieza.uid || String(item.index)),
                  }"
                  :aria-pressed="activeComponentUid === (item.pieza.uid || String(item.index))"
                  @click="activeComponentUid = item.pieza.uid || String(item.index)"
                >
                  <span class="tree-item__top">
                    <strong class="tree-item__title">{{
                      item.pieza.nombre || 'Componente sin nombre'
                    }}</strong>
                    <AlertCircle
                      v-if="piezaConProblemas(item.pieza)"
                      :size="15"
                      class="tree-item__issue"
                      aria-label="Requiere atención"
                    />
                    <span v-else-if="!item.pieza.nombre?.trim()" class="tree-item__draft"
                      >Por nombrar</span
                    >
                  </span>
                  <small class="tree-item__meta">{{ resumenComponente(item.pieza) }}</small>
                </button>
              </div>
              <button
                type="button"
                class="tree-add-btn"
                :disabled="componentes.length >= limites.max_componentes"
                @click="addComponente()"
              >
                <Plus :size="15" aria-hidden="true" /> Nueva pieza
              </button>
            </aside>
            <div class="studio-component-detail">
              <component
                :is="studio ? 'div' : 'details'"
                v-for="(c, i) in componentes"
                v-show="!studio || activeComponentUid === (c.uid || String(i))"
                :key="c.uid || i"
                class="card component-editor"
                :open="!studio ? true : undefined"
              >
                <summary v-if="!studio">
                  Componente {{ i + 1 }}: {{ c.nombre || 'Sin nombre' }}
                </summary>
                <div class="heading component-editor__header">
                  <div class="component-identity">
                    <small v-if="studio">PIEZA {{ i + 1 }} DE {{ componentes.length }}</small>
                    <strong>{{
                      studio ? c.nombre || 'Componente sin nombre' : `Componente ${i + 1}`
                    }}</strong>
                  </div>
                  <div class="component-toolbar">
                    <div class="component-reorder">
                      <button
                        type="button"
                        :disabled="i === 0"
                        :title="studio ? 'Mover pieza arriba' : undefined"
                        @click="move(i, -1)"
                      >
                        <ArrowUp v-if="studio" :size="15" aria-hidden="true" /> Subir</button
                      ><button
                        type="button"
                        :disabled="i === componentes.length - 1"
                        :title="studio ? 'Mover pieza abajo' : undefined"
                        @click="move(i, 1)"
                      >
                        <ArrowDown v-if="studio" :size="15" aria-hidden="true" /> Bajar
                      </button>
                    </div>
                    <div v-if="studio" class="component-direct-actions">
                      <button
                        type="button"
                        class="component-tool-btn"
                        @click="duplicateComponente(i)"
                      >
                        <Copy :size="15" aria-hidden="true" />Duplicar
                      </button>
                      <button
                        type="button"
                        class="component-tool-btn component-tool-btn--danger"
                        :aria-label="`Quitar componente ${c.nombre || i + 1}`"
                        @click="removeComponente(i)"
                      >
                        <Trash2 :size="15" aria-hidden="true" />Quitar pieza
                      </button>
                    </div>
                  </div>
                </div>
                <div class="component-subblock">
                  <div
                    class="component-identity-grid"
                    :class="{
                      'component-identity-grid--with-group': !studio || conjuntos.length > 0,
                    }"
                  >
                    <TextField
                      v-model="c.nombre"
                      :name="`componente-nombre-${i}`"
                      label="Nombre *"
                      :placeholder="studio ? 'Ej. Tablero superior, Estructura' : undefined"
                      :error="errorPieza(c)"
                      @blur="touchedPiezas[c.uid ?? c.nombre] = true"
                    /><label class="number-field"
                      ><span>Cantidad por mueble</span
                      ><input
                        :value="c.cantidad_interna ?? ''"
                        :placeholder="studio ? 'Ej. 1 (opcional)' : undefined"
                        :name="`componente-${i}-cantidad`"
                        type="number"
                        min="1"
                        @input="setCantidadInterna(c, $event)"
                    /></label>
                    <Select
                      v-if="!studio || conjuntos.length > 0"
                      v-model="c.conjunto_uid"
                      :name="`componente-${i}-grupo`"
                      label="Conjunto"
                      :options="[
                        { label: 'Sin conjunto', value: '' },
                        ...conjuntos.map((g) => ({
                          label: g.nombre || 'Sin nombre',
                          value: g.uid,
                        })),
                      ]"
                    />
                  </div>
                </div>
                <div class="component-subblock">
                  <div v-if="studio" class="component-subblock__header">
                    <h4>Materiales y dimensiones</h4>
                    <span>Opcional</span>
                  </div>
                  <div class="grid component-specs-grid">
                    <TextField
                      v-model="c.material"
                      :name="`componente-material-${i}`"
                      label="Material"
                      :placeholder="studio ? 'Ej. Melamina, Hierro, Vidrio' : undefined"
                    /><TextField
                      v-model="c.espesor"
                      :name="`componente-espesor-${i}`"
                      label="Espesor"
                      :placeholder="studio ? 'Ej. 18 mm, 25 mm' : undefined"
                    /><TextField
                      v-model="c.color"
                      :name="`componente-color-${i}`"
                      label="Color"
                      :placeholder="studio ? 'Ej. Nogal, Blanco mate' : undefined"
                    />
                    <p
                      v-if="c.dimensiones && typeof c.dimensiones !== 'string'"
                      class="component-legacy-dimensions"
                    >
                      Dimensiones históricas: {{ readableDimension(c.dimensiones) }}
                    </p>
                    <TextField
                      v-else
                      v-model="c.dimensiones"
                      :name="`componente-dimensiones-${i}`"
                      label="Medidas o dimensiones de la pieza"
                      :placeholder="studio ? 'Ej. 240 × 120 cm' : undefined"
                    />
                  </div>
                </div>
                <div class="component-subblock component-attributes-block">
                  <div v-if="studio" class="component-subblock__header">
                    <h4>Características adicionales</h4>
                    <span>Opcional</span>
                  </div>
                  <div
                    v-if="c.atributos?.length"
                    :class="studio ? 'component-attributes-grid' : 'component-attributes-legacy'"
                  >
                    <div
                      v-for="(a, ai) in c.atributos"
                      :key="a.codigo || a.nombre"
                      :class="
                        studio
                          ? [
                              'studio-attribute-row',
                              'studio-attribute-row--nested',
                              {
                                'studio-attribute-row--with-unit':
                                  a.tipo_entrada === 'numero_unidad',
                              },
                            ]
                          : 'inline'
                      "
                    >
                      <label v-if="a.tipo_entrada === 'entero'" class="studio-attribute-field">
                        <span>{{ a.nombre }}</span>
                        <input
                          v-model="a.valor"
                          :name="`atributo-${i}-${ai}`"
                          type="number"
                          step="1"
                        />
                      </label>
                      <label
                        v-else-if="a.tipo_entrada === 'numero_unidad'"
                        class="studio-attribute-field"
                      >
                        <span>{{ a.nombre }}</span>
                        <input
                          v-model="a.valor"
                          :name="`atributo-${i}-${ai}`"
                          type="number"
                          step="any"
                        />
                      </label>
                      <TextField
                        v-else
                        v-model="a.valor"
                        :name="`atributo-${i}-${ai}`"
                        :label="a.nombre"
                        :placeholder="studio ? 'Especifica el valor' : undefined"
                      />
                      <label v-if="a.tipo_entrada === 'numero_unidad'" class="studio-attribute-unit"
                        ><span :class="{ 'sr-only': studio }">Unidad de {{ a.nombre }}</span>
                        <select v-model="a.unidad" :aria-label="`Unidad de ${a.nombre}`">
                          <option value="">No especificada</option>
                          <option
                            v-for="unidad in unidadesPermitidas"
                            :key="unidad"
                            :value="unidad"
                          >
                            {{ unidad }}
                          </option>
                        </select>
                      </label>
                      <button
                        v-if="studio"
                        type="button"
                        class="card-remove-action"
                        :aria-label="`Quitar característica ${a.nombre}`"
                        @click="c.atributos?.splice(ai, 1)"
                      >
                        <Trash2 :size="14" aria-hidden="true" /> Quitar
                      </button>
                      <Button v-else variant="secondary" @click="c.atributos?.splice(ai, 1)"
                        >Quitar</Button
                      >
                      <p v-if="errorAtributo(a)" class="studio-attribute-error" role="alert">
                        {{ errorAtributo(a) }}
                      </p>
                    </div>
                  </div>
                  <div class="attribute-search component-attribute-search">
                    <template v-if="studio">
                      <div v-if="atributosComponenteDisponibles(c).length" class="quick-chips">
                        <span class="quick-chips__label">Sugeridas:</span>
                        <button
                          v-for="sugerido in atributosComponenteDisponibles(c).slice(0, 5)"
                          :key="sugerido.id"
                          type="button"
                          class="quick-chip"
                          @click="elegirAtributoComponente(c, String(sugerido.id))"
                        >
                          <Plus :size="14" aria-hidden="true" /> {{ sugerido.nombre }}
                        </button>
                      </div>
                      <MuebleOptionPicker
                        :model-value="''"
                        :name="`buscar-atributo-componente-${i}`"
                        label="Agregar característica a esta pieza"
                        placeholder="Buscar o crear característica (ej. tapacanto, acabado)..."
                        :options="
                          atributosComponenteDisponibles(c).map((x) => ({
                            value: String(x.id),
                            label: x.nombre,
                          }))
                        "
                        allow-create
                        create-label="Agregar característica personalizada"
                        @update:model-value="elegirAtributoComponente(c, $event)"
                        @create="crearAtributoComponente(c, $event)"
                      />
                    </template>
                    <template v-else>
                      <TextField
                        v-model="componentSearch[c.uid || String(i)]"
                        :name="`buscar-atributo-componente-${i}`"
                        label="Buscar característica para este componente"
                      />
                      <div v-if="componentSearch[c.uid || String(i)]" class="suggestions">
                        <button
                          v-for="item in matchingAttributes(
                            componentSearch[c.uid || String(i)] || '',
                            'componente',
                          )"
                          :key="item.id"
                          type="button"
                          @click="addComponentAttribute(c, c.uid || String(i), item)"
                        >
                          {{ item.nombre }} · {{ item.grupo }}
                        </button>
                        <button type="button" @click="addComponentAttribute(c, c.uid || String(i))">
                          Añadir atributo personalizado local
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
                <div v-if="!studio" class="inline">
                  <Button variant="secondary" @click="duplicateComponente(i)">Duplicar</Button>
                  <Button variant="secondary" @click="removeComponente(i)">Quitar</Button>
                </div>
              </component>
              <div v-if="studio && !componentes.length" class="empty-editor">
                <h4>Aún no agregaste piezas para este mueble</h4>
                <p>
                  Elige una pieza frecuente para empezar en un clic o usa «Agregar componente»
                  arriba.
                </p>
                <div class="quick-chips empty-editor__chips">
                  <button
                    v-for="frecuente in piezasFrecuentes"
                    :key="frecuente"
                    type="button"
                    class="quick-chip"
                    @click="addComponente(undefined, frecuente)"
                  >
                    <Plus :size="14" aria-hidden="true" /> {{ frecuente }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-if="studio && componentesRetirados.length" class="undo-notice" role="status">
            Se quitó un componente.
            <button type="button" @click="deshacerComponente">Deshacer</button>
          </div>
          <Button
            v-else-if="componentesRetirados.length"
            variant="secondary"
            @click="deshacerComponente"
            >Deshacer eliminación de componente</Button
          >
        </section>
        <section id="accesorios" v-show="!studio || activeSection === 'accesorios'">
          <div class="heading" :class="{ 'accessories-section-header': studio }">
            <div :class="{ 'accessories-section-copy': studio }">
              <h3>
                <span class="section-heading-main"
                  ><Wrench v-if="studio" :size="19" aria-hidden="true" />Accesorios incluidos</span
                >
                <span v-if="studio" class="section-badge">{{
                  accesoriosRegistradosCount
                    ? `${accesoriosRegistradosCount} ${accesoriosRegistradosCount === 1 ? 'incluido' : 'incluidos'}`
                    : 'Opcional'
                }}</span>
              </h3>
              <p v-if="studio" class="accessory-guidance">
                Herrajes, conexiones eléctricas o complementos que se entregan con el mueble.
              </p>
            </div>
            <Button v-if="studio" variant="secondary" class="accessory-add" @click="addAccesorio"
              ><Plus :size="15" aria-hidden="true" />Añadir accesorio</Button
            >
          </div>
          <div v-if="studio && !accesorios.length" class="accessory-empty">
            <p class="accessory-empty__title">
              Todavía no hay accesorios. Puedes añadirlos si corresponden.
            </p>
            <p class="accessory-empty__hint">
              Suma uno frecuente en un clic abajo o usa «Añadir accesorio» para describir uno a
              medida.
            </p>
          </div>
          <div
            v-if="accesorios.length"
            :class="studio ? 'accessories-grid' : 'accessories-list-legacy'"
          >
            <div
              v-for="(_, i) in accesorios"
              :key="i"
              class="accessory-item"
              :class="{
                'accessory-item--studio': studio,
                'accessory-item--editing':
                  studio && (!accesorios[i]?.trim() || accesorioEnEdicion === i),
              }"
              @keydown="onAccesorioKeydown($event, i)"
            >
              <template v-if="studio && accesorios[i]?.trim() && accesorioEnEdicion !== i">
                <div class="accessory-item-label">
                  <span class="accessory-index" aria-hidden="true">{{
                    String(i + 1).padStart(2, '0')
                  }}</span>
                  <strong class="accessory-name">{{ accesorios[i] }}</strong>
                </div>
                <div class="accessory-item-actions">
                  <button type="button" class="component-tool-btn" @click="editarAccesorio(i)">
                    <Pencil :size="14" aria-hidden="true" />Editar
                  </button>
                  <button
                    type="button"
                    class="component-tool-btn component-tool-btn--danger"
                    :aria-label="`Quitar accesorio ${accesorios[i] || i + 1}`"
                    @click="removeAccesorio(i)"
                  >
                    <Trash2 :size="14" aria-hidden="true" />Quitar
                  </button>
                </div>
              </template>
              <template v-else>
                <TextField
                  v-model="accesorios[i]"
                  :name="`accesorio-${i}`"
                  label="Descripción del accesorio *"
                  :placeholder="
                    studio
                      ? 'Ej. 2 tomacorrientes al centro, correderas telescópicas...'
                      : undefined
                  "
                  :error="errorAccesorio(i)"
                  @blur="touchedAccesorios[i] = true"
                />
                <div v-if="studio" class="accessory-edit-actions">
                  <Button
                    v-if="accesorios[i]?.trim()"
                    variant="primary"
                    @click="accesorioEnEdicion = null"
                    ><Check :size="15" aria-hidden="true" />Listo</Button
                  >
                  <button
                    type="button"
                    class="component-tool-btn component-tool-btn--danger accessory-edit-remove"
                    :aria-label="`Quitar accesorio ${accesorios[i] || i + 1}`"
                    @click="removeAccesorio(i)"
                  >
                    <Trash2 :size="15" aria-hidden="true" />Quitar
                  </button>
                </div>
                <Button v-else variant="secondary" @click="removeAccesorio(i)">Quitar</Button>
              </template>
            </div>
          </div>
          <Button
            v-if="!studio"
            variant="secondary"
            :disabled="accesorios.some((a) => !a.trim())"
            class="accessory-add"
            @click="addAccesorio"
            >Añadir accesorio</Button
          >
          <div
            v-if="studio && accesoriosFrecuentesDisponibles.length"
            class="section-adder accessory-quick-adder"
          >
            <div class="quick-chips">
              <span class="quick-chips__label">Frecuentes:</span>
              <button
                v-for="frecuente in accesoriosFrecuentesDisponibles"
                :key="frecuente"
                type="button"
                class="quick-chip"
                @click="addAccesorioRapido(frecuente)"
              >
                <Plus :size="14" aria-hidden="true" /> {{ frecuente }}
              </button>
            </div>
          </div>
          <div v-if="studio && accesoriosRetirados.length" class="undo-notice" role="status">
            Se quitó un accesorio.
            <button type="button" @click="deshacerAccesorio">Deshacer</button>
          </div>
          <Button
            v-else-if="accesoriosRetirados.length"
            variant="secondary"
            @click="deshacerAccesorio"
            >Deshacer eliminación de accesorio</Button
          >
        </section>
        <section
          v-show="!studio || activeSection === 'accesorios'"
          :class="{ 'observaciones-section': studio }"
        >
          <h3 v-if="studio" class="observaciones-heading">
            <span class="section-heading-main"
              ><MessageSquareText :size="19" aria-hidden="true" />Notas para fabricación</span
            >
            <span class="section-badge">Opcional</span>
          </h3>
          <p v-if="studio" class="section-guidance">
            Indica detalles de armado, instalación en sitio, pasacables o acuerdos especiales con el
            cliente.
          </p>
          <div :class="{ 'observaciones-box': studio }">
            <TextAreaField
              v-model="form.observaciones"
              name="observaciones-especificacion"
              label="Observaciones y detalles adicionales"
              :placeholder="
                studio
                  ? 'Ej. Entregar desarmado, instalar en piso 3, igualar tono con muestra del cliente...'
                  : undefined
              "
              :rows="studio ? 4 : 5"
              hint="Incluye indicaciones de fabricación, instalación o acuerdos especiales."
            />
          </div>
          <div v-if="base.advertencias?.length" class="observaciones-warnings">
            <h4>Información pendiente histórica</h4>
            <ul>
              <li v-for="item in base.advertencias" :key="item">{{ item }}</li>
            </ul>
          </div>
        </section>
        <section id="comercial" v-show="!studio || activeSection === 'comercial'">
          <h3>
            <span class="section-heading-main">
              <Wallet v-if="studio" :size="19" aria-hidden="true" />
              <span>{{
                studio ? 'Condiciones de cotización' : 'Datos comerciales de este mueble'
              }}</span>
            </span>
            <span
              v-if="studio"
              class="section-badge"
              :class="totalEstimado !== null ? 'section-badge--ready' : 'section-badge--required'"
            >
              <Check v-if="totalEstimado !== null" :size="13" aria-hidden="true" />
              {{ totalEstimado !== null ? 'Importe listo' : 'Precio obligatorio' }}
            </span>
          </h3>
          <aside
            v-if="totalDictado"
            class="commercial-dictated"
            :class="{ 'commercial-dictated--warning': diferenciaComercial }"
            aria-label="Revisión de precio total dictado"
          >
            <p>
              Total reconocido en el dictado:
              <strong>{{ totalDictado.total_negociado }} {{ moneda ?? 'BOB' }}</strong
              >. Es un total de línea, no un precio unitario.
            </p>
            <p v-if="unitarioSugerido">
              Para {{ comercial.cantidad }} muebles, precio unitario calculado:
              <strong>{{ unitarioSugerido }} {{ moneda ?? 'BOB' }}</strong
              >. Se completa automáticamente en el campo editable si no había un precio previo.
            </p>
            <p v-else role="status">
              Para calcular el unitario, indica una cantidad válida, sin descuento, y una división
              exacta a centavos. Si no es posible, introduce el precio manualmente.
            </p>
            <label v-if="diferenciaComercial">
              <input v-model="diferenciaConfirmada" type="checkbox" />
              Confirmo que el importe comercial difiere del total dictado y deseo guardar esa
              diferencia.
            </label>
          </aside>
          <div class="commercial-layout">
            <div class="grid commercial-fields">
              <div class="commercial-subblock">
                <p v-if="studio" class="commercial-subblock__title">CANTIDAD E IMPORTE NEGOCIADO</p>
                <div class="commercial-core-grid">
                  <TextField
                    v-model="comercial.cantidad"
                    name="mueble-cantidad"
                    label="Cantidad cotizada *"
                    input-mode="numeric"
                    :placeholder="studio ? 'Ej.: 1' : undefined"
                    :hint="studio ? 'Unidades enteras a fabricar.' : undefined"
                    :error="errorCampo('comercial', 0, touched.cantidad)"
                    @blur="touched.cantidad = true"
                  />
                  <div class="commercial-unit-field">
                    <Select
                      v-model="comercial.unidad"
                      name="mueble-unidad"
                      label="Unidad comercial *"
                      :options="
                        (unidades ?? [])
                          .filter((u) => ['PIEZA', 'JUEGO'].includes(u.codigo))
                          .map((u) => ({ label: u.nombre, value: String(u.id) }))
                      "
                    />
                    <small v-if="studio" class="commercial-unit-hint">
                      Unidad mostrada en la línea de proforma.
                    </small>
                  </div>
                  <TextField
                    v-model="comercial.precio_unitario"
                    name="mueble-precio"
                    :label="'Precio unitario negociado (' + (moneda ?? 'BOB') + ') *'"
                    input-mode="decimal"
                    :placeholder="studio ? '0.00' : undefined"
                    :hint="studio ? 'Importe cotizado por cada unidad.' : undefined"
                    :error="errorCampo('comercial', 2, touched.precio)"
                    @blur="touched.precio = true"
                  />
                  <TextField
                    v-model="comercial.descuento"
                    name="mueble-descuento"
                    label="Descuento monetario total de línea *"
                    input-mode="decimal"
                    :placeholder="studio ? '0.00' : undefined"
                    :hint="
                      studio ? 'Se descuenta una sola vez del subtotal de la línea.' : undefined
                    "
                    :error="errorCampo('comercial', 3, touched.descuento)"
                    @blur="touched.descuento = true"
                  />
                </div>
              </div>
              <div class="commercial-subblock commercial-subblock--optional">
                <div v-if="studio" class="commercial-optional-head">
                  <span class="commercial-subblock__title">GLOSA EN LA PROFORMA</span>
                  <span class="section-badge">Opcional</span>
                </div>
                <TextField
                  v-model="comercial.descripcion"
                  class="commercial-description"
                  name="mueble-descripcion"
                  label="Descripción comercial opcional"
                  :placeholder="
                    studio ? 'Ej.: Incluye entrega e instalación en sala principal' : undefined
                  "
                  :hint="
                    studio
                      ? 'Texto visible para el cliente junto al nombre del mueble (no reemplaza las notas de fabricación).'
                      : undefined
                  "
                />
              </div>
            </div>
            <div class="commercial-total" role="status">
              <div v-if="studio" class="commercial-total__header">
                <h4><Calculator :size="18" aria-hidden="true" />Resumen de cotización</h4>
                <span class="commercial-currency-pill">{{ moneda ?? 'BOB' }}</span>
              </div>
              <div class="commercial-total__rows">
                <div class="commercial-total__row">
                  <div class="commercial-total__label-group">
                    <span>Subtotal</span>
                    <small
                      v-if="studio && cantidadValida && precioValido"
                      class="commercial-total__formula"
                    >
                      {{ comercial.cantidad }} {{ unidadComercialNombre.toLowerCase() }} ×
                      {{ Number(comercial.precio_unitario).toFixed(2) }} {{ moneda ?? 'BOB' }}
                    </small>
                  </div>
                  <strong>{{
                    cantidadValida && precioValido
                      ? (Number(comercial.cantidad) * Number(comercial.precio_unitario)).toFixed(
                          2,
                        ) +
                        ' ' +
                        (moneda ?? 'BOB')
                      : 'Pendiente'
                  }}</strong>
                </div>
                <div
                  class="commercial-total__row"
                  :class="{
                    'commercial-total__row--discount':
                      studio && descuentoValido && Number(comercial.descuento) > 0,
                  }"
                >
                  <span>Descuento</span>
                  <strong>{{
                    descuentoValido
                      ? (studio && Number(comercial.descuento) > 0 ? '− ' : '') +
                        Number(comercial.descuento).toFixed(2) +
                        ' ' +
                        (moneda ?? 'BOB')
                      : 'Pendiente'
                  }}</strong>
                </div>
              </div>
              <div
                class="commercial-total-main"
                :class="{ 'commercial-total-main--ready': totalEstimado !== null }"
              >
                <span>Total estimado del mueble</span>
                <strong>{{
                  totalEstimado === null
                    ? 'Importe pendiente'
                    : totalEstimado.toFixed(2) + ' ' + (moneda ?? 'BOB')
                }}</strong>
              </div>
              <p>El total definitivo se confirmará al guardar la proforma.</p>
            </div>
          </div>
        </section>
        <section
          id="revision"
          v-show="!studio || activeSection === 'revision'"
          class="furniture-review"
          aria-labelledby="revision-title"
        >
          <header class="review-hero">
            <div class="review-hero__identity">
              <div class="review-hero__eyebrow-row">
                <p class="review-eyebrow">FICHA TÉCNICO-COMERCIAL</p>
                <span aria-hidden="true" class="review-eyebrow-sep">·</span>
                <h3 id="revision-title">Revisar mueble</h3>
              </div>
              <h4>{{ comercial.nombre || 'Mueble pendiente de nombre' }}</h4>
              <div class="review-hero__pills">
                <span class="review-hero__pill">{{
                  nombreTipoMueble || 'Tipo de mueble no especificado'
                }}</span>
                <span v-if="conjuntos.length" class="review-hero__pill">
                  {{ conjuntos.length }} {{ conjuntos.length === 1 ? 'conjunto' : 'conjuntos' }}
                </span>
                <span class="review-hero__pill">
                  {{
                    componentes.length
                      ? `${componentes.length} ${componentes.length === 1 ? 'pieza' : 'piezas'}`
                      : 'Sin piezas detalladas'
                  }}
                </span>
                <span v-if="accesoriosRegistrados.length" class="review-hero__pill">
                  {{ accesoriosRegistrados.length }}
                  {{ accesoriosRegistrados.length === 1 ? 'accesorio' : 'accesorios' }}
                </span>
              </div>
            </div>
            <div class="review-hero__summary">
              <span v-if="revisionCompleta" class="review-check"
                ><CheckCircle2 :size="17" aria-hidden="true" /> Datos completos</span
              >
              <span v-else class="review-check review-check--pending"
                ><AlertCircle :size="17" aria-hidden="true" /> Hay información por revisar</span
              >
              <div
                v-if="studio"
                class="review-hero__total"
                :class="{ 'review-hero__total--ready': totalEstimado !== null }"
              >
                <span>
                  {{
                    cantidadValida
                      ? `${comercial.cantidad} ${unidadComercialNombre} · Total estimado`
                      : 'Total estimado'
                  }}
                </span>
                <strong>{{
                  totalEstimado === null
                    ? 'Importe pendiente'
                    : totalEstimado.toFixed(2) + ' ' + (moneda ?? 'BOB')
                }}</strong>
              </div>
            </div>
          </header>
          <div
            v-if="tieneErroresRevision"
            class="review-alert"
            aria-label="Datos que debes revisar"
          >
            <div class="review-alert__header">
              <h4><AlertCircle :size="19" aria-hidden="true" /> Información por completar</h4>
              <p>Haz clic en cada aviso para ir directo al apartado y corregirlo.</p>
            </div>
            <div class="review-alert__list">
              <template v-for="section in pasosValidacion" :key="section">
                <button
                  v-for="(issue, index) in erroresSecciones[section]"
                  :key="`${section}-${index}`"
                  type="button"
                  @click="irASeccion(section)"
                >
                  <span class="review-alert__issue">
                    <AlertCircle :size="15" aria-hidden="true" />
                    <span>{{ issue }}</span>
                  </span>
                  <span class="review-alert__cta" aria-hidden="true">
                    <span>Corregir</span>
                    <Pencil :size="13" />
                  </span>
                </button>
              </template>
            </div>
          </div>
          <div v-if="pendientesVisibles.length" class="review-pending">
            <h4>Datos reconocidos por voz pendientes de comprobación</h4>
            <p>
              Revisa las propuestas del dictado. Los datos ambiguos no se confirmarán
              automáticamente.
            </p>
            <ul>
              <li v-for="p in pendientesVisibles" :key="p.indice">{{ p.mensaje }}</li>
            </ul>
          </div>
          <article class="review-card review-card--full">
            <header>
              <h4><Tag v-if="studio" :size="18" aria-hidden="true" />Información general</h4>
              <button
                type="button"
                class="review-edit-btn"
                :aria-label="studio ? 'Editar información general' : undefined"
                @click="irASeccion('general')"
              >
                <Pencil :size="14" aria-hidden="true" /> Editar
              </button>
            </header>
            <div class="review-info">
              <div>
                <span>Nombre comercial</span><strong>{{ comercial.nombre || 'Pendiente' }}</strong>
              </div>
              <div>
                <span>Tipo de mueble</span
                ><strong>{{ nombreTipoMueble || 'No especificado' }}</strong>
              </div>
            </div>
            <div class="review-subsection">
              <h5>Dimensiones generales</h5>
              <div v-if="medidasRegistradas.length" class="review-measures">
                <div v-for="medida in medidasRegistradas" :key="medida.clave">
                  <span>{{ etiquetaMedidaVisual(medida.clave) }}</span>
                  <strong>{{ medida.valor }} {{ medida.unidad || 'Unidad pendiente' }}</strong>
                </div>
              </div>
              <p v-else class="review-empty">No se especificaron medidas generales.</p>
            </div>
            <div v-if="atributosGenerales.length" class="review-subsection">
              <h5>Características generales</h5>
              <div class="review-attributes">
                <p v-for="attr in atributosGenerales" :key="attr.codigo || attr.nombre">
                  <span>{{ attr.nombre }}:</span>
                  <strong>{{ attr.valor || 'Pendiente' }} {{ attr.unidad ?? '' }}</strong>
                </p>
              </div>
            </div>
          </article>
          <article class="review-card review-card--full">
            <header>
              <div class="review-card__heading">
                <h4>
                  <Layers3 v-if="studio" :size="18" aria-hidden="true" />Estructura y componentes
                </h4>
                <div class="review-metrics">
                  <span v-if="conjuntos.length > 0">
                    {{ conjuntos.length }} {{ conjuntos.length === 1 ? 'conjunto' : 'conjuntos' }}
                  </span>
                  <span>
                    {{ componentes.length }}
                    {{ componentes.length === 1 ? 'componente' : 'componentes' }}
                  </span>
                </div>
              </div>
              <button
                type="button"
                class="review-edit-btn"
                :aria-label="studio ? 'Editar estructura y componentes' : undefined"
                @click="irASeccion('estructura')"
              >
                <Pencil :size="14" aria-hidden="true" /> Editar
              </button>
            </header>
            <p v-if="!componentes.length" class="review-empty">
              No se agregaron componentes técnicos.
            </p>
            <details v-for="grupo in gruposArbol" :key="grupo.id" class="review-group" open>
              <summary>
                <span>{{ grupo.nombre }}</span>
                <small v-if="conjuntos.length > 0">
                  {{ grupo.piezas.length }}
                  {{ grupo.piezas.length === 1 ? 'componente' : 'componentes' }}
                </small>
              </summary>
              <div class="review-group__pieces">
                <div
                  v-for="(item, pieceIdx) in grupo.piezas"
                  :key="item.pieza.uid || item.index"
                  class="review-piece"
                >
                  <div class="review-piece__header">
                    <div class="review-piece__title">
                      <span class="review-piece__index" aria-hidden="true">{{
                        String(pieceIdx + 1).padStart(2, '0')
                      }}</span>
                      <strong>{{ item.pieza.nombre || 'Componente pendiente de nombre' }}</strong>
                    </div>
                    <span
                      class="review-piece__qty"
                      :class="{ 'review-piece__qty--muted': item.pieza.cantidad_interna == null }"
                      >{{
                        item.pieza.cantidad_interna == null
                          ? studio
                            ? 'Cantidad no especificada'
                            : '— por mueble'
                          : `${item.pieza.cantidad_interna} por mueble`
                      }}</span
                    >
                  </div>
                  <dl v-if="piezaTieneDetalles(item.pieza)" class="review-piece-attributes">
                    <div v-if="item.pieza.material">
                      <dt>Material</dt>
                      <dd>{{ item.pieza.material }}</dd>
                    </div>
                    <div v-if="item.pieza.espesor">
                      <dt>Espesor</dt>
                      <dd>{{ item.pieza.espesor }}</dd>
                    </div>
                    <div v-if="item.pieza.color">
                      <dt>Color</dt>
                      <dd>{{ item.pieza.color }}</dd>
                    </div>
                    <div v-if="item.pieza.dimensiones">
                      <dt>Dimensiones</dt>
                      <dd>{{ readableDimension(item.pieza.dimensiones) }}</dd>
                    </div>
                    <div
                      v-for="attr in item.pieza.atributos ?? []"
                      :key="attr.codigo || attr.nombre"
                    >
                      <dt>{{ attr.nombre }}</dt>
                      <dd>{{ attr.valor }} {{ attr.unidad ?? '' }}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </details>
          </article>
          <article class="review-card">
            <header>
              <h4>
                <Wrench v-if="studio" :size="18" aria-hidden="true" />Accesorios y observaciones
              </h4>
              <button
                type="button"
                class="review-edit-btn"
                :aria-label="studio ? 'Editar accesorios y observaciones' : undefined"
                @click="irASeccion('accesorios')"
              >
                <Pencil :size="14" aria-hidden="true" /> Editar
              </button>
            </header>
            <ul v-if="accesoriosRegistrados.length" class="review-accessories">
              <li v-for="(acc, index) in accesoriosRegistrados" :key="index">
                <CheckCircle2 :size="15" aria-hidden="true" />
                <span>{{ acc }}</span>
              </li>
            </ul>
            <p v-else class="review-empty">Sin accesorios registrados.</p>
            <div class="review-note-box">
              <h5>Observaciones</h5>
              <p :class="{ 'review-empty': !form.observaciones.trim() }">
                {{ form.observaciones || 'Sin observaciones adicionales.' }}
              </p>
            </div>
            <div v-if="base.advertencias?.length" class="review-history">
              <h5>Advertencias de la información anterior</h5>
              <ul>
                <li v-for="warning in base.advertencias" :key="warning">{{ warning }}</li>
              </ul>
            </div>
            <details v-if="base.descripcion_original" class="review-original-desc">
              <summary>Ver descripción técnica original conservada</summary>
              <p>{{ base.descripcion_original }}</p>
            </details>
          </article>
          <article class="review-card review-commercial">
            <header>
              <h4><Wallet v-if="studio" :size="18" aria-hidden="true" />Datos comerciales</h4>
              <button
                type="button"
                class="review-edit-btn"
                :aria-label="studio ? 'Editar datos comerciales' : undefined"
                @click="irASeccion('comercial')"
              >
                <Pencil :size="14" aria-hidden="true" /> Editar
              </button>
            </header>
            <div class="review-price-grid">
              <div>
                <span>Cantidad cotizada</span
                ><strong
                  >{{ cantidadValida ? comercial.cantidad : 'Pendiente' }}
                  {{
                    cantidadValida
                      ? (unidades?.find((u) => String(u.id) === comercial.unidad)?.nombre ?? '')
                      : ''
                  }}</strong
                >
              </div>
              <div>
                <span>Precio unitario</span
                ><strong>{{
                  precioValido
                    ? Number(comercial.precio_unitario).toFixed(2) + ' ' + (moneda ?? 'BOB')
                    : 'Pendiente'
                }}</strong>
              </div>
              <div>
                <span>Descuento</span
                ><strong>{{
                  descuentoValido
                    ? (Number(comercial.descuento) > 0 ? '− ' : '') +
                      Number(comercial.descuento).toFixed(2) +
                      ' ' +
                      (moneda ?? 'BOB')
                    : 'Pendiente'
                }}</strong>
              </div>
            </div>
            <div v-if="comercial.descripcion.trim()" class="review-note-box">
              <h5>Descripción comercial</h5>
              <p>{{ comercial.descripcion }}</p>
            </div>
            <div
              class="review-price-total"
              :class="{ 'review-price-total--ready': totalEstimado !== null }"
            >
              <span>Total estimado del mueble</span
              ><strong>{{
                totalEstimado === null
                  ? 'Importe pendiente'
                  : totalEstimado.toFixed(2) + ' ' + (moneda ?? 'BOB')
              }}</strong>
            </div>
            <p class="review-price-hint">
              El total definitivo se confirmará cuando guardes la proforma.
            </p>
          </article>
        </section>
      </div>
    </div>
    <p v-if="error || externalError" role="alert">{{ error || externalError }}</p>
    <div v-if="!studio || activeSection === 'revision'" class="actions review-actions">
      <div v-if="studio" class="review-actions__copy">
        <strong>{{
          revisionCompleta
            ? 'Listo para incorporar a la proforma'
            : 'Completa los datos pendientes antes de continuar'
        }}</strong>
        <p>El mueble se añadirá a esta proforma. Después podrás guardar la proforma o emitirla.</p>
      </div>
      <div class="review-actions__buttons">
        <Button variant="success" type="submit" :disabled="processing">
          <Save :size="17" aria-hidden="true" />
          {{ studio ? 'Agregar mueble a la proforma' : 'Guardar especificación' }}
        </Button>
        <Button v-if="!studio" variant="secondary" @click="emit('cancel')">Cancelar</Button>
      </div>
    </div>
  </form>
</template>
<style scoped>
.config-header .eyebrow {
  color: var(--color-text);
}
.pending-summary {
  padding: var(--space-4);
  border: 2px solid var(--color-danger);
  border-radius: var(--radius-control);
}
.dimension-pending {
  flex-basis: 100%;
  color: var(--color-danger);
  margin: 0;
  overflow-wrap: anywhere;
}

.config-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}
.config-header nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.eyebrow {
  margin: 0;
  color: var(--color-text-muted);
}
.review-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.review-grid div {
  padding: var(--space-3);
  background: var(--color-surface-muted);
}
.review-grid dt {
  font-weight: 700;
}
.configurator {
  display: grid;
  gap: var(--space-6);
}
section,
.card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
h3 {
  margin: 0;
}
details.card > summary {
  cursor: pointer;
  font-weight: 600;
}
details.card > summary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
details.card[open] > summary {
  margin-bottom: var(--space-3);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.component-subblock,
.component-attributes-legacy,
.accessories-list-legacy,
.conjunto-destino {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}
.accessories-list-legacy .accessory-item {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: var(--space-3);
}
.component-identity-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  min-width: 0;
}
.studio-group-card__actions,
.conjunto-destino__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: var(--space-2);
}
.inline,
.heading,
.actions {
  display: flex;
  align-items: end;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.heading {
  align-items: center;
  justify-content: space-between;
}
.component-attribute-search {
  position: sticky;
  top: var(--space-2);
  z-index: 1;
  background: var(--color-surface);
}
.attribute-search {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: var(--space-2);
  background: var(--color-surface-raised);
}
.suggestions {
  display: grid;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
}
.suggestions button {
  padding: var(--space-2);
  text-align: left;
  border: 0;
  background: transparent;
}
.suggestions button:hover {
  background: var(--color-surface);
}
[role='alert'] {
  color: var(--color-danger);
}
@media (max-width: 48rem) {
  .grid,
  .component-identity-grid {
    grid-template-columns: 1fr;
  }
  .inline,
  .actions {
    align-items: stretch;
    display: grid;
  }
  .component-attribute-search {
    position: sticky;
    top: var(--space-2);
    z-index: 1;
    background: var(--color-surface);
  }
  .attribute-search {
    position: static;
  }
}

/* Furniture Studio 2.0 — el editor ocupa toda la superficie disponible. */
.configurator--studio .configurator-layout {
  display: block;
  min-width: 0;
}
.configurator--studio .configurator-fields {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}
.configurator--studio .configurator-fields > section {
  min-width: 0;
  padding: clamp(1rem, 2.2vw, 1.6rem);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-card);
}
.configurator--studio .configurator-fields h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}
.configurator--studio .section-heading-main {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}
.configurator--studio .configurator-fields h3 svg {
  flex: none;
  color: var(--color-primary-accent);
}
.configurator--studio .section-badge {
  flex-shrink: 0;
  margin-left: auto;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 650;
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.configurator--studio .section-badge--required {
  border-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary-soft) 55%, var(--color-surface));
  color: var(--color-text);
}
.configurator--studio .section-badge--ready {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border-color: color-mix(in srgb, var(--color-success) 50%, var(--color-border));
  background: color-mix(in srgb, var(--color-success-soft) 65%, var(--color-surface));
  color: var(--color-success);
}
.configurator--studio .section-badge--ready svg {
  color: var(--color-success);
}
.configurator--studio :deep(.field input),
.configurator--studio :deep(.field textarea),
.configurator--studio :deep(.textarea-field textarea),
.configurator--studio :deep(.field select),
.configurator--studio :deep(.select select) {
  background: var(--color-surface-raised);
}
.configurator--studio .configurator-fields > section :deep(.button--secondary) {
  background: var(--color-surface-raised);
  border-color: var(--color-border-strong);
}
.configurator--studio
  .configurator-fields
  > section
  :deep(.button--secondary:hover:not(:disabled)) {
  background: var(--color-surface-hover);
}
.configurator--studio .configurator-fields > section > h3 {
  margin-bottom: 0.2rem;
  font-size: 1.02rem;
}
.configurator--studio .configurator-fields > section > p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.84rem;
  line-height: 1.45;
}
.configurator--studio .configurator-fields #identificacion {
  gap: 1rem;
}
.configurator--studio .dimensions-section .measure-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  margin: var(--space-2) 0 0;
}
.configurator--studio .dimensions-section .measure-row {
  position: relative;
  padding: 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 6.6rem;
  gap: 0.55rem;
  align-items: start;
  min-width: 0;
  transition: border-color var(--transition-fast);
}
.configurator--studio .dimensions-section .measure-row--filled {
  border-color: var(--color-border-strong);
}
.configurator--studio .dimensions-section .measure-row :deep(.field) {
  gap: 0.45rem;
  min-width: 0;
}
.configurator--studio .dimensions-section .measure-row :deep(.field > span) {
  display: block;
  min-height: 1.35rem;
  line-height: 1.35rem;
  font-size: 0.84rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.configurator--studio .dimensions-section .measure-row :deep(.field > span::first-letter) {
  text-transform: uppercase;
}
.configurator--studio .dimensions-section .measure-row .measure-unit {
  display: block;
  min-width: 0;
  padding-top: 1.8rem;
}
.configurator--studio .dimensions-section .measure-row .measure-unit select {
  width: 100%;
  min-height: 2.75rem;
  padding: 0 0.5rem;
  background: var(--color-surface-raised);
  color: var(--color-text);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
}
.configurator--studio .card-remove-action {
  position: absolute;
  top: 0.7rem;
  right: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 1.5rem;
  padding: 0.15rem 0.45rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);
}
.configurator--studio .card-remove-action:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
.configurator--studio .card-remove-action:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}
.configurator--studio .dimensions-section .dimension-pending {
  grid-column: 1/-1;
  color: var(--color-danger);
  margin: 0;
  font-size: 0.77rem;
}
.configurator--studio .section-adder {
  display: grid;
  gap: 0.85rem;
  padding-top: var(--space-3);
  margin-top: var(--space-1);
  border-top: 1px solid var(--color-border);
}
.configurator--studio .quick-chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.configurator--studio .quick-chips__label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-right: 0.2rem;
}
.configurator--studio .quick-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 1.95rem;
  padding: 0.25rem 0.65rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--color-surface-muted);
  color: var(--color-text);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);
}
.configurator--studio .quick-chip svg {
  color: var(--color-primary-accent);
}
.configurator--studio .quick-chip:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}
.configurator--studio .quick-chip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.configurator--studio .dimensions-section .mueble-picker {
  max-width: 36rem;
}
.configurator--studio .attribute-search {
  position: static;
  background: transparent;
  padding: 0;
}
.configurator--studio .attribute-search.section-adder {
  padding-top: var(--space-3);
}
.configurator--studio .attribute-search .mueble-picker {
  max-width: 36rem;
}
.configurator--studio .general-attributes-empty {
  padding: 0.9rem 1rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 0.83rem;
}
.configurator--studio .studio-group-management {
  display: grid;
  gap: 0.9rem;
}
.configurator--studio .studio-group-management--compact {
  padding: 0.9rem 1.25rem;
  background: var(--color-surface-muted);
  border-style: dashed;
}
.configurator--studio .group-management-header,
.configurator--studio .components-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem 1.25rem;
  flex-wrap: wrap;
}
.configurator--studio .group-management-copy,
.configurator--studio .components-section-copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
  flex: 1 1 18rem;
}
.configurator--studio .group-management-copy h3,
.configurator--studio .components-section-copy h3 {
  justify-content: flex-start;
  flex-wrap: wrap;
  font-size: 1.02rem;
}
.configurator--studio .group-management-copy .section-badge,
.configurator--studio .components-section-copy .section-badge {
  margin-left: 0.1rem;
}
.configurator--studio .studio-group-management--compact .section-badge {
  background: var(--color-surface-raised);
}
.configurator--studio .studio-groups-list {
  display: grid;
  gap: 0.75rem;
}
.configurator--studio .studio-group-card {
  padding: 0.95rem 1rem;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
.configurator--studio .studio-group-card__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: end;
  gap: 0.75rem;
}
.configurator--studio .studio-group-card__count {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  font-weight: 650;
  white-space: nowrap;
}
.configurator--studio .studio-group-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.configurator--studio .conjunto-destino {
  padding: 0.85rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-control);
}
.configurator--studio .conjunto-destino p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.82rem;
}
.configurator--studio .conjunto-destino__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.6rem;
}
.configurator--studio .conjunto-destino__select {
  display: grid;
  gap: var(--space-2);
  font-size: 0.84rem;
  font-weight: 600;
  min-width: 12rem;
}
.configurator--studio .conjunto-destino__select select {
  min-height: 2.75rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font: inherit;
}
.configurator--studio #componentes {
  display: grid;
  gap: 1.1rem;
}
.configurator--studio .studio-component-layout {
  display: grid;
  grid-template-columns: minmax(14rem, 0.74fr) minmax(0, 1.66fr);
  gap: 1rem;
  align-items: start;
  min-width: 0;
}
.configurator--studio .studio-component-layout--empty {
  grid-template-columns: minmax(0, 1fr);
}
.configurator--studio .studio-component-tree {
  display: grid;
  align-content: start;
  gap: 0.65rem;
  padding: 0.95rem;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  min-width: 0;
}
.configurator--studio .tree-heading {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 0.2rem;
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  font-weight: 750;
  letter-spacing: 0.06em;
}
.configurator--studio .tree-heading svg {
  color: var(--color-primary-accent);
}
.configurator--studio .tree-group {
  display: grid;
  gap: 0.45rem;
}
.configurator--studio .tree-group h4 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin: 0.35rem 0 0.1rem;
}
.configurator--studio .tree-group h4 small {
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.72rem;
}
.configurator--studio .tree-item {
  display: grid;
  gap: 0.28rem;
  text-align: left;
  padding: 0.75rem 0.85rem;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-surface-raised);
  font: inherit;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}
.configurator--studio .tree-item:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}
.configurator--studio .tree-item--active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 60%, var(--color-surface-raised));
  box-shadow: inset 3px 0 0 var(--color-primary);
}
.configurator--studio .tree-item--active:hover {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 72%, var(--color-surface-raised));
}
.configurator--studio .tree-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.configurator--studio .tree-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
  min-width: 0;
}
.configurator--studio .tree-item__title {
  overflow-wrap: anywhere;
  font-size: 0.86rem;
  line-height: 1.3;
}
.configurator--studio .tree-item__title::first-letter {
  text-transform: uppercase;
}
.configurator--studio .tree-item__issue {
  flex-shrink: 0;
  color: var(--color-danger);
}
.configurator--studio .tree-item__draft {
  flex-shrink: 0;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 0.68rem;
  font-weight: 650;
}
.configurator--studio .tree-item__meta {
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.configurator--studio .tree-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  width: 100%;
  min-height: 2.45rem;
  margin-top: 0.15rem;
  padding: 0.45rem 0.75rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 650;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}
.configurator--studio .tree-add-btn svg {
  color: var(--color-primary-accent);
}
.configurator--studio .tree-add-btn:hover:not(:disabled) {
  border-style: solid;
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}
.configurator--studio .tree-add-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.configurator--studio .tree-add-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.configurator--studio .studio-component-detail {
  min-width: 0;
}
.configurator--studio .studio-component-detail .component-editor {
  display: grid;
  gap: 1rem;
  padding: clamp(1rem, 2vw, 1.35rem);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-card);
  min-width: 0;
  margin: 0;
}
.configurator--studio .component-editor__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--color-border);
}
.configurator--studio .structure-guidance {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.84rem;
  line-height: 1.45;
}
.configurator--studio .component-identity {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
  overflow-wrap: anywhere;
}
.configurator--studio .component-identity small {
  color: var(--color-text-secondary);
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0.05em;
}
.configurator--studio .component-identity strong {
  font-size: 1.05rem;
  line-height: 1.25;
}
.configurator--studio .component-identity strong::first-letter {
  text-transform: uppercase;
}
.configurator--studio .component-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.configurator--studio .component-reorder,
.configurator--studio .component-direct-actions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.configurator--studio .component-reorder button,
.configurator--studio .component-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 2.2rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font: inherit;
  font-size: 0.79rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}
.configurator--studio .component-reorder button:hover:not(:disabled),
.configurator--studio .component-tool-btn:hover:not(:disabled) {
  background: var(--color-surface-hover);
}
.configurator--studio .component-tool-btn--danger {
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 45%, var(--color-border));
}
.configurator--studio .component-tool-btn--danger:hover:not(:disabled) {
  background: var(--color-danger-soft);
  border-color: var(--color-danger);
}
.configurator--studio .component-reorder button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.configurator--studio .component-subblock {
  display: grid;
  gap: 0.85rem;
  padding: 0.95rem;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  min-width: 0;
}
.configurator--studio .component-subblock__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.configurator--studio .component-subblock__header h4 {
  margin: 0;
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--color-text);
}
.configurator--studio .component-subblock__header span {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.configurator--studio .component-identity-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(9.5rem, 0.75fr);
  gap: var(--space-3);
  align-items: start;
}
.configurator--studio .component-identity-grid--with-group {
  grid-template-columns: minmax(0, 1.35fr) minmax(10.5rem, 0.85fr) minmax(10rem, 0.9fr);
}
.configurator--studio .number-field {
  display: grid;
  align-content: start;
  gap: var(--space-2);
  min-width: 0;
  font-weight: 600;
}
.configurator--studio .number-field input {
  width: 100%;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font: inherit;
}
.configurator--studio .studio-component-detail .component-specs-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}
.configurator--studio .component-legacy-dimensions {
  margin: 0;
  align-self: center;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 0.82rem;
}
.configurator--studio .component-attributes-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.configurator--studio .studio-component-detail .component-attribute-search {
  display: grid;
  gap: 0.75rem;
  margin-top: 0;
}
.configurator--studio .component-subblock .quick-chip,
.configurator--studio .empty-editor .quick-chip {
  background: var(--color-surface-raised);
}
.configurator--studio .studio-component-detail button {
  cursor: pointer;
}
.configurator--studio .studio-component-detail button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.configurator--studio .empty-editor {
  display: grid;
  justify-items: center;
  gap: 0.45rem;
  padding: clamp(1.5rem, 3vw, 2.35rem);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-card);
  background: var(--color-surface-muted);
  text-align: center;
}
.configurator--studio .empty-editor h4 {
  margin: 0;
  font-size: 0.98rem;
}
.configurator--studio .empty-editor p {
  margin: 0;
  max-width: 34rem;
  font-size: 0.83rem;
  color: var(--color-text-secondary);
}
.configurator--studio .empty-editor__chips {
  justify-content: center;
  margin-top: 0.45rem;
}
.configurator--studio .undo-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.65rem 0.95rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  font-size: 0.8rem;
}
.configurator--studio .undo-notice button {
  border: 0;
  background: none;
  color: var(--color-primary-accent);
  font-weight: 700;
  cursor: pointer;
}
.configurator--studio #accesorios,
.configurator--studio .observaciones-section {
  display: grid;
  gap: 1rem;
}
.configurator--studio .accessories-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem 1.25rem;
  flex-wrap: wrap;
}
.configurator--studio .accessories-section-copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
  flex: 1 1 18rem;
}
.configurator--studio .accessories-section-copy h3 {
  justify-content: flex-start;
  flex-wrap: wrap;
  font-size: 1.02rem;
}
.configurator--studio .accessories-section-copy .section-badge {
  margin-left: 0.1rem;
}
.configurator--studio .accessory-guidance {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.84rem;
  line-height: 1.45;
}
.configurator--studio .accessory-empty {
  display: grid;
  gap: 0.25rem;
  padding: 1rem 1.1rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}
.configurator--studio .accessory-empty__title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}
.configurator--studio .accessory-empty__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
.configurator--studio .accessories-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: start;
}
.configurator--studio .accessory-item--studio {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.65rem 0.85rem;
  align-items: center;
  min-width: 0;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  padding: 0.75rem 0.9rem;
  border-radius: var(--radius-control);
  transition: border-color var(--transition-fast);
}
.configurator--studio .accessory-item--studio:hover {
  border-color: var(--color-border-strong);
}
.configurator--studio .accessory-item--editing {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.75rem;
  padding: 0.95rem;
  border-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-border-strong));
}
.configurator--studio .accessory-item--editing :deep(.field) {
  min-width: 0;
  width: 100%;
}
.configurator--studio .accessory-item-label {
  display: flex;
  gap: 0.65rem;
  flex: 1 1 11rem;
  align-items: center;
  min-width: 0;
}
.configurator--studio .accessory-index {
  flex-shrink: 0;
  display: inline-grid;
  place-items: center;
  min-width: 1.7rem;
  height: 1.7rem;
  padding: 0 0.35rem;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}
.configurator--studio .accessory-name {
  overflow-wrap: anywhere;
  font-size: 0.86rem;
  line-height: 1.35;
}
.configurator--studio .accessory-name::first-letter {
  text-transform: uppercase;
}
.configurator--studio .accessory-item-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-left: auto;
}
.configurator--studio .accessory-edit-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  padding-top: 1.75rem;
}
.configurator--studio .accessory-edit-remove {
  min-height: 2.75rem;
  padding: 0.5rem 0.8rem;
}
.configurator--studio .accessory-quick-adder {
  margin-top: 0;
}
.configurator--studio .observaciones-box {
  padding: 0.95rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}
.configurator--studio .observaciones-warnings {
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}
.configurator--studio .observaciones-warnings h4 {
  margin: 0 0 0.35rem;
  font-size: 0.86rem;
}
.configurator--studio .observaciones-warnings ul {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}
.commercial-layout,
.commercial-subblock,
.commercial-core-grid,
.commercial-total__rows {
  display: contents;
}
.commercial-unit-field {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}
.configurator--studio #comercial {
  gap: 1rem;
}
.configurator--studio .commercial-dictated {
  display: grid;
  gap: 0.55rem;
  padding: 0.9rem 1rem;
  border: 1px solid color-mix(in srgb, var(--color-info) 45%, var(--color-border));
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--color-info-soft) 55%, var(--color-surface));
  font-size: 0.85rem;
  line-height: 1.45;
}
.configurator--studio .commercial-dictated--warning {
  border-color: color-mix(in srgb, var(--color-warning) 55%, var(--color-border));
  background: color-mix(in srgb, var(--color-warning-soft) 55%, var(--color-surface));
}
.configurator--studio .commercial-dictated p {
  margin: 0;
  color: var(--color-text);
}
.configurator--studio .commercial-dictated label {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.65rem 0.8rem;
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-strong);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}
.configurator--studio .commercial-dictated input[type='checkbox'] {
  margin-top: 0.15rem;
  accent-color: var(--color-primary);
}
.configurator--studio .commercial-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(18.5rem, 1fr);
  gap: var(--space-5);
  align-items: start;
}
.configurator--studio .commercial-fields {
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 0.9rem;
  min-width: 0;
}
.configurator--studio .commercial-subblock {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-muted);
  min-width: 0;
}
.configurator--studio .commercial-subblock__title {
  margin: 0;
  font-size: 0.71rem;
  font-weight: 750;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
}
.configurator--studio .commercial-optional-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.configurator--studio .commercial-core-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem var(--space-4);
  align-items: start;
  min-width: 0;
}
.configurator--studio .commercial-unit-hint {
  color: var(--color-text-secondary);
  font-weight: 400;
}
.configurator--studio .commercial-description {
  grid-column: 1 / -1;
}
.configurator--studio .commercial-total {
  position: sticky;
  top: 1rem;
  display: grid;
  gap: 0.85rem;
  padding: 1.05rem;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  min-width: 0;
  max-width: none;
}
.configurator--studio .commercial-total__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--color-border);
}
.configurator--studio .commercial-total h4 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: 0.95rem;
}
.configurator--studio .commercial-total h4 svg {
  color: var(--color-primary-accent);
  flex-shrink: 0;
}
.configurator--studio .commercial-currency-pill {
  padding: 0.16rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font-size: 0.71rem;
  font-weight: 750;
  letter-spacing: 0.04em;
}
.configurator--studio .commercial-total__rows {
  display: grid;
  gap: 0.65rem;
}
.configurator--studio .commercial-total__row {
  display: flex;
  justify-content: space-between;
  gap: 0.85rem;
  align-items: baseline;
  font-size: 0.86rem;
}
.configurator--studio .commercial-total__row strong {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.configurator--studio .commercial-total__label-group {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.configurator--studio .commercial-total__row span {
  color: var(--color-text-secondary);
}
.configurator--studio .commercial-total__formula {
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  font-variant-numeric: tabular-nums;
}
.configurator--studio .commercial-total__row--discount strong {
  color: var(--color-success);
}
.configurator--studio .commercial-total .commercial-total-main {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
  padding: 0.85rem 0.95rem;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-raised);
  font-weight: 700;
}
.configurator--studio .commercial-total .commercial-total-main--ready {
  border-color: color-mix(in srgb, var(--color-primary-accent) 40%, var(--color-border-strong));
}
.configurator--studio .commercial-total .commercial-total-main span {
  color: var(--color-text);
  font-size: 0.86rem;
}
.configurator--studio .commercial-total .commercial-total-main strong {
  font-size: 1.4rem;
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}
.configurator--studio .commercial-total p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  line-height: 1.4;
}
.configurator--studio #revision {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.15rem;
  border: 0;
  padding: 0;
  background: transparent;
}
.configurator--studio #revision > .review-hero,
.configurator--studio #revision > .review-alert,
.configurator--studio #revision > .review-pending,
.configurator--studio #revision > .review-card--full {
  grid-column: 1 / -1;
}
.configurator--studio .review-hero {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  gap: 1.25rem;
  padding: clamp(1.1rem, 2.2vw, 1.5rem);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
.configurator--studio .review-hero__identity {
  display: grid;
  align-content: start;
  gap: 0.5rem;
  min-width: 0;
}
.configurator--studio .review-hero__eyebrow-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}
.configurator--studio .review-eyebrow {
  margin: 0;
  color: var(--color-primary-accent);
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.08em;
}
.configurator--studio .review-eyebrow-sep {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.configurator--studio .review-hero h3 {
  display: inline;
  margin: 0;
  font-size: 0.78rem;
  font-weight: 650;
  color: var(--color-text-secondary);
}
.configurator--studio .review-hero h4 {
  margin: 0;
  font-size: clamp(1.25rem, 2.1vw, 1.65rem);
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.configurator--studio .review-hero__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.15rem;
}
.configurator--studio .review-hero__pill {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}
.configurator--studio .review-hero__summary {
  display: grid;
  justify-items: end;
  align-content: space-between;
  gap: 0.65rem;
  flex-shrink: 0;
}
.configurator--studio .review-check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.72rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-success) 32%, var(--color-border));
  background: var(--color-success-soft);
  color: var(--color-success);
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}
.configurator--studio .review-check--pending {
  border-color: color-mix(in srgb, var(--color-danger) 35%, var(--color-border));
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
.configurator--studio .review-hero__total {
  display: grid;
  justify-items: end;
  gap: 0.18rem;
  padding: 0.58rem 0.9rem;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  text-align: right;
}
.configurator--studio .review-hero__total--ready {
  background: var(--color-surface-raised);
  border-color: color-mix(in srgb, var(--color-primary-accent) 38%, var(--color-border-strong));
}
.configurator--studio .review-hero__total span {
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 600;
}
.configurator--studio .review-hero__total strong {
  font-size: clamp(1.15rem, 1.8vw, 1.45rem);
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}
.configurator--studio .review-card {
  display: grid;
  align-content: start;
  gap: 0.95rem;
  padding: clamp(1rem, 2vw, 1.45rem);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  min-width: 0;
}
.configurator--studio .review-card > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.85rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}
.configurator--studio .review-card__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}
.configurator--studio .review-card h4 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  margin: 0;
}
.configurator--studio .review-card h4 svg {
  flex: none;
  color: var(--color-primary-accent);
}
.configurator--studio .review-edit-btn {
  display: inline-flex;
  flex-shrink: 0;
  gap: 0.38rem;
  align-items: center;
  padding: 0.34rem 0.72rem;
  border-radius: 999px;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-muted);
  color: var(--color-text);
  font: inherit;
  font-size: 0.76rem;
  font-weight: 650;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease;
}
.configurator--studio .review-edit-btn svg {
  color: var(--color-primary-accent);
}
.configurator--studio .review-edit-btn:hover {
  background: var(--color-surface-raised);
  border-color: var(--color-primary-accent);
}
.configurator--studio .review-edit-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.configurator--studio .review-subsection {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
}
.configurator--studio .review-card h5 {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-secondary);
  margin: 0;
}
.configurator--studio .review-info,
.configurator--studio .review-measures,
.configurator--studio .review-price-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}
.configurator--studio .review-info,
.configurator--studio .review-price-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.configurator--studio .review-price-grid > div:nth-child(3) {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
}
.configurator--studio .review-info > div,
.configurator--studio .review-measures > div,
.configurator--studio .review-price-grid > div {
  display: grid;
  align-content: start;
  gap: 0.32rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
  padding: 0.75rem 0.85rem;
  min-width: 0;
  overflow-wrap: anywhere;
}
.configurator--studio .review-price-grid strong {
  font-variant-numeric: tabular-nums;
}
.configurator--studio .review-card span,
.configurator--studio .review-card dt {
  color: var(--color-text-secondary);
  font-size: 0.74rem;
}
.configurator--studio .review-card strong {
  font-size: 0.92rem;
}
.configurator--studio .review-empty {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.82rem;
}
.configurator--studio .review-attributes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  font-size: 0.8rem;
}
.configurator--studio .review-attributes p {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  padding: 0.45rem 0.75rem;
  border-radius: var(--radius-control);
  margin: 0;
}
.configurator--studio .review-metrics {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}
.configurator--studio .review-metrics span {
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  border-radius: 999px;
  padding: 0.2rem 0.58rem;
  font-size: 0.72rem;
  font-weight: 650;
}
.configurator--studio .review-group {
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  padding: 0.9rem 1rem;
  border-radius: var(--radius-control);
  min-width: 0;
}
.configurator--studio .review-group summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.86rem;
  gap: 1rem;
}
.configurator--studio .review-group summary span {
  color: var(--color-text);
  font-size: 0.86rem;
}
.configurator--studio .review-group summary small {
  color: var(--color-text-secondary);
  font-weight: 600;
  font-size: 0.74rem;
}
.configurator--studio .review-group[open] summary {
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--color-border);
}
.configurator--studio .review-group__pieces {
  display: grid;
}
.configurator--studio .review-piece {
  display: grid;
  gap: 0.55rem;
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--color-border);
}
.configurator--studio .review-piece:last-child {
  padding-bottom: 0.15rem;
  border-bottom: 0;
}
.configurator--studio .review-piece__header {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}
.configurator--studio .review-piece__title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.configurator--studio .review-piece__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.65rem;
  padding: 0.12rem 0.38rem;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font-size: 0.68rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.configurator--studio .review-piece__qty {
  padding: 0.2rem 0.58rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: 0.73rem;
  font-weight: 600;
}
.configurator--studio .review-piece__qty--muted {
  color: var(--color-text-secondary);
  font-weight: 500;
}
.configurator--studio .review-piece-attributes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
  gap: 0.55rem;
  margin: 0;
}
.configurator--studio .review-piece-attributes > div {
  display: grid;
  gap: 0.2rem;
  padding: 0.52rem 0.68rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  border-radius: var(--radius-control);
}
.configurator--studio .review-piece-attributes dd {
  margin: 0;
  font-size: 0.83rem;
  font-weight: 600;
  color: var(--color-text);
  overflow-wrap: anywhere;
}
.configurator--studio .review-accessories {
  display: grid;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.configurator--studio .review-accessories li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
  font-size: 0.83rem;
}
.configurator--studio .review-accessories li span {
  color: var(--color-text);
  font-size: 0.83rem;
  overflow-wrap: anywhere;
}
.configurator--studio .review-accessories svg {
  color: var(--color-success);
  flex-shrink: 0;
}
.configurator--studio .review-note-box {
  display: grid;
  gap: 0.32rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
}
.configurator--studio .review-note-box p {
  margin: 0;
  font-size: 0.83rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.configurator--studio .review-original-desc {
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
  font-size: 0.8rem;
}
.configurator--studio .review-original-desc summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.configurator--studio .review-original-desc p {
  margin: 0.5rem 0 0;
  color: var(--color-text);
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.configurator--studio .review-history {
  padding: 0.8rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
}
.configurator--studio .review-price-total {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
}
.configurator--studio .review-price-total--ready {
  background: var(--color-surface-raised);
  border-color: color-mix(in srgb, var(--color-primary-accent) 40%, var(--color-border-strong));
}
.configurator--studio .review-price-total strong {
  font-size: 1.65rem;
  font-variant-numeric: tabular-nums;
}
.configurator--studio .review-price-hint {
  font-size: 0.76rem;
  color: var(--color-text-secondary);
  margin: 0;
}
.configurator--studio .review-alert,
.configurator--studio .review-pending {
  display: grid;
  gap: 0.75rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.configurator--studio .review-pending {
  border-color: var(--color-border-strong);
}
.configurator--studio .review-alert__header {
  display: grid;
  gap: 0.25rem;
}
.configurator--studio .review-alert h4,
.configurator--studio .review-pending h4 {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  font-size: 0.96rem;
}
.configurator--studio .review-alert h4 svg {
  color: var(--color-danger);
  flex-shrink: 0;
}
.configurator--studio .review-alert p,
.configurator--studio .review-pending p {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  margin: 0;
}
.configurator--studio .review-alert__list {
  display: grid;
  gap: 0.45rem;
}
.configurator--studio .review-alert button {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  width: 100%;
  text-align: left;
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, var(--color-border));
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: var(--color-text);
  font: inherit;
  font-size: 0.81rem;
  cursor: pointer;
  padding: 0.55rem 0.8rem;
}
.configurator--studio .review-alert button:hover {
  background: var(--color-surface-raised);
  border-color: var(--color-danger);
}
.configurator--studio .review-alert__issue {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--color-text);
  font-size: 0.81rem;
}
.configurator--studio .review-alert__issue span {
  color: var(--color-text);
  font-size: 0.81rem;
}
.configurator--studio .review-alert__issue svg {
  color: var(--color-danger);
  flex-shrink: 0;
}
.configurator--studio .review-alert__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  color: var(--color-primary-accent);
  font-size: 0.75rem;
  font-weight: 700;
}
.configurator--studio .review-alert__cta span {
  color: var(--color-primary-accent);
  font-size: 0.75rem;
}
.configurator--studio .review-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  background: var(--color-surface);
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
.configurator--studio .review-actions__copy {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.configurator--studio .review-actions__copy strong {
  font-size: 0.88rem;
  color: var(--color-text);
}
.configurator--studio .review-actions__copy p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
.configurator--studio .review-actions__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-left: auto;
}
@media (max-width: 75rem) {
  .configurator--studio .studio-component-layout {
    grid-template-columns: minmax(11.5rem, 0.72fr) minmax(0, 1.4fr);
  }
  .configurator--studio .studio-component-layout--empty {
    grid-template-columns: minmax(0, 1fr);
  }
  .configurator--studio .component-identity-grid--with-group {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .configurator--studio .component-identity-grid--with-group :deep(.select) {
    grid-column: 1 / -1;
  }
  .configurator--studio .dimensions-section .measure-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 55rem) {
  .configurator--studio .commercial-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .configurator--studio .commercial-total {
    position: static;
  }
  .configurator--studio .studio-component-layout,
  .configurator--studio .accessories-grid {
    grid-template-columns: 1fr;
  }
  .configurator--studio .tree-group {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .configurator--studio .tree-group h4 {
    grid-column: 1 / -1;
  }
  .configurator--studio .studio-group-card__row {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }
  .configurator--studio .studio-group-card__count {
    justify-self: start;
    min-height: 2rem;
  }
  .configurator--studio .review-piece-attributes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 38rem) {
  .configurator--studio #revision {
    grid-template-columns: minmax(0, 1fr);
  }
  .configurator--studio .review-hero {
    flex-wrap: wrap;
  }
  .configurator--studio .review-hero__summary {
    width: 100%;
    justify-items: start;
  }
  .configurator--studio .review-hero__total {
    width: 100%;
    justify-items: start;
    text-align: left;
  }
  .configurator--studio .review-actions__buttons {
    width: 100%;
    margin-left: 0;
  }
  .configurator--studio .review-actions__buttons :deep(button) {
    width: 100%;
    justify-content: center;
  }
  .configurator--studio .commercial-fields,
  .configurator--studio .commercial-core-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .configurator--studio .dimensions-section .measure-grid,
  .configurator--studio .review-price-grid,
  .configurator--studio .review-info {
    grid-template-columns: 1fr;
  }
  .configurator--studio .review-measures {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .configurator--studio .tree-group,
  .configurator--studio .studio-component-detail .component-specs-grid,
  .configurator--studio .component-identity-grid,
  .configurator--studio .component-identity-grid--with-group,
  .configurator--studio .component-attributes-grid,
  .configurator--studio .accessory-item--editing {
    grid-template-columns: 1fr;
  }
  .configurator--studio .accessory-edit-actions {
    padding-top: 0;
  }
  .configurator--studio .component-identity-grid--with-group :deep(.select) {
    grid-column: auto;
  }
  .configurator--studio .conjunto-destino__select {
    min-width: 0;
    width: 100%;
  }
  .configurator--studio .review-piece-attributes {
    grid-template-columns: 1fr;
  }
  .configurator--studio .review-price-total strong {
    font-size: 1.35rem;
  }
  .configurator--studio .configurator-fields > section {
    padding: var(--space-3);
  }
}
.configurator--studio .studio-identification-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
}
.configurator--studio .studio-identification-fields > * {
  min-width: 0;
  max-width: none;
  padding: 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}
.configurator--studio .studio-attributes-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-2);
}
.configurator--studio .studio-attribute-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 0.55rem;
  padding: 0.85rem;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  min-width: 0;
}
.configurator--studio .studio-attribute-row--nested {
  background: var(--color-surface);
}
.configurator--studio .studio-attribute-row--with-unit {
  grid-template-columns: minmax(0, 1fr) 6.6rem;
}
.configurator--studio .studio-attribute-row > .studio-attribute-field,
.configurator--studio .studio-attribute-row > :deep(.field) {
  min-width: 0;
  width: 100%;
  display: grid;
  gap: 0.45rem;
}
.configurator--studio .studio-attribute-row > .studio-attribute-field > span,
.configurator--studio .studio-attribute-row > :deep(.field > span) {
  display: block;
  min-height: 1.35rem;
  line-height: 1.35rem;
  padding-right: 4.5rem;
  font-size: 0.84rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.configurator--studio .studio-attribute-row > .studio-attribute-unit {
  display: block;
  min-width: 0;
  padding-top: 1.8rem;
}
.configurator--studio .studio-attribute-row input,
.configurator--studio .studio-attribute-row select {
  width: 100%;
  min-width: 0;
  min-height: 2.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  padding: 0.6rem;
  color: var(--color-text);
  background: var(--color-surface-raised);
  font: inherit;
}
@media (max-width: 72rem) {
  .configurator--studio .studio-attributes-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 48rem) {
  .configurator--studio .studio-identification-fields,
  .configurator--studio .studio-attributes-grid {
    grid-template-columns: 1fr;
  }
}
.configurator--studio .studio-attribute-error {
  grid-column: 1 / -1;
  color: var(--color-danger);
  margin: 0;
  font-size: 0.78rem;
}
</style>
