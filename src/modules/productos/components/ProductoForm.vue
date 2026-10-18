<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type {
  FamiliaProducto,
  Producto,
  ProductoWritable,
  ValorCatalogoPublico,
} from '@/generated/api'
import { proformasService } from '@/modules/proformas/services/proformasService'
import Button from '@/shared/ui/Button.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'
const props = defineProps<{
  initial?: Producto
  processing?: boolean
  preselectCategory?: string
}>()
const emit = defineEmits<{
  save: [body: ProductoWritable, file: File | null]
  cancel: []
  change: []
}>()
const opciones = reactive<Record<string, ValorCatalogoPublico[]>>({})
const familias = ref<FamiliaProducto[]>([])
const loading = ref(true)
const error = ref('')
const fields = ref<Record<string, string[]>>({})
const image = ref<File | null>(null)
const form = reactive({
  categoria: String(props.initial?.categoria ?? ''),
  familia: String(props.initial?.familia ?? ''),
  sku: props.initial?.sku ?? '',
  nombre: props.initial?.nombre ?? '',
  precio_lista: props.initial?.precio_lista ?? '',
  unidad_stock: String(props.initial?.unidad_stock ?? ''),
  observaciones: props.initial?.observaciones ?? '',
  activo: props.initial?.activo !== false,
  marca: String(props.initial?.silla?.marca ?? props.initial?.piso?.marca ?? ''),
  modelo: props.initial?.silla?.modelo ?? props.initial?.piso?.modelo ?? '',
  color_primario: String(props.initial?.silla?.color_primario ?? ''),
  color_secundario: String(props.initial?.silla?.color_secundario ?? ''),
  especificaciones: props.initial?.silla?.especificaciones
    ? JSON.stringify(props.initial.silla.especificaciones)
    : '',
  tipo: String(props.initial?.piso?.tipo ?? ''),
  material: String(props.initial?.piso?.material ?? ''),
  diseno: String(props.initial?.piso?.diseno ?? ''),
  acabado: String(props.initial?.piso?.acabado ?? ''),
  espesor_mm: props.initial?.piso?.espesor_mm ?? '',
  largo_mm: props.initial?.piso?.largo_mm ?? '',
  ancho_mm: props.initial?.piso?.ancho_mm ?? '',
  m2_por_caja: props.initial?.piso?.m2_por_caja ?? '',
  promo_activa: Boolean(props.initial?.promocion),
  promo_enabled: props.initial?.promocion?.activo ?? true,
  precio_antes: props.initial?.promocion?.precio_antes ?? '',
  precio_ahora: props.initial?.promocion?.precio_ahora ?? '',
  fecha_inicio: props.initial?.promocion?.fecha_inicio ?? '',
  fecha_fin: props.initial?.promocion?.fecha_fin ?? '',
})
type TipoCampo = 'texto' | 'numero' | 'booleano' | 'nulo'
type CampoSilla = { clave: string; valor: string; tipo: TipoCampo }
function esObjeto(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function camposSimples(value: unknown): CampoSilla[] {
  if (!esObjeto(value)) return []
  return Object.entries(value)
    .filter(([, dato]) => dato === null || typeof dato !== 'object')
    .map(([clave, dato]) => ({
      clave,
      valor: dato === null ? '' : String(dato),
      tipo: dato === null
        ? 'nulo'
        : typeof dato === 'number'
          ? 'numero'
          : typeof dato === 'boolean'
            ? 'booleano'
            : 'texto',
    }))
}
const camposSilla = ref<CampoSilla[]>(camposSimples(props.initial?.silla?.especificaciones))
const modoJson = ref(false)
function objetoEspecificaciones(): unknown {
  const datos: unknown = form.especificaciones.trim()
    ? JSON.parse(form.especificaciones)
    : {}
  if (!esObjeto(datos)) throw new Error('Las especificaciones guiadas necesitan un objeto JSON.')
  const original = camposSimples(props.initial?.silla?.especificaciones)
  const combinado: Record<string, unknown> = { ...datos }
  for (const campo of original) delete combinado[campo.clave]
  const claves = new Set<string>()
  for (const campo of camposSilla.value) {
    const clave = campo.clave.trim()
    if (!clave) throw new Error('Cada característica debe tener un nombre.')
    if (claves.has(clave)) throw new Error('No se puede repetir una característica de la silla.')
    if (clave in combinado) throw new Error('Ya existe una característica avanzada con ese nombre.')
    claves.add(clave)
    if (campo.tipo === 'numero') {
      if (!campo.valor.trim() || !Number.isFinite(Number(campo.valor))) {
        throw new Error('Las características numéricas requieren un número válido.')
      }
      combinado[clave] = Number(campo.valor)
    } else if (campo.tipo === 'booleano') combinado[clave] = campo.valor === 'true'
    else if (campo.tipo === 'nulo') combinado[clave] = null
    else combinado[clave] = campo.valor
  }
  return combinado
}
function editarJsonAvanzado() {
  error.value = ''
  try {
    if (!modoJson.value) {
      form.especificaciones = JSON.stringify(objetoEspecificaciones(), null, 2)
      modoJson.value = true
    } else {
      const datos: unknown = form.especificaciones.trim()
        ? JSON.parse(form.especificaciones)
        : {}
      camposSilla.value = camposSimples(datos)
      modoJson.value = false
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'La ficha contiene JSON inválido.'
  }
}
function agregarCampoSilla() {
  camposSilla.value.push({ clave: '', valor: '', tipo: 'texto' })
  emit('change')
}
function quitarCampoSilla(index: number) {
  camposSilla.value.splice(index, 1)
  emit('change')
}
const categoria = computed(
  () => opciones.CATEGORIA_PRODUCTO?.find((x) => String(x.id) === form.categoria)?.codigo,
)
const opts = (key: string, empty = 'Sin seleccionar') => [
  { label: empty, value: '' },
  ...(opciones[key] ?? []).map((x) => ({ label: x.nombre, value: String(x.id) })),
]
async function load() {
  loading.value = true
  try {
    const keys = [
      'CATEGORIA_PRODUCTO',
      'UNIDAD_MEDIDA',
      'MARCA',
      'COLOR',
      'TIPO_PISO',
      'MATERIAL_PISO',
      'DISENO_PISO',
      'ACABADO_PISO',
    ] as const
    const [f, ...values] = await Promise.all([
      proformasService.families(),
      ...keys.map((k) => proformasService.options(k)),
    ])
    familias.value = f.results
    keys.forEach((k, i) => (opciones[k] = values[i] as ValorCatalogoPublico[]))
    if (!props.initial && props.preselectCategory) {
      const categoria = opciones.CATEGORIA_PRODUCTO?.find(
        (item) => item.codigo === props.preselectCategory,
      )
      if (categoria) {
        form.categoria = String(categoria.id)
        const unidadCodigo = categoria.codigo === 'PISO_FLOTANTE' ? 'M2' : 'PIEZA'
        const unidad = opciones.UNIDAD_MEDIDA?.find((item) => item.codigo === unidadCodigo)
        if (unidad) form.unidad_stock = String(unidad.id)
      }
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se cargaron los catálogos.'
  } finally {
    loading.value = false
  }
}
function nullable(value: string) {
  return value ? Number(value) : null
}
function submit() {
  error.value = ''
  fields.value = {}
  let especificaciones: unknown = null
  try {
    if (categoria.value === 'SILLA') {
      especificaciones = modoJson.value
        ? (form.especificaciones.trim() ? JSON.parse(form.especificaciones) : {})
        : objetoEspecificaciones()
    }
  } catch (cause) {
    error.value = cause instanceof Error
      ? cause.message
      : 'Las especificaciones de la silla deben ser JSON válido.'
    return
  }
  const body: ProductoWritable = {
    categoria: Number(form.categoria),
    familia: nullable(form.familia),
    sku: form.sku,
    nombre: form.nombre,
    precio_lista: form.precio_lista,
    unidad_stock: Number(form.unidad_stock),
    observaciones: form.observaciones || null,
    activo: form.activo,
  }
  if (categoria.value === 'SILLA')
    body.silla = {
      marca: nullable(form.marca),
      modelo: form.modelo || null,
      color_primario: nullable(form.color_primario),
      color_secundario: nullable(form.color_secundario),
      especificaciones,
    }
  if (categoria.value === 'PISO_FLOTANTE')
    body.piso = {
      marca: nullable(form.marca),
      modelo: form.modelo || null,
      tipo: nullable(form.tipo),
      material: nullable(form.material),
      diseno: nullable(form.diseno),
      acabado: nullable(form.acabado),
      espesor_mm: form.espesor_mm || null,
      largo_mm: form.largo_mm || null,
      ancho_mm: form.ancho_mm || null,
      m2_por_caja: form.m2_por_caja || null,
    }
  if (!form.promo_activa && props.initial?.promocion) body.promocion = null
  if (form.promo_activa)
    body.promocion = {
      precio_antes: form.precio_antes,
      precio_ahora: form.precio_ahora,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      activo: form.promo_enabled,
    }
  emit('save', body, image.value)
}
onMounted(load)
</script>
<template>
  <form
    class="product-form"
    :aria-busy="loading || processing"
    @input="emit('change')"
    @change="emit('change')"
    @submit.prevent="submit"
  >
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="grid">
      <Select
        v-model="form.categoria"
        name="categoria"
        label="Categoría"
        :disabled="Boolean(initial)"
        :options="opts('CATEGORIA_PRODUCTO', 'Seleccionar categoría')"
      /><Select
        v-model="form.familia"
        name="familia"
        label="Familia o variante"
        :options="[
          { label: 'Sin familia', value: '' },
          ...familias.map((x) => ({ label: x.nombre, value: String(x.id) })),
        ]"
      /><TextField v-model="form.sku" name="sku" label="SKU" :error="fields.sku?.[0]" /><TextField
        v-model="form.nombre"
        name="nombre"
        label="Nombre comercial"
      /><TextField
        v-model="form.precio_lista"
        name="precio"
        label="Precio de lista (BOB)"
        type="number"
        min="0"
        step="0.01"
      /><Select
        v-model="form.unidad_stock"
        name="unidad"
        label="Unidad comercial"
        :disabled="Boolean(initial)"
        :options="opts('UNIDAD_MEDIDA', 'Seleccionar unidad')"
      /><TextField v-model="form.observaciones" name="observaciones" label="Observaciones" />
    </div>
    <fieldset v-if="categoria === 'SILLA' || categoria === 'PISO_FLOTANTE'">
      <legend>Ficha {{ categoria === 'SILLA' ? 'de silla' : 'de piso' }}</legend>
      <div class="grid">
        <Select
          v-model="form.marca"
          name="marca"
          label="Marca"
          :options="opts('MARCA')"
        /><TextField v-model="form.modelo" name="modelo" label="Modelo" /><template
          v-if="categoria === 'SILLA'"
          ><Select
            v-model="form.color_primario"
            name="color1"
            label="Color primario"
            :options="opts('COLOR')" /><Select
            v-model="form.color_secundario"
            name="color2"
            label="Color secundario"
            :options="opts('COLOR')" /><section class="ficha-silla">
            <h3>Características adicionales de la silla</h3>
            <p class="hint">
              Registra cada característica mediante su nombre y valor. Se conservan también las
              propiedades avanzadas que ya tenga el producto.
            </p>
            <template v-if="!modoJson">
              <div v-for="(campo, index) in camposSilla" :key="index" class="campo-silla">
                <label>
                  Característica
                  <input v-model="campo.clave" :aria-label="'Característica ' + (index + 1)" />
                </label>
                <label>
                  Valor
                  <input v-model="campo.valor" :aria-label="'Valor ' + (index + 1)"
                    :disabled="campo.tipo === 'nulo' || campo.tipo === 'booleano'" />
                </label>
                <label>
                  Tipo de dato
                  <select v-model="campo.tipo" :aria-label="'Tipo de dato ' + (index + 1)">
                    <option value="texto">Texto</option>
                    <option value="numero">Número</option>
                    <option value="booleano">Sí / No</option>
                    <option value="nulo">Sin valor</option>
                  </select>
                </label>
                <label v-if="campo.tipo === 'booleano'">
                  Valor lógico
                  <select v-model="campo.valor" :aria-label="'Valor lógico ' + (index + 1)">
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </label>
                <Button type="button" variant="secondary" @click="quitarCampoSilla(index)">
                  Quitar
                </Button>
              </div>
              <Button type="button" variant="secondary" @click="agregarCampoSilla">
                Añadir característica
              </Button>
            </template>
            <label v-else>
              Edición avanzada (JSON)
              <textarea v-model="form.especificaciones" rows="6"
                aria-label="Especificaciones avanzadas JSON" placeholder="{}" />
            </label>
            <Button type="button" variant="secondary" @click="editarJsonAvanzado">
              {{ modoJson ? 'Volver al formulario guiado' : 'Edición avanzada JSON' }}
            </Button>
          </section></template
        ><template v-else
          ><Select
            v-model="form.tipo"
            name="tipo-piso"
            label="Tipo"
            :options="opts('TIPO_PISO')" /><Select
            v-model="form.material"
            name="material"
            label="Material"
            :options="opts('MATERIAL_PISO')" /><Select
            v-model="form.diseno"
            name="diseno"
            label="Diseño"
            :options="opts('DISENO_PISO')" /><Select
            v-model="form.acabado"
            name="acabado"
            label="Acabado"
            :options="opts('ACABADO_PISO')" /><TextField
            v-model="form.espesor_mm"
            name="espesor"
            label="Espesor (mm)"
            type="number"
            min="0" /><TextField
            v-model="form.largo_mm"
            name="largo"
            label="Largo descriptivo (mm)"
            type="number"
            min="0" /><TextField
            v-model="form.ancho_mm"
            name="ancho"
            label="Ancho descriptivo (mm)"
            type="number"
            min="0" /><TextField
            v-model="form.m2_por_caja"
            name="m2-caja"
            label="m² por caja (informativo)"
            type="number"
            min="0"
            step="0.0001"
        /></template>
      </div>
    </fieldset>
    <fieldset>
      <legend>Promoción de catálogo</legend>
      <label><input v-model="form.promo_activa" type="checkbox" /> Configurar promoción</label>
      <div v-if="form.promo_activa" class="grid">
        <label><input v-model="form.promo_enabled" type="checkbox" /> Promoción activa</label>
        <TextField
          v-model="form.precio_antes"
          name="antes"
          label="Precio anterior"
          type="number"
          min="0"
        /><TextField
          v-model="form.precio_ahora"
          name="ahora"
          label="Precio promocional"
          type="number"
          min="0"
        /><TextField
          v-model="form.fecha_inicio"
          name="inicio"
          label="Inicio"
          type="date"
        /><TextField v-model="form.fecha_fin" name="fin" label="Fin" type="date" />
      </div>
    </fieldset>
    <label><input v-model="form.activo" type="checkbox" /> Producto activo</label
    ><label v-if="!initial"
      >Imagen principal (opcional)<input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        @change="image = ($event.target as HTMLInputElement).files?.[0] ?? null"
    /></label>
    <p class="hint">El stock se registra únicamente mediante movimientos autorizados.</p>
    <div class="actions">
      <Button type="submit" :processing="processing">Guardar producto</Button
      ><Button type="button" variant="secondary" :disabled="processing" @click="emit('cancel')"
        >Cancelar</Button
      >
    </div>
  </form>
</template>
<style scoped>
.product-form {
  display: grid;
  gap: var(--space-5);
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
fieldset {
  display: grid;
  gap: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
}
label {
  display: grid;
  gap: var(--space-2);
  font-weight: 600;
}
textarea {
  min-height: 6rem;
  padding: 0.75rem;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
}
.ficha-silla { display: grid; gap: var(--space-3); grid-column: 1 / -1; }
.ficha-silla h3, .ficha-silla p { margin: 0; }
.campo-silla { display: flex; gap: var(--space-3); flex-wrap: wrap; align-items: flex-end; }
.campo-silla label { flex: 1 1 10rem; }
.campo-silla input, .campo-silla select { width: 100%; min-height: 2.75rem; padding: var(--space-2); border: 1px solid var(--color-border-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); }
.actions {
  display: flex;
  gap: var(--space-3);
}
.hint {
  color: var(--color-text-secondary);
}
[role='alert'] {
  color: var(--color-danger);
}
@media (max-width: 35rem) {
  .grid,
  .actions {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
