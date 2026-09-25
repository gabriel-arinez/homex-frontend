import { createPinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/app/stores/useSessionStore'
import ClienteDetailView from '@/modules/clientes/views/ClienteDetailView.vue'
import ProductoDetailView from '@/modules/productos/views/ProductoDetailView.vue'
import ActiveFilters from '@/shared/ui/ActiveFilters.vue'
import Button from '@/shared/ui/Button.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import TextField from '@/shared/ui/TextField.vue'
import { server } from '@/tests/msw/server'

function buttonByText(wrapper: VueWrapper, label: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().trim() === label)
  if (!button) throw new Error(`No se encontró el botón "${label}".`)
  return button
}

function dialogButton(label: string) {
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (!dialog) throw new Error('No se encontró el diálogo de confirmación.')
  const button = Array.from(dialog.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === label,
  )
  if (!button) throw new Error(`No se encontró el botón "${label}" en el diálogo.`)
  return button
}

describe('FE03.5 baseline de usabilidad Nielsen', () => {
  it('comunica procesamiento y bloquea una segunda acción', async () => {
    const action = vi.fn<() => void>()
    const wrapper = mount(Button, {
      props: { processing: true, processingLabel: 'Guardando…', onClick: action },
      slots: { default: 'Guardar' },
    })
    expect(wrapper.get('button').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('button').attributes()).toHaveProperty('disabled')
    expect(wrapper.text()).toBe('Guardando…')
    await wrapper.get('button').trigger('click')
    expect(action).not.toHaveBeenCalled()
  })

  it('asocia ayuda o error al campo sin borrar el valor introducido', async () => {
    const wrapper = mount(TextField, {
      props: {
        modelValue: 'dato conservado',
        name: 'nombre',
        label: 'Nombre',
        hint: 'Ayuda breve',
      },
    })
    expect(wrapper.get('input').element.value).toBe('dato conservado')
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('nombre-hint')
    await wrapper.setProps({ error: 'Corrige este campo' })
    expect(wrapper.get('input').element.value).toBe('dato conservado')
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('nombre-error')
  })

  it('hace reconocibles y removibles los filtros activos', async () => {
    const wrapper = mount(ActiveFilters, {
      props: { filters: [{ key: 'search', label: 'Búsqueda: silla' }] },
    })
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('Quitar filtro: Búsqueda: silla')
    await button.trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['search']])
    expect(wrapper.text()).toContain('Filtros activos')
  })

  it('no ejecuta una acción destructiva antes de confirmarla', async () => {
    const confirm = vi.fn<() => void>()
    const wrapper = mount(ConfirmDialog, {
      props: {
        open: true,
        title: 'Descartar cambios',
        description: 'Los cambios no se guardarán.',
        onConfirm: confirm,
      },
      attachTo: document.body,
    })
    expect(confirm).not.toHaveBeenCalled()
    await document.querySelector<HTMLButtonElement>('[role="dialog"] .button--danger')?.click()
    expect(confirm).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('distingue carga de error recuperable', () => {
    const loading = mount(LoadingSkeleton)
    const error = mount(ErrorState, {
      props: { description: 'No se pudo conectar.' },
      slots: { default: '<button>Reintentar</button>' },
    })
    expect(loading.get('[role="status"]').attributes('aria-busy')).toBe('true')
    expect(error.get('[role="alert"]').text()).toContain('Reintentar')
  })

  it('conserva los datos de ClienteDetailView ante 400 y sólo descarta tras confirmar', async () => {
    const client = {
      id: 3,
      tipo_cliente: 1,
      nombres: 'Ana',
      apellidos: 'Pérez',
      empresa: 'HOMEX SRL',
      celular: '70000000',
      direccion: 'La Paz',
      observaciones: 'Cliente frecuente',
      activo: true,
      created_by: 7,
      updated_by: 7,
    }
    server.use(
      http.get('http://localhost:8000/api/v1/clientes/3/', () => HttpResponse.json(client)),
      http.patch('http://localhost:8000/api/v1/clientes/3/', () =>
        HttpResponse.json({ empresa: ['La empresa es obligatoria.'] }, { status: 400 }),
      ),
    )

    const pinia = createPinia()
    useSessionStore(pinia).capabilities = ['comercial.operar']
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/clientes/:id', component: ClienteDetailView }],
    })
    await router.push('/clientes/3')

    const wrapper = mount(ClienteDetailView, {
      global: { plugins: [pinia, router] },
      attachTo: document.body,
    })
    await flushPromises()

    await buttonByText(wrapper, 'Editar').trigger('click')
    const empresa = wrapper.get<HTMLInputElement>('input[name="empresa"]')
    await empresa.setValue('Empresa temporal')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(empresa.element.value).toBe('Empresa temporal')
    expect(wrapper.text()).toContain('La empresa es obligatoria.')

    await buttonByText(wrapper, 'Cancelar').trigger('click')
    dialogButton('Cancelar').click()
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input[name="empresa"]').element.value).toBe(
      'Empresa temporal',
    )

    await buttonByText(wrapper, 'Cancelar').trigger('click')
    dialogButton('Descartar').click()
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)

    await buttonByText(wrapper, 'Editar').trigger('click')
    expect(wrapper.get<HTMLInputElement>('input[name="empresa"]').element.value).toBe('HOMEX SRL')
    wrapper.unmount()
  })

  it('conserva los datos de ProductoDetailView ante 400 y restaura servidor al descartar', async () => {
    const product = {
      id: 4,
      categoria: 1,
      sku: 'S-01',
      nombre: 'Silla ejecutiva',
      precio_lista: '1500.00',
      precio_vigente: '1200.00',
      stock: 8,
      demanda_pendiente: 3,
      disponibilidad_referencial: 5,
      unidad_stock: 1,
      activo: true,
      observaciones: 'Tapiz negro',
      imagen_principal: null,
      created_by: 7,
      updated_by: 7,
    }
    server.use(
      http.get('http://localhost:8000/api/v1/catalogo/productos/4/', () =>
        HttpResponse.json(product),
      ),
      http.patch('http://localhost:8000/api/v1/catalogo/productos/4/', () =>
        HttpResponse.json({ nombre: ['El nombre ya existe.'] }, { status: 400 }),
      ),
    )

    const pinia = createPinia()
    useSessionStore(pinia).capabilities = ['comercial.administrar']
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/productos/:id', component: ProductoDetailView }],
    })
    await router.push('/productos/4')

    const wrapper = mount(ProductoDetailView, {
      global: { plugins: [pinia, router] },
      attachTo: document.body,
    })
    await flushPromises()

    await buttonByText(wrapper, 'Editar datos comerciales').trigger('click')
    const nombre = wrapper.get<HTMLInputElement>('input[name="nombre"]')
    await nombre.setValue('Silla temporal')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(nombre.element.value).toBe('Silla temporal')
    expect(wrapper.text()).toContain('El nombre ya existe.')

    await buttonByText(wrapper, 'Cancelar').trigger('click')
    dialogButton('Cancelar').click()
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input[name="nombre"]').element.value).toBe(
      'Silla temporal',
    )

    await buttonByText(wrapper, 'Cancelar').trigger('click')
    dialogButton('Descartar').click()
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)

    await buttonByText(wrapper, 'Editar datos comerciales').trigger('click')
    expect(wrapper.get<HTMLInputElement>('input[name="nombre"]').element.value).toBe(
      'Silla ejecutiva',
    )
    wrapper.unmount()
  })
})
