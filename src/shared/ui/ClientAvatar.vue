<script setup lang="ts">
import { computed } from 'vue'
import { User } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    name?: string | null
    size?: number
  }>(),
  {
    name: '',
    size: 34,
  },
)

function extractInitials(raw?: string | null): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!trimmed || trimmed === 'Prospecto' || trimmed === '—' || trimmed === '-') return ''

  // Split into words ignoring special punctuation
  const words = trimmed
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return ''
  if (words.length === 1) {
    const word = words[0]!
    return (word.length >= 2 ? word.slice(0, 2) : word).toUpperCase()
  }
  const first = words[0]![0] ?? ''
  const second = words[1]![0] ?? ''
  return (first + second).toUpperCase()
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const initials = computed(() => extractInitials(props.name))
const paletteIndex = computed(() => {
  if (!initials.value || !props.name) return -1
  return hashString(props.name.trim()) % 8
})
</script>

<template>
  <div
    class="client-avatar"
    :class="paletteIndex >= 0 ? `client-avatar--palette-${paletteIndex}` : 'client-avatar--neutral'"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.38)}px` }"
    :aria-label="props.name || 'Cliente sin nombre'"
  >
    <span v-if="initials" class="client-avatar__initials">{{ initials }}</span>
    <User v-else :size="Math.round(size * 0.48)" aria-hidden="true" class="client-avatar__icon" />
  </div>
</template>

<style scoped>
.client-avatar {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 700;
  letter-spacing: 0.02em;
  user-select: none;
  line-height: 1;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 6%);
}

.client-avatar__initials {
  display: block;
  text-transform: uppercase;
}

.client-avatar__icon {
  flex: none;
  opacity: 0.8;
}

/* Palette variants */
.client-avatar--palette-0 {
  background: var(--avatar-0-bg);
  color: var(--avatar-0-text);
}
.client-avatar--palette-1 {
  background: var(--avatar-1-bg);
  color: var(--avatar-1-text);
}
.client-avatar--palette-2 {
  background: var(--avatar-2-bg);
  color: var(--avatar-2-text);
}
.client-avatar--palette-3 {
  background: var(--avatar-3-bg);
  color: var(--avatar-3-text);
}
.client-avatar--palette-4 {
  background: var(--avatar-4-bg);
  color: var(--avatar-4-text);
}
.client-avatar--palette-5 {
  background: var(--avatar-5-bg);
  color: var(--avatar-5-text);
}
.client-avatar--palette-6 {
  background: var(--avatar-6-bg);
  color: var(--avatar-6-text);
}
.client-avatar--palette-7 {
  background: var(--avatar-7-bg);
  color: var(--avatar-7-text);
}
.client-avatar--neutral {
  background: var(--avatar-neutral-bg);
  color: var(--avatar-neutral-text);
}
</style>
