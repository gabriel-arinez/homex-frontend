<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import type { OrdenTrabajo, ValorCatalogoPublico } from '@/generated/api'
import { ordenesTrabajoService } from '../services/ordenesTrabajoService'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Card from '@/shared/ui/Card.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
const emit = defineEmits<{ openMenu: [] }>(),
  id = Number(useRoute().params.id),
  item = ref<OrdenTrabajo | null>(null),
  states = ref<ValorCatalogoPublico[]>([]),
  balances = ref<ValorCatalogoPublico[]>([]),
  loading = ref(true),
  error = ref(''),
  name = (xs: ValorCatalogoPublico[], v: number | null) =>
    xs.find((x) => x.id === v)?.nombre ?? (v ? `Valor ${v}` : 'Sin asignar')
async function load() {
  loading.value = true
  try {
    ;[item.value, states.value, balances.value] = await Promise.all([
      ordenesTrabajoService.get(id),
      ordenesTrabajoService.options('ESTADO_ORDEN_TRABAJO'),
      ordenesTrabajoService.options('ESTADO_SALDO'),
    ])
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar la orden.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
<template>
  <div>
    <PageHeader
      :title="`Orden de trabajo #${item?.numero ?? id}`"
      description="Fabricación o preparación asociada al pedido."
      show-menu
      @menu="emit('openMenu')"
      ><template #actions
        ><RouterLink to="/ordenes-trabajo">Volver</RouterLink></template
      ></PageHeader
    ><LoadingSkeleton v-if="loading" :lines="7" /><ErrorState v-else-if="error" :description="error"
      ><button @click="load">Reintentar</button></ErrorState
    ><template v-else-if="item"
      ><Card
        ><dl>
          <div>
            <dt>Pedido</dt>
            <dd>
              <RouterLink :to="`/pedidos/${item.pedido}`">#{{ item.pedido }}</RouterLink>
            </dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{{ name(states, item.estado) }}</dd>
          </div>
          <div>
            <dt>Saldo</dt>
            <dd>{{ name(balances, item.estado_saldo) }}</dd>
          </div>
          <div>
            <dt>Inicio</dt>
            <dd>{{ item.fecha_inicio ?? 'Pendiente' }}</dd>
          </div>
          <div>
            <dt>Fin</dt>
            <dd>{{ item.fecha_fin ?? 'Pendiente' }}</dd>
          </div>
          <div>
            <dt>Entrega prevista</dt>
            <dd>{{ item.fecha_entrega ?? 'Sin definir' }}</dd>
          </div>
          <div>
            <dt>Lugar</dt>
            <dd>{{ item.lugar_entrega ?? 'Sin definir' }}</dd>
          </div>
        </dl></Card
      ></template
    >
  </div>
</template>
<style scoped>
dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
dl div {
  border-bottom: 1px solid var(--color-border);
  padding: 0.6rem;
}
dt {
  color: var(--color-text-secondary);
}
dd {
  margin: 0.2rem 0;
  font-weight: 700;
}
a {
  color: var(--color-primary-accent);
  font-weight: 700;
}
@media (max-width: 600px) {
  dl {
    grid-template-columns: 1fr;
  }
}
</style>
