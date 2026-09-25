<template>
  <section class="filter-bar" aria-label="Filtros">
    <div class="filter-bar__fields"><slot /></div>
    <div class="filter-bar__actions"><slot name="actions" /></div>
  </section>
</template>
<style scoped>
.filter-bar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.filter-bar__fields,
.filter-bar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
@media (max-width: 47.99rem) {
  .filter-bar,
  .filter-bar__fields,
  .filter-bar__actions {
    display: grid;
    width: 100%;
  }
}
</style>
