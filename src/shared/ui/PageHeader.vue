<script setup lang="ts">
import { Menu } from '@lucide/vue'
defineProps<{ title: string; description?: string; showMenu?: boolean }>()
const emit = defineEmits<{ menu: [] }>()
</script>
<template>
  <header class="page-header">
    <div class="page-header__identity">
      <button
        v-if="showMenu"
        class="menu"
        type="button"
        aria-label="Abrir navegación"
        @click="emit('menu')"
      >
        <Menu />
      </button>
      <div>
        <h1>{{ title }}</h1>
        <p v-if="description">{{ description }}</p>
      </div>
    </div>
    <div v-if="$slots.actions" class="page-header__actions"><slot name="actions" /></div>
  </header>
</template>
<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}
.page-header__identity {
  display: flex;
  gap: var(--space-3);
}
.page-header h1 {
  margin: 0;
  font-size: 2rem;
  line-height: 2.5rem;
}
.page-header p {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
}
.menu {
  display: none;
  width: 2.75rem;
  height: 2.75rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.page-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
@media (max-width: 47.99rem) {
  .page-header {
    display: grid;
    margin-bottom: var(--space-6);
  }
  .menu {
    display: grid;
  }
  .page-header__actions,
  .page-header__actions :deep(button) {
    width: 100%;
  }
  .page-header h1 {
    font-size: 1.5rem;
    line-height: 2rem;
  }
}
</style>
