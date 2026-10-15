<script setup lang="ts">
import { computed } from 'vue'
import type { ValorCatalogoPublico } from '@/generated/api'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'

export type ClienteFormModel = {
  tipo_cliente: string
  nombres: string
  apellidos: string
  empresa: string
  celular: string
  direccion: string
  observaciones: string
}

const props = defineProps<{
  model: ClienteFormModel
  tipos: ValorCatalogoPublico[]
  errors?: Record<string, string[]>
  typeReadonly?: boolean
  prefix?: string
}>()
const emit = defineEmits<{
  change: [field: keyof ClienteFormModel, value: string]
}>()

const prefix = computed(() => (props.prefix ? `${props.prefix}-` : ''))
const selectedType = computed(() =>
  props.tipos.filter(Boolean).find((type) => String(type.id) === props.model.tipo_cliente),
)
const isCompany = computed(() => selectedType.value?.codigo === 'EMPRESA')
</script>

<template>
  <div class="client-fields">
    <div v-if="typeReadonly" class="readonly-field">
      <span>Tipo de cliente</span>
      <strong>{{ selectedType?.nombre ?? 'Tipo no disponible' }}</strong>
      <small>El tipo se conserva para proteger su identidad comercial.</small>
    </div>
    <Select
      v-else
      :model-value="model.tipo_cliente"
      :name="`${prefix}tipo-cliente`"
      label="Tipo de cliente"
      :options="tipos.map((type) => ({ label: type.nombre, value: String(type.id) }))"
      @update:model-value="emit('change', 'tipo_cliente', $event)"
    />
    <TextField
      :model-value="model.nombres"
      :name="`${prefix}nombres`"
      :label="isCompany ? 'Nombres del contacto' : 'Nombres'"
      autocomplete="given-name"
      :error="errors?.nombres?.[0]"
      @update:model-value="emit('change', 'nombres', $event)"
    />
    <TextField
      :model-value="model.apellidos"
      :name="`${prefix}apellidos`"
      :label="isCompany ? 'Apellidos del contacto' : 'Apellidos'"
      autocomplete="family-name"
      :error="errors?.apellidos?.[0]"
      @update:model-value="emit('change', 'apellidos', $event)"
    />
    <TextField
      v-if="isCompany"
      :model-value="model.empresa"
      :name="`${prefix}empresa`"
      label="Razón social o empresa"
      autocomplete="organization"
      :error="errors?.empresa?.[0]"
      @update:model-value="emit('change', 'empresa', $event)"
    />
    <TextField
      :model-value="model.celular"
      :name="`${prefix}celular`"
      label="Celular"
      autocomplete="tel"
      :error="errors?.celular?.[0]"
      @update:model-value="emit('change', 'celular', $event)"
    />
    <TextField
      :model-value="model.direccion"
      :name="`${prefix}direccion`"
      label="Dirección"
      autocomplete="street-address"
      :error="errors?.direccion?.[0]"
      @update:model-value="emit('change', 'direccion', $event)"
    />
    <TextField
      :model-value="model.observaciones"
      :name="`${prefix}observaciones`"
      label="Observaciones"
      :error="errors?.observaciones?.[0]"
      @update:model-value="emit('change', 'observaciones', $event)"
    />
  </div>
</template>

<style scoped>
.client-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
}
.readonly-field {
  display: grid;
  align-content: start;
  gap: var(--space-2);
}
.readonly-field > span {
  font-weight: 600;
}
.readonly-field small {
  color: var(--color-text-secondary);
}
@media (max-width: 47.99rem) {
  .client-fields {
    grid-template-columns: 1fr;
  }
}
</style>
