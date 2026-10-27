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
      if (p.codigo === 'TOTAL_NEGOCIADO')
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
  return [cantidad, precio, descuento].every(Number.isFinite) ? cantidad * precio - descuento : null
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
const accesorios = reactive<string[]>(structuredClone(base.accesorios ?? []))
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
  componentes.push({
    uid: uid(),
    conjunto_uid: conjunto_uid || undefined,
    nombre: '',
    cantidad_interna: 1,
    atributos: [],
  })
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
  changed()
}
function deshacerComponente() {
  const removed = componentesRetirados.value.pop()
  if (!removed) return
  componentes.splice(Math.min(removed.index, componentes.length), 0, removed.item)
  changed()
}
function addAccesorio() {
  if (accesorios.some((item) => !item.trim())) return
  accesorios.push('')
  changed()
}
function removeAccesorio(index: number) {
  const item = accesorios[index]
  if (item === undefined) return
  accesoriosRetirados.value.push({ item, index })
  accesorios.splice(index, 1)
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
function submit() {
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
  if (!Number.isFinite(descuento) || descuento < 0 || descuento > cantidad * precio)
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
  <form class="configurator" @input="changed" @change="changed" @submit.prevent="submit">
    <header class="config-header">
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
    <aside
      v-if="pendientesVisibles.length"
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
    <section id="identificacion">
      <h3>Identificación</h3>
      <TextField
        v-model="comercial.nombre"
        name="mueble-nombre-comercial"
        label="Nombre comercial del mueble"
      />
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
    </section>
    <section id="dimensiones">
      <h3>Dimensiones generales opcionales</h3>
      <p>Cada medida conserva su unidad y los datos técnicos originales.</p>
      <div v-for="medida in medidas" :key="medida.clave" class="inline">
        <TextField
          v-model="medida.valor"
          :name="medida.clave"
          :label="medida.clave.replace(/_/g, ' ')"
        />
        <label
          >Unidad
          <select
            :id="`unidad-${medida.clave}`"
            v-model="medida.unidad"
            :aria-label="'Unidad de ' + medida.clave"
            :aria-invalid="pendientesDimension(medida.clave).length ? true : undefined"
            :aria-describedby="
              pendientesDimension(medida.clave).length ? `pendiente-${medida.clave}` : undefined
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
      <div class="inline">
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
    </section>
    <section>
      <h3>Características generales</h3>
      <div class="attribute-search">
        <TextField v-model="search" name="buscar-atributo" label="Buscar característica" />
        <div v-if="search" class="suggestions">
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
    <section>
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
      <article v-for="(g, gi) in conjuntos" :key="g.uid" class="card">
        <div class="inline">
          <TextField v-model="g.nombre" :name="`grupo-${gi}`" label="Nombre del conjunto" /><Button
            variant="secondary"
            @click="addComponente(g.uid)"
            >Añadir componente</Button
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
          <Button variant="secondary" @click="conjuntoPorEliminar = null">Cancelar traslado</Button>
        </div>
      </article>
    </section>
    <section id="componentes">
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
      <details v-for="(c, i) in componentes" :key="c.uid || i" class="card" open>
        <summary>Componente {{ i + 1 }}: {{ c.nombre || 'Sin nombre' }}</summary>
        <div class="heading">
          <strong>Componente {{ i + 1 }}</strong>
          <div>
            <button type="button" @click="move(i, -1)">Subir</button
            ><button type="button" @click="move(i, 1)">Bajar</button>
          </div>
        </div>
        <div class="grid">
          <TextField v-model="c.nombre" :name="`componente-nombre-${i}`" label="Nombre" /><label
            class="number-field"
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
            label="Dimensiones literales"
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
            <input v-model="a.valor" :name="`atributo-${i}-${ai}`" type="number" step="any" />
          </label>
          <TextField v-else v-model="a.valor" :name="`atributo-${i}-${ai}`" :label="a.nombre" />
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
        <div class="inline">
          <Button variant="secondary" @click="duplicateComponente(i)">Duplicar</Button
          ><Button variant="secondary" @click="removeComponente(i)">Quitar</Button>
        </div>
      </details>
      <Button v-if="componentesRetirados.length" variant="secondary" @click="deshacerComponente">
        Deshacer eliminación de componente
      </Button>
    </section>
    <section id="accesorios">
      <h3>Accesorios incluidos</h3>
      <div v-for="(_, i) in accesorios" :key="i" class="inline">
        <TextField v-model="accesorios[i]" :name="`accesorio-${i}`" label="Descripción" /><Button
          variant="secondary"
          @click="removeAccesorio(i)"
          >Quitar</Button
        >
      </div>
      <Button
        variant="secondary"
        :disabled="accesorios.some((a) => !a.trim())"
        @click="addAccesorio"
        >Añadir accesorio</Button
      >
      <Button v-if="accesoriosRetirados.length" variant="secondary" @click="deshacerAccesorio">
        Deshacer eliminación de accesorio
      </Button>
    </section>
    <section>
      <TextField
        v-model="form.observaciones"
        name="observaciones-especificacion"
        label="Observaciones"
      />
      <div v-if="base.advertencias?.length">
        <h4>Información pendiente histórica</h4>
        <ul>
          <li v-for="item in base.advertencias" :key="item">{{ item }}</li>
        </ul>
      </div>
    </section>
    <section id="comercial">
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
        <TextField v-model="comercial.cantidad" name="mueble-cantidad" label="Cantidad cotizada" />
        <Select
          v-model="comercial.unidad"
          name="mueble-unidad"
          label="Unidad comercial"
          :options="
            (unidades ?? [])
              .filter((u) => ['PIEZA', 'JUEGO'].includes(u.codigo))
              .map((u) => ({ label: u.nombre, value: String(u.id) }))
          "
        />
        <TextField
          v-model="comercial.precio_unitario"
          name="mueble-precio"
          :label="'Precio unitario negociado (' + (moneda ?? 'BOB') + ')'"
        />
        <TextField
          v-model="comercial.descuento"
          name="mueble-descuento"
          label="Descuento monetario total de línea"
        />
      </div>
      <p role="status">
        Total estimado en {{ moneda ?? 'BOB' }}:
        {{ totalEstimado === null ? 'Pendiente' : totalEstimado.toFixed(2) }}. El importe definitivo
        se calcula en PostgreSQL.
      </p>
    </section>
    <section id="revision" aria-labelledby="revision-title">
      <h3 id="revision-title">Revisar mueble</h3>
      <dl class="review-grid">
        <div>
          <dt>Nombre comercial</dt>
          <dd>{{ comercial.nombre || 'Dato no especificado' }}</dd>
        </div>
        <div>
          <dt>Tipo</dt>
          <dd>
            {{
              tiposLocales.find((x) => String(x.id) === form.tipo_mueble)?.nombre ||
              'Dato no especificado'
            }}
          </dd>
        </div>
        <div>
          <dt>Cantidad cotizada</dt>
          <dd>
            {{ comercial.cantidad || 'Dato no especificado' }}
            {{ unidades?.find((u) => String(u.id) === comercial.unidad)?.nombre }}
          </dd>
        </div>
        <div>
          <dt>Precio unitario</dt>
          <dd>{{ comercial.precio_unitario || 'Dato no especificado' }} {{ moneda ?? 'BOB' }}</dd>
        </div>
        <div>
          <dt>Descuento de línea</dt>
          <dd>{{ comercial.descuento ?? '0.00' }}</dd>
        </div>
        <div>
          <dt>Componentes</dt>
          <dd>{{ componentes.length }}</dd>
        </div>
        <div>
          <dt>Accesorios</dt>
          <dd>{{ accesorios.filter((x) => x.trim()).length }}</dd>
        </div>
        <div>
          <dt>Total estimado</dt>
          <dd>
            {{ totalEstimado === null ? 'Pendiente' : totalEstimado.toFixed(2) }}
            {{ moneda ?? 'BOB' }}
          </dd>
        </div>
      </dl>
      <div class="review-detail">
        <h4>Dimensiones generales</h4>
        <ul>
          <li v-for="medida in medidas.filter((m) => m.valor.trim())" :key="medida.clave">
            {{ medida.clave.replace(/_/g, ' ') }}: {{ medida.valor }} {{ medida.unidad }}
          </li>
        </ul>
        <p v-if="!medidas.some((m) => m.valor.trim())">Dato no especificado.</p>
        <h4>Atributos generales</h4>
        <ul>
          <li v-for="attr in atributosGenerales" :key="attr.codigo || attr.nombre">
            {{ attr.nombre }}: {{ attr.valor }} {{ attr.unidad ?? '' }}
          </li>
        </ul>
        <h4>Conjuntos</h4>
        <ul>
          <li v-for="grupo in conjuntos" :key="grupo.uid">
            {{ grupo.nombre }}:
            {{
              componentes
                .filter((c) => c.conjunto_uid === grupo.uid)
                .map((c) => c.nombre)
                .join(', ') || 'Sin componentes'
            }}
          </li>
        </ul>
        <h4>Componentes y sus características</h4>
        <article v-for="c in componentes" :key="c.uid" class="review-piece">
          <h5>
            {{ c.nombre || 'Sin nombre' }} · Cantidad por mueble:
            {{ c.cantidad_interna ?? 'No indicada' }}
          </h5>
          <p v-if="c.material">Material: {{ c.material }}</p>
          <p v-if="c.espesor">Espesor: {{ c.espesor }}</p>
          <p v-if="c.color">Color: {{ c.color }}</p>
          <p v-if="c.dimensiones">Dimensiones: {{ c.dimensiones }}</p>
          <p v-if="c.conjunto_uid">
            Conjunto: {{ conjuntos.find((g) => g.uid === c.conjunto_uid)?.nombre }}
          </p>
          <ul>
            <li v-for="attr in c.atributos ?? []" :key="attr.codigo || attr.nombre">
              {{ attr.nombre }}: {{ attr.valor }} {{ attr.unidad ?? '' }}
            </li>
          </ul>
        </article>
        <h4>Accesorios incluidos</h4>
        <ul>
          <li v-for="(acc, i) in accesorios" :key="i">{{ acc || 'Pendiente de completar' }}</li>
        </ul>
        <h4>Observaciones y pendientes</h4>
        <p>{{ form.observaciones || 'Sin observaciones adicionales.' }}</p>
        <ul>
          <li v-for="(warning, i) in base.advertencias ?? []" :key="i">{{ warning }}</li>
        </ul>
        <p v-if="base.descripcion_original">
          Descripción original conservada: {{ base.descripcion_original }}
        </p>
      </div>
      <p>
        La ficha se incorporará localmente. La proforma sólo se enviará al servidor al guardar el
        borrador o emitirla.
      </p>
    </section>
    <p v-if="error || externalError" role="alert">{{ error || externalError }}</p>
    <div class="actions">
      <Button type="submit" :disabled="processing" aria-label="Guardar especificación"
        >Agregar mueble a la proforma</Button
      ><Button variant="secondary" @click="emit('cancel')">Cancelar</Button>
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
</style>
