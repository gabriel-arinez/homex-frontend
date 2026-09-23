<script setup lang="ts">
import { nextTick, ref } from 'vue'

const props = defineProps<{
  text: string
  disabled?: boolean
  block?: boolean
}>()

const trigger = ref<HTMLElement | null>(null)
const visible = ref(false)
const top = ref(0)
const left = ref(0)

async function show() {
  if (props.disabled) return

  visible.value = true
  await nextTick()

  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return

  top.value = rect.top + rect.height / 2
  left.value = rect.right + 8
}

function hide() {
  visible.value = false
}
</script>

<template>
  <span
    ref="trigger"
    class="tooltip"
    :class="{ 'tooltip--block': block }"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
  </span>

  <Teleport to="body">
    <span
      v-if="visible && !disabled"
      class="tooltip__content"
      role="tooltip"
      :style="{
        top: `${top}px`,
        left: `${left}px`,
      }"
    >
      {{ text }}
    </span>
  </Teleport>
</template>

<style scoped>
.tooltip {
  position: relative;
  display: inline-flex;
}

.tooltip--block {
  display: block;
}

.tooltip__content {
  position: fixed;
  z-index: 200;
  width: max-content;
  max-width: 14rem;
  padding: 0.4rem 0.55rem;
  color: var(--color-surface);
  border-radius: 0.375rem;
  background: var(--color-text);
  pointer-events: none;
  transform: translateY(-50%);
}
</style>
