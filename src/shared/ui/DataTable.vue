<script setup lang="ts">
withDefaults(
  defineProps<{
    caption: string
    columns: Array<{ key: string; label: string }>
    rows: Array<Record<string, unknown>>
    variant?: 'institutional' | 'plain'
  }>(),
  {
    variant: 'institutional',
  },
)
</script>
<template>
  <div class="table-wrap" :class="`table-wrap--${variant}`">
    <table :class="`table--${variant}`">
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
  border-left: 0;
  border-right: 0;
}
th {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
tbody tr:last-child td {
  border-bottom: 0;
}

/* Institutional table variant (default for bandejas) */
.table-wrap--institutional {
  border: 1px solid var(--color-table-border);
  border-top: 1px solid var(--color-table-header-bg);
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--color-table-row-odd);
}
.table--institutional {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.table--institutional thead {
  background: var(--color-table-header-bg);
}
.table--institutional th {
  background: var(--color-table-header-bg);
  color: var(--color-table-header-text);
  border-bottom: 1px solid var(--color-table-border);
  border-top: 0;
  border-left: 0;
  border-right: 0;
}
.table--institutional thead th:first-child {
  border-top-left-radius: calc(var(--radius-card) - 1px);
  box-shadow: -1px 0 0 var(--color-table-header-bg);
}
.table--institutional thead th:last-child {
  border-top-right-radius: calc(var(--radius-card) - 1px);
  box-shadow: 1px 0 0 var(--color-table-header-bg);
}
.table--institutional td {
  border-bottom: 1px solid var(--color-table-border);
  border-left: 0;
  border-right: 0;
}
.table--institutional tbody tr:nth-child(odd) {
  background-color: var(--color-table-row-odd);
}
.table--institutional tbody tr:nth-child(even) {
  background-color: var(--color-table-row-even);
}
.table--institutional tbody tr:hover {
  background-color: var(--color-table-row-hover);
}
.table--institutional tbody tr:last-child td {
  border-bottom: 0;
}
.table--institutional tbody tr:last-child td:first-child {
  border-bottom-left-radius: calc(var(--radius-card) - 1px);
}
.table--institutional tbody tr:last-child td:last-child {
  border-bottom-right-radius: calc(var(--radius-card) - 1px);
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
  .table--institutional tr {
    border-bottom: 1px solid var(--color-table-border);
  }
  .table--institutional tbody tr:last-child {
    border-bottom: 0;
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
