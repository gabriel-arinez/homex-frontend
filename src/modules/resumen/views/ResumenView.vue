<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { FileText, ClipboardList, AudioLines, RefreshCw } from '@lucide/vue'
import type { ConteoEstado } from '../services/resumenService'
import { resumenService } from '../services/resumenService'
import PageHeader from '@/shared/ui/PageHeader.vue'
import KpiCard from '@/shared/ui/KpiCard.vue'
import Card from '@/shared/ui/Card.vue'
import Button from '@/shared/ui/Button.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import { useSessionStore } from '@/app/stores/useSessionStore'
const emit = defineEmits<{ 'open-menu': [] }>(),
  session = useSessionStore(),
  rows = ref<ConteoEstado[]>([]),
  loading = ref(true),
  error = ref('')
const value = (code: string) => {
    const x = rows.value.find((r) => r.estado.codigo === code)
    return x?.conteo == null ? '—' : String(x.conteo)
  },
  failed = computed(() => rows.value.filter((x) => x.error)),
  available = computed(() => rows.value.filter((x) => x.conteo !== null)),
  total = computed(() => available.value.reduce((sum, x) => sum + (x.conteo ?? 0), 0)),
  max = computed(() => Math.max(1, ...available.value.map((x) => x.conteo ?? 0))),
  bars = computed(() =>
    rows.value.map((x) => ({
      ...x,
      width: x.conteo === null ? 0 : Math.max(2, Math.round((x.conteo / max.value) * 100)),
    })),
  )
async function load() {
  loading.value = true
  error.value = ''
  try {
    const states = await resumenService.estados()
    rows.value = await resumenService.distribucion(states)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar el resumen.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
<template>
  <div>
    <PageHeader
      title="Resumen"
      :description="`Vista operativa de ${session.identity?.display_name ?? 'HOMEX'}.`"
      show-menu
      @menu="emit('open-menu')"
      ><template #actions
        ><Button variant="secondary" :disabled="loading" @click="load"
          ><RefreshCw />Actualizar</Button
        ></template
      ></PageHeader
    ><LoadingSkeleton v-if="loading" :lines="8" /><ErrorState v-else-if="error" :description="error"
      ><button @click="load">Reintentar</button></ErrorState
    ><template v-else
      ><section class="kpis" aria-label="Indicadores actuales de proformas">
        <KpiCard
          label="Borradores"
          :value="value('BORRADOR')"
          detail="Proformas editables actuales"
        /><KpiCard
          label="Enviadas"
          :value="value('ENVIADA')"
          detail="Proformas enviadas actuales"
        /><KpiCard
          label="Aprobadas"
          :value="value('APROBADA')"
          detail="Proformas aprobadas actuales"
        />
      </section>
      <p v-if="failed.length" class="partial" role="status">
        {{ failed.length }} indicador{{ failed.length === 1 ? '' : 'es' }} no
        {{ failed.length === 1 ? 'pudo' : 'pudieron' }} actualizarse. Los demás datos siguen
        disponibles.
      </p>
      <div class="layout">
        <Card
          ><h2>Distribución actual de proformas</h2>
          <p class="description">
            Cantidad de proformas visibles para tu cuenta, agrupadas por estado en este momento. No
            representa un período histórico.
          </p>
          <EmptyState
            v-if="!available.length"
            title="Sin métricas disponibles"
            description="No fue posible obtener los conteos por estado."
          /><template v-else
            ><div class="bars" aria-hidden="true">
              <div v-for="row in bars" :key="row.estado.codigo" class="bar-row">
                <span>{{ row.estado.nombre }}</span>
                <div><i :style="{ width: `${row.width}%` }"></i></div>
                <strong>{{ row.conteo ?? '—' }}</strong>
              </div>
            </div>
            <table>
              <caption>
                Conteos actuales de proformas por estado
              </caption>
              <thead>
                <tr>
                  <th scope="col">Estado</th>
                  <th scope="col">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.estado.codigo">
                  <th scope="row">{{ row.estado.nombre }}</th>
                  <td>{{ row.conteo ?? 'No disponible' }}</td>
                </tr>
                <tr>
                  <th scope="row">Total consultado</th>
                  <td>{{ total }}</td>
                </tr>
              </tbody>
            </table></template
          ></Card
        ><Card
          ><h2>Accesos operativos</h2>
          <nav aria-label="Accesos desde el resumen">
            <RouterLink to="/proformas"><FileText />Revisar proformas</RouterLink
            ><RouterLink to="/pedidos"><ClipboardList />Consultar pedidos</RouterLink
            ><RouterLink to="/capturas"><AudioLines />Nueva captura asistida</RouterLink>
          </nav>
          <p class="description">
            Los módulos y datos visibles respetan las capacidades y el alcance que aplica el backend
            a tu cuenta.
          </p></Card
        >
      </div></template
    >
  </div>
</template>
<style scoped>
.kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(17rem, 0.7fr);
  gap: var(--space-5);
  align-items: start;
}
.description {
  color: var(--color-text-secondary);
}
.partial {
  padding: var(--space-3);
  border-radius: var(--radius-control);
  background: var(--color-warning-soft);
}
h2 {
  margin-top: 0;
}
.bars {
  display: grid;
  gap: var(--space-3);
  margin: var(--space-5) 0;
}
.bar-row {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) minmax(8rem, 2fr) 3rem;
  align-items: center;
  gap: var(--space-3);
}
.bar-row > div {
  height: 0.8rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-surface-muted);
}
.bar-row i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
}
table {
  width: 100%;
  border-collapse: collapse;
}
caption {
  text-align: left;
  font-weight: 700;
  margin-bottom: var(--space-2);
}
th,
td {
  padding: 0.6rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}
td {
  text-align: right;
}
nav {
  display: grid;
  gap: var(--space-3);
}
nav a {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem;
  color: var(--color-primary-accent);
  font-weight: 700;
  text-decoration: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
nav svg,
.page-header :deep(svg) {
  width: 1.1rem;
}
@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 700px) {
  .kpis {
    grid-template-columns: 1fr;
  }
  .bar-row {
    grid-template-columns: minmax(6rem, 1fr) minmax(5rem, 1.5fr) 2rem;
    font-size: 0.85rem;
  }
}
</style>
