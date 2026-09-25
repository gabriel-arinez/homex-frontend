import axe from 'axe-core'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppSidebar from '@/app/layouts/AppSidebar.vue'
import { usePreferencesStore } from '@/app/stores/usePreferencesStore'
import Button from '@/shared/ui/Button.vue'
import Modal from '@/shared/ui/Modal.vue'
import TextField from '@/shared/ui/TextField.vue'

const matchMedia = vi
  .fn<(query: string) => { matches: boolean }>()
  .mockReturnValue({ matches: false })
Object.defineProperty(window, 'matchMedia', { value: matchMedia, writable: true })

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
}

describe('design system FE01', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    setActivePinia(createPinia())
  })

  it('persiste tema y sidebar sin guardar información sensible', () => {
    const preferences = usePreferencesStore()
    preferences.toggleTheme()
    preferences.toggleSidebar()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('homex.theme')).toBe('dark')
    expect(localStorage.getItem('homex.sidebar.compact')).toBe('true')
    expect(Object.keys(localStorage)).toEqual(['homex.theme', 'homex.sidebar.compact'])
  })

  it('ofrece nombres accesibles y errores asociados en controles base', async () => {
    const wrapper = mount(
      {
        components: { Button, TextField },
        template:
          '<div><Button>Guardar</Button><TextField name="nombre" label="Nombre" error="Campo requerido" /></div>',
      },
      { attachTo: document.body },
    )
    expect(wrapper.get('button').text()).toBe('Guardar')
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('nombre-error')
    expect(
      (await axe.run(wrapper.element)).violations.filter(
        (item) => item.impact === 'serious' || item.impact === 'critical',
      ),
    ).toEqual([])
  })

  it('cierra el diálogo con Escape y devuelve el foco', async () => {
    const host = document.createElement('button')
    document.body.append(host)
    host.focus()
    const wrapper = mount(Modal, {
      props: { open: false, title: 'Confirmación', onClose: vi.fn<() => void>() },
      attachTo: document.body,
      slots: { default: '<button>Continuar</button>' },
    })
    await wrapper.setProps({ open: true })
    document
      .querySelector<HTMLElement>('[role="dialog"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.setProps({ open: false })
    expect(document.activeElement).toBe(host)
    wrapper.unmount()
    host.remove()
  })

  it('renderiza navegación, tema y usuario sin topbar global', async () => {
    const wrapper = mount(AppSidebar, {
      props: { drawerOpen: true },
      global: { plugins: [createPinia(), router()] },
      attachTo: document.body,
    })
    expect(wrapper.text()).toContain('HOMEX')
    expect(wrapper.text()).toContain('Usuario HOMEX')
    expect(wrapper.text()).not.toContain('Gabriel Arinez')
    expect(wrapper.text()).toContain('Tema oscuro')
    expect(wrapper.text()).not.toContain('Notificaciones')
    expect(wrapper.text()).not.toContain('Nueva proforma')
    expect(
      (await axe.run(wrapper.element)).violations.filter(
        (item) => item.impact === 'serious' || item.impact === 'critical',
      ),
    ).toEqual([])
    expect(wrapper.html()).toMatchSnapshot('drawer abierto expandido')
    await wrapper.get('.compact').trigger('click')
    expect(wrapper.html()).toMatchSnapshot('drawer abierto compacto')
    await wrapper.setProps({ drawerOpen: false })
    expect(wrapper.html()).toMatchSnapshot('drawer cerrado compacto')
  })
})
