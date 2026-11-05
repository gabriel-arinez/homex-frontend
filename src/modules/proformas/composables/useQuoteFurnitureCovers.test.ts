import { afterEach, describe, expect, it, vi } from 'vitest'
import { galleryService, type GalleryImage } from '@/shared/media/gallery'
import { proformasService } from '../services/proformasService'
import { useQuoteFurnitureCovers } from './useQuoteFurnitureCovers'

const photo = (id: number, principal: boolean): GalleryImage => ({
  id,
  nombre: `foto-${id}.webp`,
  url: `/api/v1/imagenes-privadas/${id}/`,
  posicion: id,
  principal,
  variantes: { '320': `/api/v1/imagenes-privadas/${id}/?ancho=320` },
})

afterEach(() => vi.restoreAllMocks())

describe('portada privada de muebles a pedido', () => {
  it('selecciona solo la imagen principal de una galería con varias fotografías', async () => {
    const spy = vi.spyOn(galleryService, 'list').mockResolvedValue({
      limite: 8,
      imagenes: [photo(41, false), photo(42, true)],
    })
    const covers = useQuoteFurnitureCovers()
    const line = { id: 10, producto: null, galeria_id: 'furniture-gallery' }
    await covers.ensureLines([line], 578)
    expect(covers.coverFor(line, 578)?.id).toBe(42)
    expect(covers.coverFor(line, 578)?.url).toBe('/api/v1/imagenes-privadas/42/')
    await covers.ensureLines([line], 578)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('resuelve las fotografías históricas sin galeria_id y respeta su portada', async () => {
    const spy = vi
      .spyOn(proformasService, 'attachments')
      .mockResolvedValue([photo(51, false), photo(52, true)] as Awaited<
        ReturnType<typeof proformasService.attachments>
      >)
    const covers = useQuoteFurnitureCovers()
    const line = { id: 22, producto: null }
    await covers.ensureLines([line], 578)
    expect(covers.coverFor(line, 578)?.id).toBe(52)
    expect(spy).toHaveBeenCalledWith(578, 22)
  })

  it('recupera la portada histórica cuando una galería antigua no puede consultarse', async () => {
    vi.spyOn(galleryService, 'list').mockRejectedValue(new Error('Galería no encontrada'))
    vi.spyOn(proformasService, 'attachments').mockResolvedValue([
      photo(71, false),
      photo(72, true),
    ] as Awaited<ReturnType<typeof proformasService.attachments>>)
    const covers = useQuoteFurnitureCovers()
    const line = { id: 28, producto: null, galeria_id: 'historical-gallery' }
    await covers.ensureLines([line], 578)
    expect(covers.coverFor(line, 578)?.id).toBe(72)
  })

  it('actualiza la miniatura al cambiar la portada sin recargar la proforma', async () => {
    const list = vi.spyOn(galleryService, 'list')
    list
      .mockResolvedValueOnce({ limite: 8, imagenes: [photo(81, true), photo(82, false)] })
      .mockResolvedValueOnce({ limite: 8, imagenes: [photo(81, false), photo(82, true)] })
    const covers = useQuoteFurnitureCovers()
    const line = { id: 40, producto: null, galeria_id: 'updated-gallery' }
    await covers.ensureLines([line], 578)
    expect(covers.coverFor(line, 578)?.id).toBe(81)
    await covers.refreshLine(line, 578)
    expect(covers.coverFor(line, 578)?.id).toBe(82)
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('no solicita galerías privadas cuando la línea es un producto de catálogo', async () => {
    const gallery = vi.spyOn(galleryService, 'list')
    const attachments = vi.spyOn(proformasService, 'attachments')
    const covers = useQuoteFurnitureCovers()
    await covers.ensureLines([{ id: 33, producto: 9, galeria_id: 'not-a-furniture' }], 578)
    expect(gallery).not.toHaveBeenCalled()
    expect(attachments).not.toHaveBeenCalled()
  })
})
