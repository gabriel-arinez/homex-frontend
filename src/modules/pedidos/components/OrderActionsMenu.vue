<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Ban, Eye, FileText, MoreHorizontal, Receipt, Send } from '@lucide/vue'

const props = defineProps<{
  id: number
  proformaId: number
  estadoCodigo: string
}>()

const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const menuPosition = ref({ top: '0px', left: '0px' })
const menuId = `order-actions-${props.id}`

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
  <div class="order-actions">
    <button
      ref="trigger"
      type="button"
      class="order-actions__trigger"
      :aria-label="`Acciones del pedido #${id}`"
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
        class="order-actions__menu"
        role="menu"
        :aria-label="`Acciones del pedido #${id}`"
        :style="menuPosition"
      >
        <RouterLink role="menuitem" :to="`/pedidos/${id}`" @click="close(false)">
          <Eye :size="17" aria-hidden="true" />
          Ver detalle
        </RouterLink>

        <RouterLink role="menuitem" :to="`/proformas/${proformaId}/editar`" @click="close(false)">
          <FileText :size="17" aria-hidden="true" />
          Ver proforma #{{ proformaId }}
        </RouterLink>

        <RouterLink
          v-if="estadoCodigo === 'CONFIRMADO'"
          role="menuitem"
          :to="{ path: `/pedidos/${id}`, query: { accion: 'recibo' } }"
          @click="close(false)"
        >
          <Receipt :size="17" aria-hidden="true" />
          Emitir recibo
        </RouterLink>

        <RouterLink
          v-if="estadoCodigo === 'LISTO_ENTREGA'"
          role="menuitem"
          :to="{ path: `/pedidos/${id}`, query: { accion: 'nota' } }"
          @click="close(false)"
        >
          <Send :size="17" aria-hidden="true" />
          Emitir nota de entrega
        </RouterLink>

        <RouterLink
          v-if="!['CANCELADO', 'ENTREGADO'].includes(estadoCodigo)"
          role="menuitem"
          class="order-actions__menu-danger"
          :to="{ path: `/pedidos/${id}`, query: { accion: 'cancelar' } }"
          @click="close(false)"
        >
          <Ban :size="17" aria-hidden="true" />
          Cancelar pedido
        </RouterLink>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.order-actions {
  display: flex;
  justify-content: flex-end;
}
.order-actions__trigger {
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
.order-actions__trigger:hover,
.order-actions__trigger[aria-expanded='true'] {
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}
.order-actions__trigger:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.order-actions__menu {
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
.order-actions__menu a {
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
.order-actions__menu a:hover,
.order-actions__menu a:focus-visible {
  background: var(--color-surface-hover);
  color: var(--color-primary-accent);
}
.order-actions__menu a:focus-visible {
  outline: 2px solid var(--color-primary-accent);
}
.order-actions__menu a.order-actions__menu-danger:hover,
.order-actions__menu a.order-actions__menu-danger:focus-visible {
  color: var(--color-danger);
}
</style>
