import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '@/shared/api'
import GalleryPhoto from './GalleryPhoto.vue'

vi.mock('@/shared/api', () => ({ apiRequest: vi.fn<() => Promise<unknown>>() }))

describe('GalleryPhoto', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loads private media through the authenticated API instead of exposing a token in the URL', async () => {
    vi.mocked(apiRequest).mockResolvedValue(new Blob(['image']))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:authenticated-image')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const wrapper = mount(GalleryPhoto, {
      props: { src: '/api/v1/imagenes-privadas/abc/content/', alt: 'Mesa' },
    })
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith('/api/v1/imagenes-privadas/abc/content/', {
      responseType: 'blob',
    })
    expect(wrapper.get('img').attributes('src')).toBe('blob:authenticated-image')
    expect(wrapper.html()).not.toContain('Authorization')
  })
})
