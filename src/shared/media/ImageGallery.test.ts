import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImageGallery from './ImageGallery.vue'
import { galleryService, type GalleryData, type GalleryImage, type LocalImage } from './gallery'
vi.mock('./pending', () => ({
  loadPending: vi.fn<() => Promise<LocalImage[]>>(async () => []),
  savePending: vi.fn<() => Promise<void>>(async () => {}),
}))
const image = (id: number, principal = false): GalleryImage => ({
  id,
  principal,
  posicion: id - 1,
  nombre: `Foto ${id}`,
  url: `https://example.test/${id}.webp`,
})
function gallery(images: GalleryImage[]): GalleryData {
  return { imagenes: images, limite: 8 }
}
const stubs = {
  Teleport: true,
  GalleryPhoto: { props: ['src', 'alt'], template: '<img :src="src" :alt="alt" />' },
}
describe('Galería reutilizable', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })
  it('sube automáticamente los archivos seleccionados en la variante de muebles', async () => {
    vi.spyOn(galleryService, 'list').mockResolvedValue(gallery([]))
    const upload = vi.spyOn(galleryService, 'upload').mockResolvedValue(gallery([image(1, true)]))
    const wrapper = mount(ImageGallery, {
      props: { endpoint: '/gallery/', streamlined: true },
      global: { stubs },
    })
    await flushPromises()
    Object.defineProperty(wrapper.get('input[type=file]').element, 'files', {
      value: [new File(['red'], 'red.png', { type: 'image/png' })],
    })
    await wrapper.get('input[type=file]').trigger('change')
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    expect(wrapper.text()).not.toContain('Confirmar carga / Reintentar')
    expect(wrapper.find('.drop-zone').exists()).toBe(true)
    wrapper.unmount()
  })
  it('conserva los archivos fallidos y ofrece reintento en la variante de muebles', async () => {
    vi.spyOn(galleryService, 'list').mockResolvedValue(gallery([]))
    const upload = vi
      .spyOn(galleryService, 'upload')
      .mockRejectedValueOnce(new Error('Sin conexión'))
      .mockResolvedValueOnce(gallery([image(1, true)]))
    const wrapper = mount(ImageGallery, {
      props: { endpoint: '/gallery/', streamlined: true },
      global: { stubs },
    })
    await flushPromises()
    Object.defineProperty(wrapper.get('input[type=file]').element, 'files', {
      value: [new File(['red'], 'red.png', { type: 'image/png' })],
    })
    await wrapper.get('input[type=file]').trigger('change')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Sin conexión'))
    expect(wrapper.text()).toContain('Reintentar carga')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Reintentar carga')!
      .trigger('click')
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(2))
    wrapper.unmount()
  })
  it('permite gestionar la imagen seleccionada desde el visor y conserva la selección al reordenar', async () => {
    vi.spyOn(galleryService, 'list').mockResolvedValue(gallery([image(1, true), image(2)]))
    const change = vi
      .spyOn(galleryService, 'change')
      .mockResolvedValueOnce(gallery([image(1), image(2, true)]))
      .mockResolvedValueOnce(gallery([image(2, true), image(1)]))
      .mockResolvedValueOnce(gallery([image(1, true)]))
    const wrapper = mount(ImageGallery, {
      props: { endpoint: '/gallery/', streamlined: true },
      global: { stubs },
    })
    await flushPromises()
    await wrapper.get('[aria-label="Ver Foto 2"]').trigger('click')
    expect(wrapper.find('.viewer-toolbar .viewer-management').exists()).toBe(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Establecer principal'))!
      .trigger('click')
    await flushPromises()
    expect(change).toHaveBeenNthCalledWith(1, '/gallery/', { principal: 2 })
    await wrapper.get('[aria-label="Mover imagen antes"]').trigger('click')
    await flushPromises()
    expect(change).toHaveBeenNthCalledWith(2, '/gallery/', { orden: [2, 1] })
    expect(wrapper.get('.viewer-file strong').text()).toBe('Foto 2')
    await wrapper.get('[aria-label="Eliminar imagen"]').trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Eliminar')!
      .trigger('click')
    await flushPromises()
    expect(change).toHaveBeenNthCalledWith(3, '/gallery/', { eliminar: 2 })
    wrapper.unmount()
  })
  it('no ofrece acciones de gestión cuando la galería es de solo lectura', async () => {
    vi.spyOn(galleryService, 'list').mockResolvedValue(gallery([image(1, true)]))
    const wrapper = mount(ImageGallery, {
      props: { endpoint: '/gallery/', streamlined: true, editable: false },
      global: { stubs },
    })
    await flushPromises()
    await wrapper.get('.hero').trigger('click')
    expect(wrapper.find('.viewer-management').exists()).toBe(false)
    expect(wrapper.find('.drop-zone').exists()).toBe(false)
    wrapper.unmount()
  })
  it('interrumpe la cola anterior si cambia la galería durante una carga', async () => {
    vi.spyOn(galleryService, 'list').mockImplementation(async (path) =>
      path === '/new/' ? gallery([image(9, true)]) : gallery([]),
    )
    let finish!: (value: GalleryData) => void
    const upload = vi.spyOn(galleryService, 'upload').mockImplementation(
      () =>
        new Promise<GalleryData>((resolve) => {
          finish = resolve
        }),
    )
    const wrapper = mount(ImageGallery, {
      props: { endpoint: '/old/', streamlined: true },
      global: { stubs },
    })
    await flushPromises()
    Object.defineProperty(wrapper.get('input[type=file]').element, 'files', {
      value: [
        new File(['red'], 'red.png', { type: 'image/png' }),
        new File(['blue'], 'blue.png', { type: 'image/png' }),
      ],
    })
    await wrapper.get('input[type=file]').trigger('change')
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    await wrapper.setProps({ endpoint: '/new/' })
    await flushPromises()
    finish(gallery([image(1, true)]))
    await flushPromises()
    expect(upload).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.hero img').attributes('alt')).toBe('Foto 9')
    wrapper.unmount()
  })
  it('acepta imágenes arrastradas y las carga automáticamente', async () => {
    vi.spyOn(galleryService, 'list').mockResolvedValue(gallery([]))
    const upload = vi.spyOn(galleryService, 'upload').mockResolvedValue(gallery([image(1, true)]))
    const wrapper = mount(ImageGallery, {
      props: { endpoint: '/gallery/', streamlined: true },
      global: { stubs },
    })
    await flushPromises()
    await wrapper.get('.drop-zone').trigger('drop', {
      dataTransfer: { files: [new File(['red'], 'red.png', { type: 'image/png' })] },
    })
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    wrapper.unmount()
  })
  it('cambia portada y orden sin volver a subir archivos', async () => {
    vi.spyOn(galleryService, 'list').mockResolvedValue(gallery([image(1, true), image(2)]))
    const change = vi
      .spyOn(galleryService, 'change')
      .mockResolvedValue(gallery([image(1), image(2, true)]))
    const upload = vi.spyOn(galleryService, 'upload')
    const wrapper = mount(ImageGallery, { props: { endpoint: '/gallery/' }, global: { stubs } })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Gestionar imágenes')!
      .trigger('click')
    const second = wrapper.findAll('article')[1]!
    await second
      .findAll('button')
      .find((b) => b.text() === 'Establecer principal')!
      .trigger('click')
    await flushPromises()
    expect(change).toHaveBeenLastCalledWith('/gallery/', { principal: 2 })
    await second.get('[aria-label="Mover antes"]').trigger('click')
    await flushPromises()
    expect(change).toHaveBeenLastCalledWith('/gallery/', { orden: [2, 1] })
    expect(upload).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('conserva las cargas fallidas y reintenta sólo los archivos pendientes', async () => {
    vi.spyOn(galleryService, 'list').mockResolvedValue(gallery([]))
    const upload = vi
      .spyOn(galleryService, 'upload')
      .mockResolvedValueOnce(gallery([image(1, true)]))
      .mockRejectedValueOnce(new Error('Error parcial'))
      .mockResolvedValueOnce(gallery([image(1, true), image(2)]))
    const wrapper = mount(ImageGallery, { props: { endpoint: '/gallery/' }, global: { stubs } })
    await flushPromises()
    const files = [
      new File(['red'], 'red.png', { type: 'image/png' }),
      new File(['blue'], 'blue.png', { type: 'image/png' }),
    ]
    Object.defineProperty(wrapper.get('input[type=file]').element, 'files', { value: files })
    await wrapper.get('input[type=file]').trigger('change')
    await vi.waitFor(() => expect(wrapper.text()).toContain('2/8'))
    expect(await wrapper.vm.flush()).toBe(false)
    expect(wrapper.text()).toContain('Error parcial')
    expect(await wrapper.vm.flush()).toBe(true)
    expect(upload.mock.calls.map((c) => c[1].name)).toEqual(['red.png', 'blue.png', 'blue.png'])
    expect(wrapper.vm.count).toBe(2)
    wrapper.unmount()
  })
  it('reordena pendientes localmente y no cruza el límite con las imágenes persistidas', async () => {
    vi.spyOn(galleryService, 'list').mockResolvedValue(gallery([image(1, true)]))
    const change = vi.spyOn(galleryService, 'change')
    const wrapper = mount(ImageGallery, { props: { endpoint: '/gallery/' }, global: { stubs } })
    await flushPromises()
    const files = [
      new File(['red'], 'first.png', { type: 'image/png' }),
      new File(['blue'], 'second.png', { type: 'image/png' }),
    ]
    Object.defineProperty(wrapper.get('input[type=file]').element, 'files', { value: files })
    await wrapper.get('input[type=file]').trigger('change')
    await vi.waitFor(() => expect(wrapper.text()).toContain('3/8'))
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Gestionar imágenes')!
      .trigger('click')
    const pendingFirst = wrapper.findAll('article')[1]!
    expect(pendingFirst.get('[aria-label="Mover antes"]').attributes('disabled')).toBeDefined()
    await wrapper.findAll('article')[2]!.get('[aria-label="Mover antes"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('article').map((a) => a.get('p').text())).toEqual([
      'Foto 1',
      'second.png',
      'first.png',
    ])
    expect(change).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('rechaza archivos grandes y formatos no admitidos antes de subir', async () => {
    vi.spyOn(galleryService, 'list').mockResolvedValue(gallery([]))
    const upload = vi.spyOn(galleryService, 'upload')
    const wrapper = mount(ImageGallery, { props: { endpoint: '/gallery/' }, global: { stubs } })
    await flushPromises()
    const file = new File(['<svg/>'], 'invalid.svg', { type: 'image/svg+xml' })
    Object.defineProperty(wrapper.get('input[type=file]').element, 'files', { value: [file] })
    await wrapper.get('input[type=file]').trigger('change')
    expect(wrapper.get('[role=alert]').text()).toContain('JPEG, PNG o WebP')
    expect(upload).not.toHaveBeenCalled()
    expect(wrapper.vm.count).toBe(0)
    wrapper.unmount()
  })
})
