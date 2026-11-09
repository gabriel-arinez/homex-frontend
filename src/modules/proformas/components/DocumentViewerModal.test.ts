import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DocumentViewerModal from './DocumentViewerModal.vue'

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn<() => { promise: Promise<{ numPages: number; destroy: () => void }>; destroy: () => void }>(() => ({
    promise: Promise.resolve({ numPages: 2, destroy: vi.fn<() => void>() }),
    destroy: vi.fn<() => void>(),
  })),
  TextLayer: vi.fn<() => void>(),
}))

afterEach(() => { vi.restoreAllMocks() })

const mountViewer = (props: Record<string, unknown>) =>
  mount(DocumentViewerModal, {
    props: { open: true, ...props },
    global: {
      stubs: { Teleport: true, PdfCanvasPage: true },
    },
  })

describe('DocumentViewerModal — PDF.js', () => {
  it('renderiza las páginas PDF directamente y cambia la escala sin ampliar un iframe', async () => {
    const wrapper = mountViewer({
      title: 'Proforma #578',
      subtitle: 'Carta · Borrador',
      pdfUrl: 'blob:http://localhost/proforma-prueba',
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Proforma #578')
    expect(wrapper.find('.doc-page-stack').exists()).toBe(true)
    expect(wrapper.findAll('pdf-canvas-page-stub')).toHaveLength(2)
    expect(wrapper.find('.doc-pdf-frame').exists()).toBe(false)
    await wrapper.find('button.zoom-display').trigger('click')
    expect(wrapper.text()).toContain('100%')
    await wrapper.find('button[aria-label="Aumentar zoom"]').trigger('click')
    expect(wrapper.text()).toContain('110%')
    await wrapper.find('button[aria-label="Cerrar visor de documento"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('no ejecuta window.print ni imprime el formulario HOMEX', async () => {
    const printApplication = vi.spyOn(window, 'print').mockImplementation(() => {})
    const wrapper = mountViewer({ pdfUrl: 'blob:http://localhost/proforma' })
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().includes('Imprimir'))?.trigger('click')
    expect(printApplication).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('presenta errores y permite reintentar', async () => {
    const wrapper = mountViewer({ error: 'Documento no disponible' })
    expect(wrapper.text()).toContain('Documento no disponible')
    expect(wrapper.find('.doc-page-stack').exists()).toBe(false)
    await wrapper.findAll('button').find((button) => button.text().includes('Reintentar'))?.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    wrapper.unmount()
  })
})
