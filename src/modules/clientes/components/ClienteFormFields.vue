<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Building2, UserRound } from '@lucide/vue'
import type { ValorCatalogoPublico } from '@/generated/api'
import {
  CLIENT_LIMITS,
  validateClientField,
  type ClientData,
} from '@/shared/validation/commercialFields'
import TextField from '@/shared/ui/TextField.vue'
import TextAreaField from '@/shared/ui/TextAreaField.vue'

export type ClienteFormModel = ClientData & { tipo_cliente: string }

const props = defineProps<{
  model: ClienteFormModel
  tipos: ValorCatalogoPublico[]
  errors?: Record<string, string[]>
  typeReadonly?: boolean
  prefix?: string
  validate?: boolean
  original?: Partial<Record<keyof ClientData, string | null | undefined>>
}>()
const emit = defineEmits<{ change: [field: keyof ClienteFormModel, value: string] }>()

const prefix = computed(() => (props.prefix ? props.prefix + '-' : ''))
const selectedType = computed(() =>
  props.tipos.filter(Boolean).find((type) => String(type.id) === props.model.tipo_cliente),
)
const isCompany = computed(() => selectedType.value?.codigo === 'EMPRESA')
const touched = reactive<Record<string, boolean>>({})
function errorFor(field: keyof ClientData) {
  return (
    props.errors?.[field]?.[0] ||
    (touched[field] || props.validate
      ? validateClientField(field, props.model[field], isCompany.value, props.original?.[field])
      : '')
  )
}
function changeType(value: string) {
  emit('change', 'tipo_cliente', value)
}
</script>

<template>
  <div class="client-fields">
    <div v-if="typeReadonly" class="readonly-field client-fields__full">
      <span class="readonly-field__icon" aria-hidden="true">
        <Building2 v-if="isCompany" :size="20" />
        <UserRound v-else :size="20" />
      </span>
      <div class="readonly-field__copy">
        <span class="readonly-field__label">Tipo de cliente</span>
        <strong>{{ selectedType?.nombre ?? 'Tipo no disponible' }}</strong>
        <small>El tipo se conserva para proteger su identidad comercial.</small>
      </div>
    </div>
    <fieldset v-else class="client-type client-fields__full">
      <legend>Tipo de cliente</legend>
      <div class="client-type__options">
        <label
          v-for="type in tipos.filter((item) => ['PERSONA', 'EMPRESA'].includes(item.codigo))"
          :key="type.id"
          class="client-type__option"
          :class="{ 'client-type__option--active': model.tipo_cliente === String(type.id) }"
        >
          <input
            type="radio"
            :name="prefix + 'tipo-cliente'"
            :value="String(type.id)"
            :checked="model.tipo_cliente === String(type.id)"
            @change="changeType(String(type.id))"
          />
          <span class="client-type__icon" aria-hidden="true">
            <UserRound v-if="type.codigo === 'PERSONA'" :size="18" />
            <Building2 v-else :size="18" />
          </span>
          <span class="client-type__copy">
            <strong>{{ type.codigo === 'PERSONA' ? 'Persona natural' : 'Empresa' }}</strong>
            <small>{{
              type.codigo === 'PERSONA' ? 'Datos personales' : 'Razón social y contacto'
            }}</small>
          </span>
        </label>
      </div>
      <small
        v-if="errors?.tipo_cliente?.[0] || (validate && !model.tipo_cliente)"
        class="client-type__error"
        role="alert"
        >{{ errors?.tipo_cliente?.[0] || 'Selecciona el tipo de cliente.' }}</small
      >
    </fieldset>
    <div v-if="isCompany" class="client-fields__full">
      <TextField
        :model-value="model.empresa"
        :name="prefix + 'empresa'"
        label="Razón social o empresa"
        autocomplete="organization"
        :max-length="CLIENT_LIMITS.empresa"
        :error="errorFor('empresa')"
        hint="Se permiten números y símbolos. Máximo 100 caracteres."
        @blur="touched.empresa = true"
        @update:model-value="emit('change', 'empresa', $event)"
      />
    </div>
    <TextField
      :model-value="model.nombres"
      :name="prefix + 'nombres'"
      :label="isCompany ? 'Nombres del contacto' : 'Nombres'"
      autocomplete="given-name"
      input-rule="name"
      :max-length="CLIENT_LIMITS.nombres"
      :error="errorFor('nombres')"
      hint="Solo letras y nombres compuestos. Máximo 25 caracteres."
      @blur="touched.nombres = true"
      @update:model-value="emit('change', 'nombres', $event)"
    />
    <TextField
      :model-value="model.apellidos"
      :name="prefix + 'apellidos'"
      :label="isCompany ? 'Apellidos del contacto' : 'Apellidos'"
      autocomplete="family-name"
      input-rule="name"
      :max-length="CLIENT_LIMITS.apellidos"
      :error="errorFor('apellidos')"
      hint="Tildes, apóstrofes y guiones permitidos. Máximo 50 caracteres."
      @blur="touched.apellidos = true"
      @update:model-value="emit('change', 'apellidos', $event)"
    />
    <TextField
      :model-value="model.celular"
      :name="prefix + 'celular'"
      label="Celular"
      type="tel"
      autocomplete="tel"
      input-mode="numeric"
      input-rule="digits"
      :max-length="CLIENT_LIMITS.celular"
      :error="errorFor('celular')"
      hint="Opcional; si se registra, debe tener 8 dígitos."
      @blur="touched.celular = true"
      @update:model-value="emit('change', 'celular', $event)"
    />
    <TextField
      :model-value="model.direccion"
      :name="prefix + 'direccion'"
      label="Dirección"
      autocomplete="street-address"
      :max-length="CLIENT_LIMITS.direccion"
      :error="errorFor('direccion')"
      hint="Máximo 100 caracteres."
      @blur="touched.direccion = true"
      @update:model-value="emit('change', 'direccion', $event)"
    />
    <TextAreaField
      class="client-fields__full"
      :model-value="model.observaciones"
      :name="prefix + 'observaciones'"
      label="Observaciones"
      placeholder="Añade información adicional que pueda ser útil en futuras cotizaciones..."
      :rows="4"
      :max-length="CLIENT_LIMITS.observaciones"
      :error="errorFor('observaciones')"
      hint="Campo opcional."
      @blur="touched.observaciones = true"
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
.client-fields__full {
  grid-column: 1 / -1;
}
.client-type {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.client-type__error {
  display: block;
  margin-top: var(--space-2);
  color: var(--color-danger);
}
.client-type legend {
  margin-bottom: var(--space-2);
  font-weight: 600;
}
.client-type__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.client-type__option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
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
.client-type__option:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}
.client-type__option:focus-within {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.client-type__option--active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 45%, var(--color-surface));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.client-type__icon {
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
.client-type__option--active .client-type__icon {
  background: var(--color-primary-soft);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
  color: var(--color-primary-accent);
}
.client-type__option input {
  margin: 0;
  flex-shrink: 0;
  accent-color: var(--color-primary);
}
.client-type__copy {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}
.client-type__option strong {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
}
.client-type__option small {
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  font-weight: 400;
  line-height: 1.35;
}
.readonly-field {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}
.readonly-field__icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.5rem;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-primary-accent);
}
.readonly-field__copy {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}
.readonly-field__label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}
.readonly-field__copy strong {
  font-size: 0.95rem;
  font-weight: 650;
  color: var(--color-text);
}
.readonly-field__copy small {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
@media (max-width: 47.99rem) {
  .client-fields,
  .client-type__options {
    grid-template-columns: 1fr;
  }
}
</style>
