<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ClipboardList, Download, Eye, MoreHorizontal } from '@lucide/vue'

const props = defineProps<{
  id: number
  numero: number
  pedidoId: number
}>()

const emit = defineEmits<{
  download: [id: number]
}>()

const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const menuPosition = ref({ top: '0px', left: '0px' })
const menuId = `delivery-note-actions-${props.id}`

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
  const width = 232
  const height = 160
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

function handleDownload() {
  close(false)
  emit('download', props.id)
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
    const items = Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    if (!items.length) return
    const index = items.indexOf(document.activeElement as HTMLElement)
    items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }
}

function onFocus(event: FocusEvent) {
  if (!open.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (!trigger.value?.contains(target) && !menu.value?.contains(target)) close()
}

function onScroll() {
  close()
}

onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('focusin', onFocus)
  document.addEventListener('keydown', onKey)
  window.addEventListener('scroll', onScroll)
  window.addEventListener('resize', onScroll)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('focusin', onFocus)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div class="dn-actions">
    <button
      ref="trigger"
      type="button"
      class="dn-actions__trigger"
      :aria-label="`Acciones de la nota de entrega #${numero}`"
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
        class="dn-actions__menu"
        role="menu"
        :aria-label="`Acciones de la nota de entrega #${numero}`"
        :style="menuPosition"
      >
        <RouterLink
          role="menuitem"
          class="dn-actions__item dn-actions__item--info"
          :to="`/notas-entrega/${id}`"
          @click="close(false)"
        >
          <Eye :size="17" aria-hidden="true" />
          Ver detalle
        </RouterLink>

        <button
          type="button"
          role="menuitem"
          class="dn-actions__item dn-actions__item--success"
          @click="handleDownload"
        >
          <Download :size="17" aria-hidden="true" />
          Descargar nota
        </button>

        <RouterLink
          role="menuitem"
          class="dn-actions__item dn-actions__item--info"
          :to="`/pedidos/${pedidoId}`"
          @click="close(false)"
        >
          <ClipboardList :size="17" aria-hidden="true" />
          Ver pedido #{{ pedidoId }}
        </RouterLink>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.dn-actions {
  display: flex;
  justify-content: flex-end;
}
.dn-actions__trigger {
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
.dn-actions__trigger:hover,
.dn-actions__trigger[aria-expanded='true'] {
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}
.dn-actions__trigger:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.dn-actions__menu {
  position: fixed;
  width: 232px;
  z-index: 1000;
  display: grid;
  gap: 2px;
  padding: 5px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 16px 42px rgb(0 0 0 / 25%);
}
.dn-actions__item {
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
.dn-actions__item:hover,
.dn-actions__item:focus-visible {
  background: var(--color-surface-hover);
  color: var(--color-primary-accent);
}
.dn-actions__item:focus-visible {
  outline: 2px solid var(--color-primary-accent);
}
.dn-actions__item--info {
  color: var(--color-info);
}
.dn-actions__item--info:hover,
.dn-actions__item--info:focus-visible {
  background: var(--color-info-soft);
  color: var(--color-info);
}
.dn-actions__item--success {
  color: var(--color-success);
}
.dn-actions__item--success:hover,
.dn-actions__item--success:focus-visible {
  background: var(--color-success-soft);
  color: var(--color-success);
}
</style>
