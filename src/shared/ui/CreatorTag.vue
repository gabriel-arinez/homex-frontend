<script setup lang="ts">
import { UserCheck } from '@lucide/vue'

defineProps<{
  name: string
}>()
</script>

<template>
  <span class="creator-tag" :title="`Responsable: ${name}`">
    <UserCheck :size="13" aria-hidden="true" />
    <span>{{ name }}</span>
  </span>
</template>

<style scoped>
.creator-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.3;
  min-width: 0;
  max-width: 100%;
}

.creator-tag svg {
  flex: none;
  color: var(--color-text-secondary);
}

.creator-tag span {
  overflow-wrap: anywhere;
  white-space: normal;
}
</style>
