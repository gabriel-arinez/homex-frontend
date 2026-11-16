<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Ban, Eye, FileText, MoreHorizontal, Pencil, Plus, RotateCcw } from '@lucide/vue'

const props = defineProps<{
  id: number
  nombre: string
  activo: boolean
  canEdit?: boolean
}>()

const emit = defineEmits<{
  toggleStatus: [id: number, activo: boolean]
}>()

const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const menuPosition = ref({ top: '0px', left: '0px' })
const menuId = `client-actions-${props.id}`

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
  const height = 210
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

function handleToggleStatus() {
  close(false)
  emit('toggleStatus', props.id, props.activo)
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
  <div class="client-actions">
    <button
      ref="trigger"
      type="button"
      class="client-actions__trigger"
      :aria-label="`Acciones de ${nombre}`"
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
        class="client-actions__menu"
        role="menu"
        :aria-label="`Acciones de ${nombre}`"
        :style="menuPosition"
      >
        <RouterLink role="menuitem" :to="`/clientes/${id}`" @click="close(false)">
          <Eye :size="17" aria-hidden="true" />
          Ver detalle
        </RouterLink>

        <RouterLink
          v-if="canEdit"
          role="menuitem"
          class="client-actions__item--edit"
          :to="{ path: `/clientes/${id}`, query: { editar: '1' } }"
          @click="close(false)"
        >
          <Pencil :size="17" aria-hidden="true" />
          Editar cliente
        </RouterLink>

        <RouterLink
          v-if="activo"
          role="menuitem"
          :to="{ path: '/proformas/nueva', query: { cliente: String(id) } }"
          @click="close(false)"
        >
          <Plus :size="17" aria-hidden="true" />
          Nueva proforma
        </RouterLink>

        <RouterLink
          role="menuitem"
          :to="{ path: '/proformas', query: { cliente: String(id) } }"
          @click="close(false)"
        >
          <FileText :size="17" aria-hidden="true" />
          Ver proformas
        </RouterLink>

        <button
          v-if="canEdit"
          type="button"
          role="menuitem"
          class="client-actions__menu-btn"
          :class="{ 'client-actions__menu-btn--danger': activo }"
          @click="handleToggleStatus"
        >
          <RotateCcw v-if="!activo" :size="17" aria-hidden="true" />
          <Ban v-else :size="17" aria-hidden="true" />
          {{ activo ? 'Desactivar cliente' : 'Reactivar cliente' }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.client-actions {
  display: flex;
  justify-content: flex-end;
}
.client-actions__trigger {
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
.client-actions__trigger:hover,
.client-actions__trigger[aria-expanded='true'] {
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}
.client-actions__trigger:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.client-actions__menu {
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
.client-actions__menu a,
.client-actions__menu-btn {
  min-height: 2.75rem;
  display: flex;
  gap: 0.65rem;
  align-items: center;
  padding: 0.7rem 0.75rem;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text);
  text-decoration: none;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  width: 100%;
  text-align: left;
  cursor: pointer;
}
.client-actions__menu a:hover,
.client-actions__menu a:focus-visible,
.client-actions__menu-btn:hover,
.client-actions__menu-btn:focus-visible {
  background: var(--color-surface-hover);
  color: var(--color-primary-accent);
}
.client-actions__menu a:focus-visible,
.client-actions__menu-btn:focus-visible {
  outline: 2px solid var(--color-primary-accent);
}
.client-actions__menu a.client-actions__item--edit {
  color: var(--color-warning);
}
.client-actions__menu a.client-actions__item--edit:hover,
.client-actions__menu a.client-actions__item--edit:focus-visible {
  color: var(--color-warning);
}
.client-actions__menu-btn--danger:hover,
.client-actions__menu-btn--danger:focus-visible {
  color: var(--color-danger);
}
</style>
