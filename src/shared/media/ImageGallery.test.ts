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
