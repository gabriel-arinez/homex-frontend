<script setup lang="ts">
import { reactive, ref } from 'vue'
import type {
  EspecificacionMueble,
  EspecificacionMuebleWritable,
  ValorCatalogoPublico,
} from '@/generated/api'
import Button from '@/shared/ui/Button.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'

type ComponenteEditable = {
  nombre: string
  material: string
  espesor: string
  color: string
  dimensiones: string
  acabado: string
}
const props = defineProps<{
  tipos: ValorCatalogoPublico[]
  especificacion?: EspecificacionMueble | null
  processing?: boolean
  externalError?: string
}>()
const emit = defineEmits<{ save: [body: EspecificacionMuebleWritable]; cancel: [] }>()
const saving = ref(false)
const error = ref('')
const stringify = (value: unknown) =>
  typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value)
const initial = Array.isArray(props.especificacion?.componentes)
  ? (props.especificacion.componentes as Array<Record<string, unknown>>)
  : []
const componentes = reactive<ComponenteEditable[]>(
  (initial.length ? initial : [{ nombre: '' }]).map((item) => ({
    nombre: stringify(item.nombre),
    material: stringify(item.material),
    espesor: stringify(item.espesor),
    color: stringify(item.color),
    dimensiones: stringify(item.dimensiones),
    acabado: stringify(item.acabado),
  })),
)
const form = reactive({
  tipo_mueble: String(props.especificacion?.tipo_mueble ?? ''),
  texto_original: props.especificacion?.texto_original ?? '',
  accesorios: Array.isArray(props.especificacion?.accesorios)
    ? props.especificacion.accesorios.join('\n')
    : stringify(props.especificacion?.accesorios),
  advertencias: Array.isArray(props.especificacion?.advertencias)
    ? props.especificacion.advertencias.join('\n')
    : '',
  observaciones: props.especificacion?.observaciones ?? '',
})
function agregarComponente() {
  componentes.push({
    nombre: '',
    material: '',
    espesor: '',
    color: '',
    dimensiones: '',
    acabado: '',
  })
}
function interpretar(valor: string): unknown {
  const texto = valor.trim()
  if (!texto) return null
  if (texto.startsWith('{') || texto.startsWith('[')) {
    try {
      return JSON.parse(texto)
    } catch {
      throw new Error('Las medidas estructuradas deben contener JSON válido.')
    }
  }
  return texto
}
function listaDeTextos(valor: string): string[] {
  return valor
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
}
function accesorios(): unknown {
  if (form.accesorios.trim().startsWith('{') || form.accesorios.trim().startsWith('[')) {
    return interpretar(form.accesorios)
  }
  return listaDeTextos(form.accesorios)
}
function construirComponente(item: ComponenteEditable) {
  const componente: Record<string, unknown> = { nombre: item.nombre.trim() }
  for (const clave of ['material', 'espesor', 'color', 'dimensiones', 'acabado'] as const) {
    const valor = interpretar(item[clave])
    if (valor !== null) componente[clave] = valor
  }
  return componente
}
function submit() {
  if (props.processing || saving.value) return
  saving.value = true
  error.value = ''
  try {
    if (componentes.some((item) => !item.nombre.trim())) {
      throw new Error('Cada componente debe tener un nombre.')
    }
    emit('save', {
      tipo_mueble: form.tipo_mueble ? Number(form.tipo_mueble) : null,
      schema_version: 2,
      componentes: componentes.map(construirComponente),
      texto_original: form.texto_original || null,
      advertencias: listaDeTextos(form.advertencias),
      accesorios: accesorios(),
      observaciones: form.observaciones || null,
      // Se conservan los campos heredados si se edita una ficha V1.
      espesor: props.especificacion?.espesor ?? null,
      color_principal: props.especificacion?.color_principal ?? null,
      color_secundario: props.especificacion?.color_secundario ?? null,
      dimensiones: props.especificacion?.dimensiones ?? null,
    })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Datos inválidos.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="spec" @submit.prevent="submit">
    <Select
      v-model="form.tipo_mueble"
      name="tipo-mueble"
      label="Tipo de mueble"
      :options="[
        { label: 'Sin especificar', value: '' },
        ...tipos.map((item) => ({ label: item.nombre, value: String(item.id) })),
      ]"
    />
    <p class="hint">
      Cada parte puede tener su propio material, espesor, color y dimensiones. Puedes escribir «a
      elección» si la característica aún no está definida.
    </p>
    <section v-for="(componente, indice) in componentes" :key="indice" class="component">
      <div class="component-header">
        <strong>Componente {{ indice + 1 }}</strong>
        <Button
          v-if="componentes.length > 1"
          variant="secondary"
          :disabled="processing"
          @click="componentes.splice(indice, 1)"
          >Quitar componente</Button
        >
      </div>
      <TextField
        v-model="componente.nombre"
        :name="`componente-nombre-${indice}`"
        label="Nombre de la parte"
        placeholder="Mesón, estructura, cajonera..."
      />
      <div class="two">
        <TextField
          v-model="componente.material"
          :name="`componente-material-${indice}`"
          label="Material"
        />
        <TextField
          v-model="componente.espesor"
          :name="`componente-espesor-${indice}`"
          label="Espesor"
          placeholder="18 mm"
        />
        <TextField v-model="componente.color" :name="`componente-color-${indice}`" label="Color" />
        <TextField
          v-model="componente.dimensiones"
          :name="`componente-dimensiones-${indice}`"
          label="Dimensiones"
          hint='Texto o JSON, por ejemplo {"ancho":"1,40 m"}'
        />
        <TextField
          v-model="componente.acabado"
          :name="`componente-acabado-${indice}`"
          label="Acabado"
        />
      </div>
    </section>
    <Button variant="secondary" :disabled="processing" @click="agregarComponente">
      Agregar componente
    </Button>
    <TextField
      v-model="form.texto_original"
      name="texto-original"
      label="Descripción original del cliente"
      hint="Se conserva sin cambiar el texto de la cotización."
    />
    <TextField
      v-model="form.accesorios"
      name="accesorios"
      label="Accesorios incluidos"
      hint="Uno por línea. No se crean ítems comerciales adicionales."
    />
    <TextField
      v-model="form.advertencias"
      name="advertencias"
      label="Advertencias o características pendientes"
      hint="Una por línea; no se completan automáticamente."
    />
    <TextField
      v-model="form.observaciones"
      name="observaciones-especificacion"
      label="Observaciones de fabricación"
    />
    <p v-if="error || externalError" role="alert">{{ error || externalError }}</p>
    <div class="actions">
      <Button type="submit" :processing="saving || processing">Guardar especificación</Button>
      <Button variant="secondary" :disabled="saving || processing" @click="emit('cancel')">
        Cancelar
      </Button>
    </div>
  </form>
</template>

<style scoped>
.spec {
  display: grid;
  gap: var(--space-4);
}
.component {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
.component-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
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
  .two,
  .actions {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
