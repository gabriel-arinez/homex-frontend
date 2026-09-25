<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { Cliente, PatchedClienteWritable } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { ApiError } from '@/shared/api'
import { clientesService, nombreCliente } from '../services/clientesService'
import Button from '@/shared/ui/Button.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import Card from '@/shared/ui/Card.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import TextField from '@/shared/ui/TextField.vue'
const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const session = useSessionStore()
const client = ref<Cliente | null>(null)
const loading = ref(true)
const error = ref('')
const editing = ref(false)
const saving = ref(false)
const success = ref('')
const confirmCancel = ref(false)
const fields = ref<Record<string, string[]>>({})
const form = reactive({
  nombres: '',
  apellidos: '',
  empresa: '',
  celular: '',
  direccion: '',
  observaciones: '',
  activo: true,
})
const canEdit = computed(() => session.can('comercial.operar'))
function fill(value: Cliente) {
  form.nombres = value.nombres ?? ''
  form.apellidos = value.apellidos ?? ''
  form.empresa = value.empresa ?? ''
  form.celular = value.celular ?? ''
  form.direccion = value.direccion ?? ''
  form.observaciones = value.observaciones ?? ''
  form.activo = value.activo !== false
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    client.value = await clientesService.get(Number(route.params.id))
    fill(client.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar el cliente.'
  } finally {
    loading.value = false
  }
}
async function save() {
  if (!client.value) return
  saving.value = true
  fields.value = {}
  success.value = ''
  const body: PatchedClienteWritable = {
    ...form,
    nombres: form.nombres || null,
    apellidos: form.apellidos || null,
    empresa: form.empresa || null,
    celular: form.celular || null,
    direccion: form.direccion || null,
    observaciones: form.observaciones || null,
  }
  try {
    client.value = await clientesService.update(client.value.id, body)
    fill(client.value)
    editing.value = false
    success.value = 'Cliente actualizado.'
  } catch (cause) {
    if (cause instanceof ApiError) fields.value = cause.fields
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar.'
  } finally {
    saving.value = false
  }
}
function cancelEdit() {
  confirmCancel.value = true
}
function discardEdit() {
  confirmCancel.value = false
  editing.value = false
  if (client.value) fill(client.value)
}
onMounted(load)
</script>
<template>
  <div>
    <PageHeader
      :title="client ? nombreCliente(client) : 'Cliente'"
      description="Información comercial del cliente."
      show-menu
      @menu="emit('openMenu')"
      ><template #actions
        ><Button v-if="client && canEdit && !editing" variant="secondary" @click="editing = true"
          >Editar</Button
        ></template
      ></PageHeader
    ><LoadingSkeleton v-if="loading" :lines="6" /><ErrorState
      v-else-if="error && !client"
      :description="error"
      ><button type="button" @click="load">Reintentar</button></ErrorState
    ><Card v-else-if="client"
      ><p v-if="success" class="success" role="status">{{ success }}</p>
      <form v-if="editing" @submit.prevent="save">
        <div class="form-grid">
          <TextField
            v-model="form.nombres"
            name="nombres"
            label="Nombres"
            :error="fields.nombres?.[0]"
          /><TextField
            v-model="form.apellidos"
            name="apellidos"
            label="Apellidos"
            :error="fields.apellidos?.[0]"
          /><TextField
            v-model="form.empresa"
            name="empresa"
            label="Empresa"
            :error="fields.empresa?.[0]"
          /><TextField
            v-model="form.celular"
            name="celular"
            label="Celular"
            :error="fields.celular?.[0]"
          /><TextField
            v-model="form.direccion"
            name="direccion"
            label="Dirección"
            :error="fields.direccion?.[0]"
          /><TextField
            v-model="form.observaciones"
            name="observaciones"
            label="Observaciones"
            :error="fields.observaciones?.[0]"
          />
        </div>
        <label><input v-model="form.activo" type="checkbox" /> Cliente activo</label>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="actions">
          <Button type="submit" :processing="saving" processing-label="Guardando…">Guardar</Button
          ><Button variant="secondary" :disabled="saving" @click="cancelEdit">Cancelar</Button>
        </div>
      </form>
      <dl v-else>
        <div>
          <dt>Tipo registrado</dt>
          <dd>#{{ client.tipo_cliente }}</dd>
        </div>
        <div>
          <dt>Celular</dt>
          <dd>{{ client.celular || 'No registrado' }}</dd>
        </div>
        <div>
          <dt>Dirección</dt>
          <dd>{{ client.direccion || 'No registrada' }}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{{ client.activo === false ? 'Inactivo' : 'Activo' }}</dd>
        </div>
        <div>
          <dt>Observaciones</dt>
          <dd>{{ client.observaciones || 'Sin observaciones' }}</dd>
        </div>
      </dl></Card
    >
    <ConfirmDialog
      :open="confirmCancel"
      title="Descartar cambios"
      description="Los cambios del cliente no se guardarán."
      confirm-label="Descartar"
      @close="confirmCancel = false"
      @confirm="discardEdit"
    />
  </div>
</template>
<style scoped>
.form-grid,
dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
}
dl div {
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
dt {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
dd {
  margin: 0.25rem 0 0;
}
.actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-5);
}
.success {
  color: var(--color-success);
}
.form-error {
  color: var(--color-danger);
}
@media (max-width: 47.99rem) {
  .form-grid,
  dl {
    grid-template-columns: 1fr;
  }
  .actions {
    display: grid;
  }
}
</style>
