<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
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
import MuebleOptionPicker from './MuebleOptionPicker.vue'
import { Pencil, AlertCircle, CheckCircle2, Layers3, Plus } from '@lucide/vue'
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
  activeSection?: 'general' | 'estructura' | 'accesorios' | 'comercial' | 'revision'
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
const comercial = reactive({
  nombre: String(props.detalle?.nombre ?? ''),
  descripcion: String(props.detalle?.descripcion ?? ''),
  cantidad: String(props.detalle?.cantidad ?? '1'),
  unidad: String(
    props.detalle?.unidad ?? props.unidades?.find((x) => x.codigo === 'PIEZA')?.id ?? '',
  ),
  precio_unitario: String(props.detalle?.precio_unitario ?? ''),
  descuento: String(props.detalle?.descuento ?? '0.00'),
})
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
  if (!clave || medidas.some((x) => x.clave === clave)) return
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
  if (conjuntos.some((g) => !componentes.some((c) => c.conjunto_uid === g.uid))) return
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
function addComponente(conjunto_uid?: string) {
  if (componentes.some((c) => !c.nombre.trim()) || componentes.length >= limites.max_componentes)
    return
  const nuevoUid = uid()
  componentes.push({
    uid: nuevoUid,
    conjunto_uid: conjunto_uid || undefined,
    nombre: '',
    cantidad_interna: 1,
    atributos: [],
  })
  activeComponentUid.value = nuevoUid
  changed()
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
function addAccesorio() {
  if (accesorios.some((item) => !item.trim())) return
  accesorios.push('')
  accesorioEnEdicion.value = accesorios.length - 1
  changed()
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
  if (componentes.length >= limites.max_componentes || componentes.some((c) => !c.nombre.trim()))
    return
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
  if (!nombre || target.some((a) => (a.codigo || a.nombre) === (option?.codigo || nombre))) return
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

function submit() {
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
    return
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
}
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
          <h3>Identificación</h3>
          <TextField
            v-model="comercial.nombre"
            name="mueble-nombre-comercial"
            label="Nombre comercial del mueble *"
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
            placeholder="Buscar un tipo existente..."
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
        </section>
        <section
          id="dimensiones"
          class="dimensions-section"
          v-show="!studio || activeSection === 'general'"
        >
          <h3>Dimensiones generales opcionales</h3>
          <p>Cada medida conserva su unidad y los datos técnicos originales.</p>
          <div class="measure-grid">
            <div v-for="medida in medidas" :key="medida.clave" class="inline measure-row">
              <TextField
                v-model="medida.valor"
                :name="medida.clave"
                :label="medida.clave.replace(/_/g, ' ')"
                input-mode="decimal"
                :error="errorMedida(medida)"
                @blur="touchedMedidas[medida.clave] = true"
              />
              <label
                >Unidad
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
                  <option value="">Sin unidad identificada</option>
                  <option v-for="unidad in unidadesPermitidas" :key="unidad" :value="unidad">
                    {{ unidad }}
                  </option>
                </select>
              </label>
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
                v-if="!clavesIniciales.includes(medida.clave)"
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
          <MuebleOptionPicker
            v-else
            :model-value="''"
            name="agregar-medida"
            label="Agregar medida"
            placeholder="Buscar una medida, por ejemplo: diámetro"
            :options="
              opcionesMedidas
                .filter((x) => !medidas.some((m) => m.clave === x))
                .map((x) => ({ value: x, label: x.replace(/_/g, ' ') }))
            "
            allow-create
            create-label="Agregar medida personalizada"
            @update:model-value="agregarMedidaElegida"
            @create="agregarMedidaElegida"
          />
        </section>
        <section v-show="!studio || activeSection === 'general'">
          <h3>Características generales</h3>
          <div class="attribute-search">
            <MuebleOptionPicker
              v-if="studio"
              :model-value="''"
              name="buscar-atributo-estudio"
              label="Agregar característica"
              placeholder="Buscar característica existente..."
              :options="
                catalogo
                  .filter(
                    (x) =>
                      !Array.isArray(x.ambitos) ||
                      !x.ambitos.length ||
                      x.ambitos.includes('mueble'),
                  )
                  .map((x) => ({ value: String(x.id), label: x.nombre }))
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
          <p v-if="catalogError" role="status">{{ catalogError }}</p>
          <div v-for="(a, i) in atributosGenerales" :key="a.codigo || a.nombre" class="inline">
            <label v-if="a.tipo_entrada === 'entero'">
              {{ a.nombre }}
              <input v-model="a.valor" :name="`general-${i}`" type="number" step="1" />
            </label>
            <label v-else-if="a.tipo_entrada === 'numero_unidad'">
              {{ a.nombre }}
              <input v-model="a.valor" :name="`general-${i}`" type="number" step="any" />
            </label>
            <TextField v-else v-model="a.valor" :name="`general-${i}`" :label="a.nombre" />
            <label v-if="a.tipo_entrada === 'numero_unidad'"
              >Unidad de {{ a.nombre }}
              <select v-model="a.unidad">
                <option value="">No especificada</option>
                <option v-for="unidad in unidadesPermitidas" :key="unidad" :value="unidad">
                  {{ unidad }}
                </option>
              </select>
            </label>
            <Button variant="secondary" @click="atributosGenerales.splice(i, 1)">Quitar</Button>
          </div>
        </section>
        <section
          v-show="!studio || activeSection === 'estructura'"
          :class="{ 'studio-group-management': studio }"
        >
          <div class="heading">
            <h3>Conjuntos ({{ conjuntos.length }}/{{ limites.max_conjuntos }})</h3>
            <Button
              variant="secondary"
              :disabled="
                conjuntos.length >= limites.max_conjuntos ||
                conjuntos.some((g) => !componentes.some((c) => c.conjunto_uid === g.uid))
              "
              @click="addConjunto"
              >Añadir conjunto</Button
            >
          </div>
          <article v-for="(g, gi) in conjuntos" :key="g.uid" class="card studio-group-card">
            <div class="inline">
              <TextField
                v-model="g.nombre"
                :name="`grupo-${gi}`"
                label="Nombre del conjunto *"
                :error="errorGrupo(g)"
                @blur="touchedGrupos[g.uid] = true"
              /><Button variant="secondary" @click="addComponente(g.uid)">Añadir componente</Button
              ><Button variant="secondary" @click="removeConjunto(gi)">Quitar conjunto</Button>
            </div>
            <div
              v-if="conjuntoPorEliminar === g.uid"
              class="conjunto-destino"
              role="group"
              :aria-label="'Reasignación del conjunto ' + g.nombre"
            >
              <p>Elige a dónde mover sus componentes. Ninguna pieza se eliminará.</p>
              <label
                >Destino de componentes
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
          </article>
        </section>
        <section id="componentes" v-show="!studio || activeSection === 'estructura'">
          <div class="heading">
            <h3>Componentes ({{ componentes.length }}/{{ limites.max_componentes }})</h3>
            <Button
              variant="secondary"
              :disabled="
                componentes.length >= limites.max_componentes ||
                componentes.some((c) => !c.nombre.trim())
              "
              @click="addComponente()"
              >Agregar componente</Button
            >
          </div>
          <div class="studio-component-layout">
            <aside
              v-if="studio"
              class="studio-component-tree"
              aria-label="Explorador de componentes"
            >
              <p class="tree-heading">
                <Layers3 :size="15" aria-hidden="true" /> ELEMENTOS DEL MUEBLE
              </p>
              <p v-if="!componentes.length" class="tree-empty">
                No hay piezas todavía. Utiliza «Agregar componente» para comenzar.
              </p>
              <div v-for="grupo in gruposArbol" :key="grupo.id" class="tree-group">
                <h4>
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
                  <strong>{{ item.pieza.nombre || 'Componente sin nombre' }}</strong>
                  <small>{{ item.pieza.cantidad_interna ?? '—' }} por mueble</small>
                </button>
              </div>
            </aside>
            <div class="studio-component-detail">
              <details
                v-for="(c, i) in componentes"
                v-show="!studio || activeComponentUid === (c.uid || String(i))"
                :key="c.uid || i"
                class="card"
                open
              >
                <summary v-if="!studio">
                  Componente {{ i + 1 }}: {{ c.nombre || 'Sin nombre' }}
                </summary>
                <div class="heading">
                  <strong>Componente {{ i + 1 }}</strong>
                  <div>
                    <button type="button" :disabled="i === 0" @click="move(i, -1)">Subir</button
                    ><button
                      type="button"
                      :disabled="i === componentes.length - 1"
                      @click="move(i, 1)"
                    >
                      Bajar
                    </button>
                  </div>
                </div>
                <div class="grid">
                  <TextField
                    v-model="c.nombre"
                    :name="`componente-nombre-${i}`"
                    label="Nombre *"
                    :error="errorPieza(c)"
                    @blur="touchedPiezas[c.uid ?? c.nombre] = true"
                  /><label class="number-field"
                    >Cantidad por mueble<input
                      :value="c.cantidad_interna ?? ''"
                      @input="setCantidadInterna(c, $event)"
                      :name="`componente-${i}-cantidad`"
                      type="number"
                      min="1" /></label
                  ><TextField
                    v-model="c.material"
                    :name="`componente-material-${i}`"
                    label="Material"
                  /><TextField
                    v-model="c.espesor"
                    :name="`componente-espesor-${i}`"
                    label="Espesor"
                  /><TextField v-model="c.color" :name="`componente-color-${i}`" label="Color" />
                  <p v-if="c.dimensiones && typeof c.dimensiones !== 'string'">
                    Dimensiones históricas: {{ readableDimension(c.dimensiones) }}
                  </p>
                  <TextField
                    v-else
                    v-model="c.dimensiones"
                    :name="`componente-dimensiones-${i}`"
                    label="Medidas o dimensiones de la pieza"
                  />
                </div>
                <Select
                  v-model="c.conjunto_uid"
                  :name="`componente-${i}-grupo`"
                  label="Conjunto"
                  :options="[
                    { label: 'Sin conjunto', value: '' },
                    ...conjuntos.map((g) => ({ label: g.nombre || 'Sin nombre', value: g.uid })),
                  ]"
                />
                <div class="attribute-search component-attribute-search">
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
                </div>
                <div v-for="(a, ai) in c.atributos" :key="a.codigo || a.nombre" class="inline">
                  <label v-if="a.tipo_entrada === 'entero'">
                    {{ a.nombre }}
                    <input v-model="a.valor" :name="`atributo-${i}-${ai}`" type="number" step="1" />
                  </label>
                  <label v-else-if="a.tipo_entrada === 'numero_unidad'">
                    {{ a.nombre }}
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
                  />
                  <label v-if="a.tipo_entrada === 'numero_unidad'"
                    >Unidad de {{ a.nombre }}
                    <select v-model="a.unidad">
                      <option value="">No especificada</option>
                      <option v-for="unidad in unidadesPermitidas" :key="unidad" :value="unidad">
                        {{ unidad }}
                      </option>
                    </select>
                  </label>
                  <Button variant="secondary" @click="c.atributos?.splice(ai, 1)">Quitar</Button>
                </div>
                <details v-if="studio" class="component-actions-menu">
                  <summary>Acciones de esta pieza</summary>
                  <div>
                    <Button variant="secondary" @click="duplicateComponente(i)"
                      >Duplicar componente</Button
                    >
                    <Button variant="secondary" @click="removeComponente(i)"
                      >Quitar componente</Button
                    >
                  </div>
                </details>
                <div v-else class="inline">
                  <Button variant="secondary" @click="duplicateComponente(i)">Duplicar</Button>
                  <Button variant="secondary" @click="removeComponente(i)">Quitar</Button>
                </div>
              </details>
              <div v-if="studio && !componentes.length" class="empty-editor">
                <h4>Empieza por una pieza</h4>
                <p>
                  Agrega un componente y podrás completar sus materiales, dimensiones y
                  características.
                </p>
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
          <div class="heading">
            <h3>Accesorios incluidos</h3>
            <span v-if="studio" class="accessory-count"
              >{{ accesorios.filter((a) => a.trim()).length }} registrados</span
            >
          </div>
          <div
            v-for="(_, i) in accesorios"
            :key="i"
            class="accessory-item"
            :class="{ 'accessory-item--studio': studio }"
          >
            <template v-if="studio && accesorios[i]?.trim() && accesorioEnEdicion !== i">
              <div class="accessory-item-label">
                <CheckCircle2 :size="18" aria-hidden="true" /><strong>{{ accesorios[i] }}</strong>
              </div>
              <Button variant="secondary" @click="accesorioEnEdicion = i"
                ><Pencil :size="15" aria-hidden="true" /> Editar</Button
              >
            </template>
            <TextField
              v-else
              v-model="accesorios[i]"
              :name="`accesorio-${i}`"
              label="Descripción del accesorio *"
              :error="errorAccesorio(i)"
              @blur="touchedAccesorios[i] = true"
            />
            <Button variant="secondary" @click="removeAccesorio(i)">Quitar</Button>
            <Button
              v-if="studio && accesorioEnEdicion === i && accesorios[i]?.trim()"
              variant="secondary"
              @click="accesorioEnEdicion = null"
              >Listo</Button
            >
          </div>
          <Button
            variant="secondary"
            :disabled="accesorios.some((a) => !a.trim())"
            @click="addAccesorio"
            ><Plus :size="16" aria-hidden="true" /> Añadir accesorio</Button
          >
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
        <section v-show="!studio || activeSection === 'accesorios'">
          <TextAreaField
            v-model="form.observaciones"
            name="observaciones-especificacion"
            label="Observaciones y detalles adicionales"
            :rows="5"
            hint="Incluye indicaciones de fabricación, instalación o acuerdos especiales."
          />
          <div v-if="base.advertencias?.length">
            <h4>Información pendiente histórica</h4>
            <ul>
              <li v-for="item in base.advertencias" :key="item">{{ item }}</li>
            </ul>
          </div>
        </section>
        <section id="comercial" v-show="!studio || activeSection === 'comercial'">
          <h3>Datos comerciales de este mueble</h3>
          <aside v-if="totalDictado" aria-label="Revisión de precio total dictado">
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
          <div class="grid">
            <TextField
              v-model="comercial.descripcion"
              name="mueble-descripcion"
              label="Descripción comercial opcional"
            />
            <TextField
              v-model="comercial.cantidad"
              name="mueble-cantidad"
              label="Cantidad cotizada *"
              input-mode="numeric"
              :error="errorCampo('comercial', 0, touched.cantidad)"
              @blur="touched.cantidad = true"
            />
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
            <TextField
              v-model="comercial.precio_unitario"
              name="mueble-precio"
              :label="'Precio unitario negociado (' + (moneda ?? 'BOB') + ') *'"
              input-mode="decimal"
              :error="errorCampo('comercial', 2, touched.precio)"
              @blur="touched.precio = true"
            />
            <TextField
              v-model="comercial.descuento"
              name="mueble-descuento"
              label="Descuento monetario total de línea *"
              input-mode="decimal"
              :error="errorCampo('comercial', 3, touched.descuento)"
              @blur="touched.descuento = true"
            />
          </div>
          <div class="commercial-total" role="status">
            <div>
              <span>Subtotal</span
              ><strong>{{
                comercial.cantidad.trim() &&
                comercial.precio_unitario.trim() &&
                Number(comercial.precio_unitario) > 0
                  ? (Number(comercial.cantidad) * Number(comercial.precio_unitario)).toFixed(2) +
                    ' ' +
                    (moneda ?? 'BOB')
                  : 'Pendiente'
              }}</strong>
            </div>
            <div>
              <span>Descuento</span
              ><strong>{{
                comercial.descuento.trim()
                  ? comercial.descuento + ' ' + (moneda ?? 'BOB')
                  : 'Pendiente'
              }}</strong>
            </div>
            <div class="commercial-total-main">
              <span>Total estimado del mueble</span
              ><strong>{{
                totalEstimado === null
                  ? 'Importe pendiente'
                  : totalEstimado.toFixed(2) + ' ' + (moneda ?? 'BOB')
              }}</strong>
            </div>
            <p>El total definitivo se confirmará al guardar la proforma.</p>
          </div>
        </section>
        <section
          id="revision"
          v-show="!studio || activeSection === 'revision'"
          class="furniture-review"
          aria-labelledby="revision-title"
        >
          <header class="review-hero">
            <div>
              <p class="review-eyebrow">FICHA TÉCNICO-COMERCIAL</p>
              <h3 id="revision-title">Revisar mueble</h3>
              <h4>{{ comercial.nombre || 'Mueble pendiente de nombre' }}</h4>
              <p>
                {{
                  tiposLocales.find((x) => String(x.id) === form.tipo_mueble)?.nombre ||
                  'Tipo de mueble no especificado'
                }}
              </p>
            </div>
            <span
              v-if="
                !Object.values(erroresSecciones).some((lista) => lista.length) &&
                !pendientesVisibles.length
              "
              class="review-check"
              ><CheckCircle2 :size="24" aria-label="Sin datos obligatorios pendientes"
            /></span>
            <span v-else class="review-check review-check--pending"
              ><AlertCircle :size="24" aria-label="Hay información que revisar"
            /></span>
          </header>
          <div
            v-if="Object.values(erroresSecciones).some((lista) => lista.length)"
            class="review-alert"
            aria-label="Datos que debes revisar"
          >
            <h4><AlertCircle :size="19" aria-hidden="true" /> Información por completar</h4>
            <p>Revisa estos datos antes de incorporar el mueble a la proforma.</p>
            <div v-for="section in pasosValidacion" :key="section">
              <button
                v-for="(issue, index) in erroresSecciones[section]"
                :key="index"
                type="button"
                @click="irASeccion(section)"
              >
                <AlertCircle :size="15" aria-hidden="true" /> {{ issue }}
                <Pencil :size="14" aria-hidden="true" />
              </button>
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
          <article class="review-card">
            <header>
              <h4>Información general</h4>
              <button type="button" @click="irASeccion('general')">
                <Pencil :size="15" aria-hidden="true" /> Editar
              </button>
            </header>
            <div class="review-info">
              <div>
                <span>Nombre comercial</span><strong>{{ comercial.nombre || 'Pendiente' }}</strong>
              </div>
              <div>
                <span>Tipo de mueble</span
                ><strong>{{
                  tiposLocales.find((x) => String(x.id) === form.tipo_mueble)?.nombre ||
                  'No especificado'
                }}</strong>
              </div>
            </div>
            <h5>Dimensiones generales</h5>
            <div v-if="medidas.some((m) => m.valor.trim())" class="review-measures">
              <div v-for="medida in medidas.filter((m) => m.valor.trim())" :key="medida.clave">
                <span>{{ medida.clave.replace(/_/g, ' ') }}</span>
                <strong>{{ medida.valor }} {{ medida.unidad || 'Unidad pendiente' }}</strong>
              </div>
            </div>
            <p v-else class="review-empty">No se especificaron medidas generales.</p>
            <div v-if="atributosGenerales.length">
              <h5>Características generales</h5>
              <div class="review-attributes">
                <p v-for="attr in atributosGenerales" :key="attr.codigo || attr.nombre">
                  {{ attr.nombre }}:
                  <strong>{{ attr.valor || 'Pendiente' }} {{ attr.unidad ?? '' }}</strong>
                </p>
              </div>
            </div>
          </article>
          <article class="review-card">
            <header>
              <h4>Estructura y componentes</h4>
              <button type="button" @click="irASeccion('estructura')">
                <Pencil :size="15" aria-hidden="true" /> Editar
              </button>
            </header>
            <div class="review-metrics">
              <span>{{ conjuntos.length }} conjuntos</span
              ><span>{{ componentes.length }} componentes</span>
            </div>
            <p v-if="!componentes.length" class="review-empty">
              No se agregaron componentes técnicos.
            </p>
            <details v-for="grupo in gruposArbol" :key="grupo.id" class="review-group" open>
              <summary>
                {{ grupo.nombre }} <small>{{ grupo.piezas.length }} componentes</small>
              </summary>
              <div
                v-for="item in grupo.piezas"
                :key="item.pieza.uid || item.index"
                class="review-piece"
              >
                <div>
                  <strong>{{ item.pieza.nombre || 'Componente pendiente de nombre' }}</strong
                  ><span>{{ item.pieza.cantidad_interna ?? '—' }} por mueble</span>
                </div>
                <dl class="review-piece-attributes">
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
                  <div v-for="attr in item.pieza.atributos ?? []" :key="attr.codigo || attr.nombre">
                    <dt>{{ attr.nombre }}</dt>
                    <dd>{{ attr.valor }} {{ attr.unidad ?? '' }}</dd>
                  </div>
                </dl>
              </div>
            </details>
          </article>
          <article class="review-card">
            <header>
              <h4>Accesorios y observaciones</h4>
              <button type="button" @click="irASeccion('accesorios')">
                <Pencil :size="15" aria-hidden="true" /> Editar
              </button>
            </header>
            <ul v-if="accesorios.filter((a) => a.trim()).length" class="review-accessories">
              <li v-for="(acc, index) in accesorios.filter((a) => a.trim())" :key="index">
                <CheckCircle2 :size="16" aria-hidden="true" /> {{ acc }}
              </li>
            </ul>
            <p v-else class="review-empty">Sin accesorios registrados.</p>
            <h5>Observaciones</h5>
            <p>{{ form.observaciones || 'Sin observaciones adicionales.' }}</p>
            <div v-if="base.advertencias?.length" class="review-history">
              <h5>Advertencias de la información anterior</h5>
              <ul>
                <li v-for="warning in base.advertencias" :key="warning">{{ warning }}</li>
              </ul>
            </div>
            <details v-if="base.descripcion_original">
              <summary>Ver descripción técnica original conservada</summary>
              <p>{{ base.descripcion_original }}</p>
            </details>
          </article>
          <article class="review-card review-commercial">
            <header>
              <h4>Datos comerciales</h4>
              <button type="button" @click="irASeccion('comercial')">
                <Pencil :size="15" aria-hidden="true" /> Editar
              </button>
            </header>
            <div class="review-price-grid">
              <div>
                <span>Cantidad cotizada</span
                ><strong
                  >{{ comercial.cantidad || 'Pendiente' }}
                  {{
                    unidades?.find((u) => String(u.id) === comercial.unidad)?.nombre ?? ''
                  }}</strong
                >
              </div>
              <div>
                <span>Precio unitario</span
                ><strong
                  >{{ comercial.precio_unitario || 'Pendiente' }} {{ moneda ?? 'BOB' }}</strong
                >
              </div>
              <div>
                <span>Descuento</span
                ><strong>{{ comercial.descuento || 'Pendiente' }} {{ moneda ?? 'BOB' }}</strong>
              </div>
            </div>
            <p v-if="comercial.descripcion">Descripción comercial: {{ comercial.descripcion }}</p>
            <div class="review-price-total">
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
          <p class="review-final-note">
            El mueble se añadirá a esta proforma. Después podrás guardar la proforma o emitirla.
          </p>
        </section>
      </div>
    </div>
    <p v-if="error || externalError" role="alert">{{ error || externalError }}</p>
    <div v-if="!studio || activeSection === 'revision'" class="actions review-actions">
      <Button type="submit" :disabled="processing">{{
        studio ? 'Agregar mueble a la proforma' : 'Guardar especificación'
      }}</Button>
      <Button v-if="!studio" variant="secondary" @click="emit('cancel')">Cancelar</Button>
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
  .grid {
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
.configurator--studio .configurator-fields > section > h3 {
  margin-bottom: 0.4rem;
  font-size: 1rem;
}
.configurator--studio .configurator-fields > section > p {
  color: var(--color-text-secondary);
  font-size: 0.83rem;
}
.configurator--studio .configurator-fields #identificacion {
  gap: 1.05rem;
}
.configurator--studio #identificacion .field:first-of-type {
  max-width: 46rem;
}
.configurator--studio .dimensions-section .measure-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  margin: var(--space-3) 0;
}
.configurator--studio .dimensions-section .measure-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(5.8rem, 0.38fr);
  gap: 0.6rem;
  align-items: start;
  min-width: 0;
}
.configurator--studio .dimensions-section .measure-row label {
  min-width: 0;
  font-size: 0.82rem;
  font-weight: 600;
}
.configurator--studio .dimensions-section .measure-row label select {
  width: 100%;
  min-height: 2.75rem;
  margin-top: 0.45rem;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
}
.configurator--studio .dimensions-section .dimension-pending {
  grid-column: 1/-1;
  color: var(--color-danger-text);
  margin: 0;
  font-size: 0.77rem;
}
.configurator--studio .dimensions-section .measure-row > button {
  grid-column: 1/-1;
  justify-self: start;
}
.configurator--studio .dimensions-section .mueble-picker {
  max-width: 36rem;
}
.configurator--studio .attribute-search {
  position: static;
  background: transparent;
  padding: 0;
  max-width: 40rem;
}
.configurator--studio #componentes {
  display: grid;
  gap: 1rem;
}
.configurator--studio .studio-component-layout {
  display: grid;
  grid-template-columns: minmax(13rem, 0.72fr) minmax(0, 1.6fr);
  gap: 1rem;
  align-items: start;
  min-width: 0;
}
.configurator--studio .studio-component-tree {
  display: grid;
  align-content: start;
  gap: 0.65rem;
  padding: 1rem;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  min-width: 0;
}
.configurator--studio .tree-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.5rem;
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  font-weight: 750;
  letter-spacing: 0.06em;
}
.configurator--studio .tree-empty {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.configurator--studio .tree-group {
  display: grid;
  gap: 0.4rem;
}
.configurator--studio .tree-group h4 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.83rem;
  margin: 0.5rem 0 0.15rem;
}
.configurator--studio .tree-group h4 small {
  color: var(--color-text-secondary);
}
.configurator--studio .tree-item {
  display: grid;
  gap: 0.2rem;
  text-align: left;
  padding: 0.75rem;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-surface);
  font: inherit;
  cursor: pointer;
}
.configurator--studio .tree-item:hover {
  border-color: var(--color-border-strong);
}
.configurator--studio .tree-item--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}
.configurator--studio .tree-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.configurator--studio .tree-item strong {
  overflow-wrap: anywhere;
  font-size: 0.85rem;
}
.configurator--studio .tree-item small {
  color: var(--color-text-secondary);
  font-size: 0.73rem;
}
.configurator--studio .studio-component-detail {
  min-width: 0;
}
.configurator--studio .studio-component-detail details.card {
  background: var(--color-surface-muted);
  min-width: 0;
  margin: 0;
}
.configurator--studio .studio-component-detail .heading {
  gap: 0.5rem;
  align-items: center;
}
.configurator--studio .studio-component-detail .grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.configurator--studio .studio-component-detail button {
  cursor: pointer;
}
.configurator--studio .component-actions-menu {
  border-top: 1px solid var(--color-border);
  padding-top: 0.65rem;
}
.configurator--studio .component-actions-menu summary {
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  color: var(--color-text-secondary);
}
.configurator--studio .component-actions-menu > div {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}
.configurator--studio .studio-component-detail button:focus-visible {
  outline: 2px solid var(--color-primary);
}
.configurator--studio .studio-component-detail .attribute-search {
  margin-top: 1rem;
}
.configurator--studio .empty-editor {
  padding: 2.5rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-card);
  text-align: center;
}
.configurator--studio .empty-editor h4 {
  margin: 0 0 0.3rem;
}
.configurator--studio .empty-editor p {
  font-size: 0.83rem;
  color: var(--color-text-secondary);
}
.configurator--studio .studio-group-card {
  background: var(--color-surface-muted);
}
.configurator--studio .studio-group-card .inline {
  align-items: end;
}
.configurator--studio .undo-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
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
.configurator--studio .accessory-count {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
.configurator--studio .accessory-item--studio {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  align-items: center;
  max-width: 55rem;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  padding: 0.75rem;
  border-radius: var(--radius-control);
}
.configurator--studio .accessory-item--studio .field {
  flex: 1;
  min-width: 13rem;
}
.configurator--studio .accessory-item-label {
  display: flex;
  gap: 0.6rem;
  flex: 1;
  align-items: center;
  min-width: 0;
}
.configurator--studio .accessory-item-label svg {
  color: var(--color-success);
  flex-shrink: 0;
}
.configurator--studio .accessory-item-label strong {
  overflow-wrap: anywhere;
  font-size: 0.85rem;
}
.configurator--studio .commercial-total {
  display: grid;
  gap: 0.7rem;
  padding: 1rem;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  max-width: 45rem;
}
.configurator--studio .commercial-total > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: baseline;
  font-size: 0.86rem;
}
.configurator--studio .commercial-total > div span {
  color: var(--color-text-secondary);
}
.configurator--studio .commercial-total .commercial-total-main {
  padding-top: 1rem;
  border-top: 1px solid var(--color-border-strong);
  font-weight: 700;
}
.configurator--studio .commercial-total .commercial-total-main strong {
  font-size: 1.45rem;
  font-variant-numeric: tabular-nums;
}
.configurator--studio .commercial-total p {
  margin: 0.1rem 0 0;
  color: var(--color-text-secondary);
  font-size: 0.72rem;
}
.configurator--studio #revision {
  display: grid;
  gap: 1.2rem;
  border: 0;
  padding: 0;
  background: transparent;
}
.configurator--studio .review-hero {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
  padding: 1.6rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
.configurator--studio .review-eyebrow {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.67rem;
  font-weight: 750;
  letter-spacing: 0.09em;
}
.configurator--studio .review-hero h3 {
  margin: 0.3rem 0 0.65rem;
  font-size: 0.87rem;
  color: var(--color-text-secondary);
}
.configurator--studio .review-hero h4 {
  margin: 0 0 0.35rem;
  font-size: clamp(1.25rem, 2vw, 1.65rem);
}
.configurator--studio .review-hero p:last-child {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
.configurator--studio .review-check {
  color: var(--color-success);
}
.configurator--studio .review-check--pending {
  color: var(--color-danger);
}
.configurator--studio .review-card {
  display: grid;
  gap: 1rem;
  padding: clamp(1rem, 2vw, 1.6rem);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  min-width: 0;
}
.configurator--studio .review-card > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
.configurator--studio .review-card h4 {
  font-size: 1.02rem;
  margin: 0;
}
.configurator--studio .review-card h5 {
  font-size: 0.83rem;
  margin: 0.2rem 0 0.25rem;
}
.configurator--studio .review-card header button {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  color: var(--color-primary-accent);
  background: transparent;
  border: 0;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.configurator--studio .review-info,
.configurator--studio .review-measures,
.configurator--studio .review-price-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}
.configurator--studio .review-info {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.configurator--studio .review-info > div,
.configurator--studio .review-measures > div,
.configurator--studio .review-price-grid > div {
  display: grid;
  gap: 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: 0.8rem;
  min-width: 0;
  overflow-wrap: anywhere;
}
.configurator--studio .review-card span,
.configurator--studio .review-card dt {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.configurator--studio .review-card strong {
  font-size: 0.92rem;
}
.configurator--studio .review-empty {
  color: var(--color-text-secondary);
  font-size: 0.83rem;
}
.configurator--studio .review-attributes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  font-size: 0.8rem;
}
.configurator--studio .review-attributes p {
  background: var(--color-surface-muted);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-control);
  margin: 0;
}
.configurator--studio .review-metrics {
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
}
.configurator--studio .review-metrics span {
  background: var(--color-surface-muted);
  border-radius: 999px;
  padding: 0.4rem 0.7rem;
  font-size: 0.74rem;
}
.configurator--studio .review-group {
  border: 1px solid var(--color-border);
  padding: 1rem;
  border-radius: var(--radius-control);
  min-width: 0;
}
.configurator--studio .review-group summary {
  display: flex;
  justify-content: space-between;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.87rem;
  gap: 1rem;
}
.configurator--studio .review-group summary small {
  color: var(--color-text-secondary);
  font-weight: 400;
}
.configurator--studio .review-piece {
  display: grid;
  gap: 0.45rem;
  padding: 0.9rem 0;
  border-bottom: 1px solid var(--color-border);
}
.configurator--studio .review-piece:last-child {
  border-bottom: 0;
}
.configurator--studio .review-piece > div:first-child {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}
.configurator--studio .review-piece-attributes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
  margin: 0;
}
.configurator--studio .review-piece-attributes > div {
  display: grid;
  gap: 0.25rem;
  padding: 0.5rem;
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
}
.configurator--studio .review-piece-attributes dd {
  margin: 0;
  font-size: 0.82rem;
  overflow-wrap: anywhere;
}
.configurator--studio .review-accessories {
  display: grid;
  gap: 0.55rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.configurator--studio .review-accessories li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.84rem;
}
.configurator--studio .review-accessories svg {
  color: var(--color-success);
  flex-shrink: 0;
}
.configurator--studio .review-history {
  padding: 0.8rem;
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
}
.configurator--studio .review-price-total {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
}
.configurator--studio .review-price-total strong {
  font-size: 1.75rem;
  font-variant-numeric: tabular-nums;
}
.configurator--studio .review-price-hint {
  font-size: 0.77rem;
  color: var(--color-text-secondary);
  margin: 0;
}
.configurator--studio .review-alert,
.configurator--studio .review-pending {
  display: grid;
  gap: 0.65rem;
  padding: 1.1rem;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.configurator--studio .review-pending {
  border-color: var(--color-border-strong);
}
.configurator--studio .review-alert h4,
.configurator--studio .review-pending h4 {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  font-size: 0.96rem;
}
.configurator--studio .review-alert p,
.configurator--studio .review-pending p {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  margin: 0;
}
.configurator--studio .review-alert button {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  text-align: left;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0.4rem 0.1rem;
}
.configurator--studio .review-final-note {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
.configurator--studio .review-actions {
  display: flex;
  justify-content: end;
  background: var(--color-surface);
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
@media (max-width: 75rem) {
  .configurator--studio .studio-component-layout {
    grid-template-columns: minmax(11rem, 0.7fr) minmax(0, 1.4fr);
  }
  .configurator--studio .dimensions-section .measure-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 55rem) {
  .configurator--studio .studio-component-layout {
    grid-template-columns: 1fr;
  }
  .configurator--studio .studio-component-tree {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .configurator--studio .tree-heading,
  .configurator--studio .tree-empty {
    grid-column: 1/-1;
  }
  .configurator--studio .review-piece-attributes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 38rem) {
  .configurator--studio .dimensions-section .measure-grid,
  .configurator--studio .review-price-grid,
  .configurator--studio .review-info {
    grid-template-columns: 1fr;
  }
  .configurator--studio .review-measures {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .configurator--studio .studio-component-tree,
  .configurator--studio .studio-component-detail .grid {
    grid-template-columns: 1fr;
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
</style>
