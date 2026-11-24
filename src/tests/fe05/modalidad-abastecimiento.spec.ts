import { flushPromises, mount } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Producto } from '@/generated/api'
import ProductoVistaRapida from '@/modules/productos/components/ProductoVistaRapida.vue'
import {
  disponibilidadMeta,
  esBajoPedido,
  estadoStockMeta,
} from '@/modules/productos/utils/presentacionCatalogo'
import CatalogoContextual from '@/modules/proformas/components/CatalogoContextual.vue'
import { server } from '@/tests/msw/server'

const pisoBajoPedido = {
  id: 101,
  revision: 'rev-101',
  categoria: 2,
  categoria_info: {
    id: 2,
    concepto_codigo: 'CATEGORIA_PRODUCTO',
    codigo: 'PISO_FLOTANTE',
    nombre: 'Piso flotante',
  },
  sku: 'PISO-BP-01',
  nombre: 'Piso Roble Bajo Pedido',
  precio_lista: '165.00',
  precio_vigente: '165.00',
  modalidad_abastecimiento: 'BAJO_PEDIDO',
  stock: '0.0000',
  stock_minimo: null,
  estado_stock: 'BAJO_PEDIDO',
  demanda_pendiente: '20.0000',
  disponibilidad_referencial: null,
  unidad_stock: 3,
  unidad_stock_info: {
    id: 3,
    concepto_codigo: 'UNIDAD_MEDIDA',
    codigo: 'M2',
    nombre: 'Metro cuadrado',
  },
  activo: true,
  observaciones: null,
  imagen_principal: null,
  silla: null,
  piso: { producto: 101, modelo: 'Roble', espesor_mm: '8.00' },
  promocion: null,
} as unknown as Producto

const sillaSinStock = {
  id: 102,
  revision: 'rev-102',
  categoria: 1,
  categoria_info: {
    id: 1,
    concepto_codigo: 'CATEGORIA_PRODUCTO',
    codigo: 'SILLA',
    nombre: 'Silla',
  },
  sku: 'SILLA-CS-01',
  nombre: 'Silla Sin Stock',
  precio_lista: '500.00',
  precio_vigente: '500.00',
  modalidad_abastecimiento: 'CON_STOCK',
  stock: '0.0000',
  stock_minimo: '2.0000',
  estado_stock: 'SIN_EXISTENCIAS',
  demanda_pendiente: '0.0000',
  disponibilidad_referencial: '0.0000',
  unidad_stock: 1,
  unidad_stock_info: {
    id: 1,
    concepto_codigo: 'UNIDAD_MEDIDA',
    codigo: 'PIEZA',
    nombre: 'Pieza',
  },
  activo: true,
  observaciones: null,
  imagen_principal: null,
  silla: { producto: 102, modelo: 'S-1' },
  piso: null,
  promocion: null,
} as unknown as Producto

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Modalidad de abastecimiento en frontend', () => {
  it('clasifica BAJO_PEDIDO sin mostrar alertas de sin existencias', () => {
    expect(esBajoPedido(pisoBajoPedido)).toBe(true)
    expect(esBajoPedido(sillaSinStock)).toBe(false)

    expect(
      estadoStockMeta(pisoBajoPedido.estado_stock, pisoBajoPedido.modalidad_abastecimiento),
    ).toEqual({
      tone: 'info',
      label: 'Disponible bajo pedido',
      showBadge: true,
    })

    expect(disponibilidadMeta(null, 'BAJO_PEDIDO').label).toBe('Disponible bajo pedido')
    expect(estadoStockMeta('SIN_EXISTENCIAS', 'CON_STOCK').label).toBe('Sin existencias')
  })

  it('ProductoVistaRapida permite cotizar BAJO_PEDIDO con stock cero y cantidades decimales en m2', async () => {
    const wrapper = mount(ProductoVistaRapida, {
      props: {
        open: true,
        product: pisoBajoPedido,
        quoteMode: true,
        actionLabel: 'Agregar a la proforma',
      },
      global: {
        stubs: {
          Modal: {
            props: ['open', 'title'],
            template:
              '<div v-if="open" role="dialog"><h2>{{ title }}</h2><slot/><slot name="footer"/></div>',
          },
          RouterLink: { props: ['to'], template: '<a :href="to"><slot/></a>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Disponible bajo pedido')
    expect(wrapper.text()).not.toContain('Sin existencias')

    const qtyInput = wrapper.find('input[type="number"]')
    await qtyInput.setValue('14.5')
    const selectBtn = wrapper.find('button.context-action')
    expect(selectBtn.exists()).toBe(true)
    await selectBtn.trigger('click')

    const emitted = wrapper.emitted('selectQuote')
    expect(emitted).toBeTruthy()
    expect(emitted![0]![0]).toMatchObject({ cantidad: '14.5' })
  })

  it('CatalogoContextual permite seleccionar piso BAJO_PEDIDO sin stock y bloquea silla CON_STOCK sin stock', async () => {
    server.use(
      http.get('*/api/v1/catalogo/opciones/', () => HttpResponse.json([])),
      http.get('*/api/v1/catalogo/familias/', () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
      http.get('*/api/v1/catalogo/productos/', () =>
        HttpResponse.json({
          count: 2,
          next: null,
          previous: null,
          results: [pisoBajoPedido, sillaSinStock],
        }),
      ),
    )

    const wrapper = mount(CatalogoContextual, {
      props: {
        existingProductIds: [],
        categorias: [
          {
            id: 1,
            concepto_codigo: 'CATEGORIA_PRODUCTO',
            codigo: 'SILLA',
            nombre: 'Silla',
          },
          {
            id: 2,
            concepto_codigo: 'CATEGORIA_PRODUCTO',
            codigo: 'PISO_FLOTANTE',
            nombre: 'Piso flotante',
          },
        ],
        familias: [],
      },
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a :href="to"><slot/></a>' },
        },
      },
    })

    await flushPromises()
    expect(wrapper.text()).toContain('Disponible bajo pedido')

    const pisoInput = wrapper.find('input[aria-label="Cantidad para Piso Roble Bajo Pedido"]')
    await pisoInput.setValue('12.25')
    const cards = wrapper.findAll('article')
    const pisoCard = cards.find((c) => c.text().includes('Piso Roble Bajo Pedido'))
    expect(pisoCard).toBeDefined()
    await pisoCard!.find('.card-select-btn').trigger('click')

    const selected = wrapper.emitted('select')
    expect(selected).toBeTruthy()
    expect((selected![0]![0] as Producto).id).toBe(101)
    expect(selected![0]![1]).toMatchObject({ cantidad: '12.25' })

    const sillaCard = cards.find((c) => c.text().includes('Silla Sin Stock'))
    await sillaCard!.find('.card-select-btn').trigger('click')
    expect(wrapper.emitted('select')?.length).toBe(1)
  })
})
