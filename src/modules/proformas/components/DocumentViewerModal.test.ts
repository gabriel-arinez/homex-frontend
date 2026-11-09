import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DocumentViewerModal from './DocumentViewerModal.vue'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DocumentViewerModal (PDF auténtico)', () => {
  it('visualiza el mismo archivo descargable, sin montar la antigua hoja HTML', async () => {
    const wrapper = mount(DocumentViewerModal, {
      props: {
        open: true,
        title: 'Proforma #578',
        subtitle: 'Carta · Borrador',
        pdfUrl: 'blob:http://localhost/proforma-prueba',
      },
      global: { stubs: { Teleport: true } },
    })
    expect(wrapper.text()).toContain('Proforma #578')
    expect(wrapper.text()).toContain('Carta · Borrador')
    expect(wrapper.find('iframe').attributes('src')).toContain('blob:http://localhost/proforma-prueba')
    expect(wrapper.findAll('.product-card')).toHaveLength(0)

    await wrapper.find('button[aria-label="Aumentar zoom"]').trigger('click')
    expect(wrapper.text()).toContain('110%')
    await wrapper.find('button[aria-label="Reducir zoom"]').trigger('click')
    expect(wrapper.text()).toContain('100%')
    await wrapper.find('button[aria-label="Cerrar visor de documento"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('jamás imprime la página principal de HOMEX', async () => {
    const printApp = vi.spyOn(window, 'print').mockImplementation(() => {})
    const wrapper = mount(DocumentViewerModal, {
      props: { open: true, pdfUrl: 'blob:http://localhost/pdf' },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.findAll('button').find((button) => button.text().includes('Imprimir'))?.trigger('click')
    expect(printApp).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('explica el error y permite reintentar, sin activar una impresión alternativa', async () => {
    const wrapper = mount(DocumentViewerModal, {
      props: { open: true, error: 'No disponible' },
      global: { stubs: { Teleport: true } },
    })
    expect(wrapper.text()).toContain('No disponible')
    expect(wrapper.find('iframe').exists()).toBe(false)
    await wrapper.findAll('button').find((button) => button.text().includes('Reintentar'))?.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    wrapper.unmount()
  })
})
