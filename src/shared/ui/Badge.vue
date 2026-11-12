<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
    dot?: boolean
  }>(),
  {
    tone: 'neutral',
    dot: true,
  },
)
</script>

<template>
  <span class="badge" :class="`badge--${tone}`">
    <span v-if="dot" class="badge__dot" aria-hidden="true" />
    <span class="badge__label"><slot /></span>
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.22rem 0.55rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.25;
  white-space: nowrap;
}

.badge__dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.badge__label {
  display: inline-block;
}

.badge--neutral {
  color: var(--badge-neutral-text);
  background: var(--badge-neutral-bg);
}
.badge--neutral .badge__dot {
  background: var(--badge-neutral-dot);
}

.badge--warning {
  color: var(--badge-warning-text);
  background: var(--badge-warning-bg);
}
.badge--warning .badge__dot {
  background: var(--badge-warning-dot);
}

.badge--info {
  color: var(--badge-info-text);
  background: var(--badge-info-bg);
}
.badge--info .badge__dot {
  background: var(--badge-info-dot);
}

.badge--success {
  color: var(--badge-success-text);
  background: var(--badge-success-bg);
}
.badge--success .badge__dot {
  background: var(--badge-success-dot);
}

.badge--danger {
  color: var(--badge-danger-text);
  background: var(--badge-danger-bg);
}
.badge--danger .badge__dot {
  background: var(--badge-danger-dot);
}
</style>
