<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { EspecificacionMuebleWritable, ValorCatalogoPublico } from '@/generated/api'
import Button from '@/shared/ui/Button.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'
const props = defineProps<{
    tipos: ValorCatalogoPublico[]
    processing?: boolean
    externalError?: string
  }>(),
  emit = defineEmits<{ save: [body: EspecificacionMuebleWritable]; cancel: [] }>(),
  saving = ref(false),
  error = ref('')
const form = reactive({
  tipo_mueble: '',
  espesor: '',
  color_principal: '',
  color_secundario: '',
  dimensiones: '',
  accesorios: '',
  observaciones: '',
})
const parse = (v: string) => {
  if (!v.trim()) return null
  try {
    return JSON.parse(v)
  } catch {
    throw new Error('Usa JSON válido, por ejemplo {"ancho": 1.20}.')
  }
}
async function submit() {
  if (props.processing) return
  saving.value = true
  error.value = ''
  try {
    emit('save', {
      tipo_mueble: form.tipo_mueble ? Number(form.tipo_mueble) : null,
      schema_version: 1,
      espesor: parse(form.espesor),
      color_principal: form.color_principal || null,
      color_secundario: form.color_secundario || null,
      dimensiones: parse(form.dimensiones),
      accesorios: parse(form.accesorios),
      observaciones: form.observaciones || null,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Datos inválidos.'
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
        ...props.tipos.map((x) => ({ label: x.nombre, value: String(x.id) })),
      ]"
    /><TextField
      v-model="form.espesor"
      name="espesor"
      label="Espesor (JSON opcional)"
      hint='Ejemplo: {"valor":18,"unidad":"mm"}'
    />
    <div class="two">
      <TextField
        v-model="form.color_principal"
        name="color-principal"
        label="Color principal"
      /><TextField
        v-model="form.color_secundario"
        name="color-secundario"
        label="Color secundario"
      />
    </div>
    <TextField
      v-model="form.dimensiones"
      name="dimensiones"
      label="Dimensiones (JSON opcional)"
    /><TextField
      v-model="form.accesorios"
      name="accesorios"
      label="Accesorios (JSON opcional)"
    /><TextField
      v-model="form.observaciones"
      name="observaciones-especificacion"
      label="Observaciones de fabricación"
    />
    <p v-if="error || externalError" role="alert">{{ error || externalError }}</p>
    <div class="actions">
      <Button type="submit" :processing="saving || processing">Guardar especificación</Button
      ><Button variant="secondary" @click="emit('cancel')">Cancelar</Button>
    </div>
  </form>
</template>
<style scoped>
.spec {
  display: grid;
  gap: var(--space-4);
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
.actions {
  display: flex;
  gap: var(--space-3);
}
@media (max-width: 35rem) {
  .two,
  .actions {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
