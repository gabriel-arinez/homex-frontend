<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Cliente, ValorCatalogoPublico } from '@/generated/api'
import { clientesService, nombreCliente } from '@/modules/clientes/services/clientesService'
import { proformasService } from '../services/proformasService'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Card from '@/shared/ui/Card.vue'
import TextField from '@/shared/ui/TextField.vue'
import Select from '@/shared/ui/Select.vue'
import Button from '@/shared/ui/Button.vue'
import { ApiError } from '@/shared/api'
const emit = defineEmits<{ openMenu: [] }>(),
  router = useRouter(),
  clients = ref<Cliente[]>([]),
  currencies = ref<ValorCatalogoPublico[]>([]),
  saving = ref(false),
  error = ref(''),
  fields = ref<Record<string, string[]>>({}),
  form = ref({
    cliente: '',
    titulo: '',
    moneda_codigo: 'BOB',
    plazo_entrega: '',
    observaciones: '',
  })
onMounted(async () => {
  const [clientResponse, currencyOptions] = await Promise.all([
    clientesService.list({ activo: true, page_size: 100 }),
    proformasService.options('MONEDA'),
  ])
  clients.value = clientResponse.results
  currencies.value = currencyOptions
})
async function save() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  fields.value = {}
  try {
    const p = await proformasService.create({
      cliente: form.value.cliente ? Number(form.value.cliente) : null,
      titulo: form.value.titulo || null,
      moneda_codigo: form.value.moneda_codigo as 'BOB' | 'USD',
      plazo_entrega: form.value.plazo_entrega || null,
      observaciones: form.value.observaciones || null,
    })
    await router.replace(`/proformas/${p.id}`)
  } catch (e) {
    if (e instanceof ApiError) fields.value = e.fields
    error.value = e instanceof Error ? e.message : 'No se pudo crear.'
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <div>
    <PageHeader
      title="Nueva proforma"
      description="Crea el borrador y luego agrega sus líneas."
      show-menu
      @menu="emit('openMenu')"
    /><Card
      ><form :aria-busy="saving" @submit.prevent="save">
        <Select
          v-model="form.cliente"
          name="cliente"
          label="Cliente"
          :options="[
            { label: 'Prospecto sin registrar', value: '' },
            ...clients.map((x) => ({ label: nombreCliente(x), value: String(x.id) })),
          ]"
        /><TextField
          v-model="form.titulo"
          name="titulo"
          label="Título"
          :error="fields.titulo?.[0]"
        /><Select
          v-model="form.moneda_codigo"
          name="moneda"
          label="Moneda"
          :options="
            currencies.map((x) => ({ label: `${x.nombre} (${x.codigo})`, value: x.codigo }))
          "
        /><TextField v-model="form.plazo_entrega" name="plazo" label="Plazo de entrega" /><TextField
          v-model="form.observaciones"
          name="observaciones"
          label="Observaciones"
        />
        <p v-if="error" role="alert">{{ error }}</p>
        <div class="actions">
          <Button type="submit" :processing="saving" processing-label="Creando…"
            >Crear borrador</Button
          ><Button variant="secondary" @click="router.push('/proformas')">Cancelar</Button>
        </div>
      </form></Card
    >
  </div>
</template>
<style scoped>
form {
  display: grid;
  gap: var(--space-4);
  max-width: 42rem;
}
.actions {
  display: flex;
  gap: var(--space-3);
}
@media (max-width: 35rem) {
  .actions {
    display: grid;
  }
}
</style>
