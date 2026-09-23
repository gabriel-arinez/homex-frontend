<script setup lang="ts">
import PageHeader from '@/shared/ui/PageHeader.vue'
import Button from '@/shared/ui/Button.vue'
import Card from '@/shared/ui/Card.vue'
import KpiCard from '@/shared/ui/KpiCard.vue'
import StatusBadge from '@/shared/ui/StatusBadge.vue'
defineEmits<{ 'open-menu': [] }>()
</script>
<template>
  <div>
    <PageHeader
      title="Resumen"
      description="Base visual y componentes operativos de HOMEX."
      show-menu
      @menu="$emit('open-menu')"
      ><template #actions><Button>Acción contextual</Button></template></PageHeader
    >
    <section class="kpis" aria-label="Ejemplos de indicadores">
      <KpiCard label="Proformas activas" value="—" detail="Sin datos conectados" /><KpiCard
        label="Pedidos pendientes"
        value="—"
        detail="Sin datos conectados"
      /><KpiCard label="Órdenes de trabajo" value="—" detail="Sin datos conectados" />
    </section>
    <Card
      ><h2>Estados comerciales</h2>
      <div class="badges">
        <StatusBadge status="BORRADOR" /><StatusBadge status="ENVIADA" /><StatusBadge
          status="EN_PRODUCCION"
        /><StatusBadge status="LISTO_ENTREGA" /><StatusBadge status="CANCELADA" /></div
    ></Card>
  </div>
</template>
<style scoped>
.kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
h2 {
  margin-top: 0;
}
@media (max-width: 63.99rem) {
  .kpis {
    grid-template-columns: 1fr;
  }
}
</style>
