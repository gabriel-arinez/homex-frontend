<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ClipboardList, MoreHorizontal, Pencil } from '@lucide/vue'

const props = defineProps<{ id: number; numero: number; returnTo?: string }>()
const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const menuPosition = ref({ top: '0px', left: '0px' })
const menuId = `proforma-actions-${props.id}`

function close(restoreFocus = false) {
  if (!open.value) return
  open.value = false
  if (restoreFocus) void nextTick(() => trigger.value?.focus())
}

async function toggle() {
  if (open.value) {
    close(true)
    return
  }
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  const width = 228
  const height = 104
  const top =
    window.innerHeight - rect.bottom >= height + 10
      ? rect.bottom + 6
      : Math.max(8, rect.top - height - 6)
  menuPosition.value = {
    top: `${top}px`,
    left: `${Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))}px`,
  }
  open.value = true
  await nextTick()
  menu.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
}

function outside(event: Event) {
  const target = event.target
  if (!(target instanceof Node)) return
  if (!trigger.value?.contains(target) && !menu.value?.contains(target)) close()
}
function onKey(event: KeyboardEvent) {
  if (!open.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close(true)
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const links = Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    if (!links.length) return
    const index = links.indexOf(document.activeElement as HTMLElement)
    links[(index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length]?.focus()
  }
}
function onFocus(event: FocusEvent) {
  if (!open.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (!trigger.value?.contains(target) && !menu.value?.contains(target)) close()
}
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('focusin', onFocus)
  document.addEventListener('keydown', onKey)
  window.addEventListener('scroll', onScroll)
  window.addEventListener('resize', onScroll)
})
function onScroll() {
  close()
}
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('focusin', onFocus)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div class="proforma-actions">
    <button
      ref="trigger"
      type="button"
      class="proforma-actions__trigger"
      :aria-label="`Acciones de la proforma #${numero}`"
      aria-haspopup="menu"
      :aria-controls="open ? menuId : undefined"
      :aria-expanded="open"
      @click="toggle"
    >
      <MoreHorizontal :size="20" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        :id="menuId"
        ref="menu"
        class="proforma-actions__menu"
        role="menu"
        :aria-label="`Acciones de la proforma #${numero}`"
        :style="menuPosition"
      >
        <RouterLink
          role="menuitem"
          :to="{
            path: `/proformas/${id}/editar`,
            query: props.returnTo ? { returnTo: props.returnTo } : {},
          }"
          @click="close(false)"
        >
          <Pencil :size="17" aria-hidden="true" />
          Continuar edición
        </RouterLink>
        <RouterLink
          role="menuitem"
          :to="{
            path: `/proformas/${id}`,
            query: props.returnTo ? { returnTo: props.returnTo } : {},
          }"
          @click="close(false)"
        >
          <ClipboardList :size="17" aria-hidden="true" />
          Ver resumen y gestión
        </RouterLink>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.proforma-actions {
  display: flex;
  justify-content: flex-end;
}
.proforma-actions__trigger {
  width: 2.75rem;
  height: 2.75rem;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}
.proforma-actions__trigger:hover,
.proforma-actions__trigger[aria-expanded='true'] {
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}
.proforma-actions__trigger:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.proforma-actions__menu {
  position: fixed;
  width: 228px;
  z-index: 1000;
  display: grid;
  gap: 2px;
  padding: 5px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 16px 42px rgb(0 0 0 / 25%);
}
.proforma-actions__menu a {
  min-height: 2.75rem;
  display: flex;
  gap: 0.65rem;
  align-items: center;
  padding: 0.7rem 0.75rem;
  border-radius: var(--radius-control);
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}
.proforma-actions__menu a:hover,
.proforma-actions__menu a:focus-visible {
  background: var(--color-surface-hover);
  color: var(--color-primary-accent);
}
.proforma-actions__menu a:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: -2px;
}
</style>
