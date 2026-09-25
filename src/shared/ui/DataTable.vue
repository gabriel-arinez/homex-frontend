<script setup lang="ts">
defineProps<{
  caption: string
  columns: Array<{ key: string; label: string }>
  rows: Array<Record<string, unknown>>
}>()
</script>
<template>
  <div class="table-wrap">
    <table>
      <caption class="sr-only">
        {{
          caption
        }}
      </caption>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key" scope="col">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="String(row.id ?? index)">
          <td v-for="column in columns" :key="column.key" :data-label="column.label">
            <slot :name="`cell-${column.key}`" :row="row">{{ row[column.key] }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<style scoped>
.table-wrap {
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 0.875rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}
th {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
tbody tr:last-child td {
  border-bottom: 0;
}
@media (max-width: 47.99rem) {
  thead {
    display: none;
  }
  tbody,
  tr,
  td {
    display: block;
  }
  tr {
    padding: var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }
  td {
    display: grid;
    grid-template-columns: minmax(7rem, 40%) 1fr;
    gap: var(--space-3);
    padding: 0.4rem;
    border: 0;
  }
  td::before {
    color: var(--color-text-secondary);
    font-weight: 600;
    content: attr(data-label);
  }
}
</style>
