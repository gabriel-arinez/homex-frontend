import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  cloneEditorData,
  consumeEditorDraft,
  duplicateLocalLine,
  removeLocalLine,
  restoreLocalLine,
  saveEditorDraft,
} from '@/modules/proformas/services/editorLocal'

describe('AP5 estado local del editor', () => {
  it('preserva y consume una sola vez el borrador contextual completo', () => {
    const draft = {
      currentStep: 2,
      clienteMode: 'nuevo',
      header: { plazo_entrega: '15 días' },
      lineas: [
        { localId: 'a', nombre: 'Silla', precio_unitario: '100.00' },
        {
          localId: 'b',
          nombre: 'Mueble',
          especificacion: {
            datos_tecnicos: { componentes: [{ nombre: 'Mesón', material: 'melamina' }] },
          },
        },
      ],
    }
    saveEditorDraft('token', draft)
    expect(consumeEditorDraft('token')).toEqual(draft)
    expect(consumeEditorDraft('token')).toBeNull()
  })
  it('duplica profundamente un mueble y conserva recuperación íntegra', () => {
    const original = {
      id: 9,
      localId: 'original',
      nombre: 'Escritorio',
      especificacion: {
        datos_tecnicos: { componentes: [{ nombre: 'Mesón', material: 'melamina' }] },
      },
    }
    const copy = duplicateLocalLine(original, 'copia')
    expect(copy.id).toBeUndefined()
    expect(copy.localId).toBe('copia')
    copy.especificacion.datos_tecnicos.componentes[0]!.material = 'madera'
    expect(original.especificacion.datos_tecnicos.componentes[0]!.material).toBe('melamina')
    const removed = removeLocalLine([original, copy], 0)
    expect(removed.lines).toEqual([copy])
    expect(removed.removed).not.toBeNull()
    expect(restoreLocalLine(removed.lines, removed.removed!)).toEqual([original, copy])
  })
})

import { http, HttpResponse } from 'msw'
import { productosService } from '@/modules/productos/services/productosService'
import { server } from '@/tests/msw/server'
import ProductoForm from '@/modules/productos/components/ProductoForm.vue'
import ProductoDetailView from '@/modules/productos/views/ProductoDetailView.vue'
import { useSessionStore } from '@/app/stores/useSessionStore'
import type { Producto } from '@/generated/api'
import DetalleForm from '@/modules/proformas/components/DetalleForm.vue'

describe('AP5 contrato unificado de catálogo', () => {
  it('envía producto y ficha en una sola operación sin incluir stock', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post('http://localhost:8000/api/v1/catalogo/productos/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          {
            id: 81,
            ...body,
            precio_vigente: '125.00',
            stock: '0.0000',
            demanda_pendiente: '0',
            disponibilidad_referencial: '0',
            categoria_info: { id: 1, codigo: 'PISO_FLOTANTE', nombre: 'Piso' },
            unidad_stock_info: { id: 2, codigo: 'M2', nombre: 'Metro cuadrado' },
            familia_info: null,
            imagen_principal: null,
            created_by: 1,
            updated_by: 1,
          },
          { status: 201 },
        )
      }),
    )
    await productosService.create({
      categoria: 1,
      familia: null,
      sku: 'PISO-ROBLE',
      nombre: 'Piso roble',
      precio_lista: '125.00',
      unidad_stock: 2,
      activo: true,
      piso: { modelo: 'Roble', m2_por_caja: '2.2000' },
      promocion: { precio_antes: '125.00', precio_ahora: '110.00', activo: true },
    })
    expect(body).toMatchObject({
      sku: 'PISO-ROBLE',
      unidad_stock: 2,
      piso: { m2_por_caja: '2.2000' },
      promocion: { precio_ahora: '110.00' },
    })
    expect(body).not.toHaveProperty('stock')
  })
})

describe('AP5 regresiones de interfaces reactivas y comerciales', () => {
  it('clona proxies Vue profundamente sin DataCloneError en las tres operaciones', () => {
    const cabecera = reactive({ cliente: '5', observaciones: 'Sin guardar' })
    const linea = reactive({
      id: 8,
      localId: 'original',
      nombre: 'Mueble',
      especificacion: { datos_tecnicos: { componentes: [{ material: 'melamina' }] } },
    })
    const draft = cloneEditorData({ cabecera, lineas: [linea] })
    expect(draft.cabecera).toEqual({ cliente: '5', observaciones: 'Sin guardar' })
    const copy = duplicateLocalLine(linea, 'copy')
    copy.especificacion.datos_tecnicos.componentes[0]!.material = 'madera'
    expect(linea.especificacion.datos_tecnicos.componentes[0]!.material).toBe('melamina')
    const removed = removeLocalLine([linea], 0)
    expect(restoreLocalLine(removed.lines, removed.removed!)[0]).toEqual(linea)
  })

  it('no reactiva una promocion inactiva al editar otro campo del producto', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/catalogo/familias/', () =>
        HttpResponse.json({ count: 0, results: [], next: null, previous: null }),
      ),
      http.get('http://localhost:8000/api/v1/catalogo/opciones/', ({ request }) => {
        const code = new URL(request.url).searchParams.get('concepto')
        return HttpResponse.json(
          code === 'CATEGORIA_PRODUCTO'
            ? [{ id: 3, codigo: 'OTRO', nombre: 'Otro', concepto_codigo: code }]
            : [{ id: 1, codigo: 'PIEZA', nombre: 'Pieza', concepto_codigo: code }],
        )
      }),
    )
    const producto = {
      id: 5,
      categoria: 3,
      unidad_stock: 1,
      nombre: 'Producto existente',
      sku: 'AP5-TEST',
      precio_lista: '100.00',
      activo: true,
      promocion: {
        producto: 5,
        precio_antes: '100.00',
        precio_ahora: '80.00',
        activo: false,
      },
    } as Producto
    const wrapper = mount(ProductoForm, { props: { initial: producto } })
    await flushPromises()
    const activo = wrapper.findAll('input[type="checkbox"]').find((input) =>
      input.element.parentElement?.textContent?.includes('Promoción activa'),
    )
    expect((activo!.element as HTMLInputElement).checked).toBe(false)
    await wrapper.get('input[name="nombre"]').setValue('Producto renombrado')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      nombre: 'Producto renombrado',
      promocion: { activo: false },
    })
    wrapper.unmount()
  })

  it('recarga la ficha al reutilizar el componente para otro producto', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/catalogo/productos/:id/', ({ params }) =>
        HttpResponse.json({
          id: Number(params.id),
          revision: 'a'.repeat(64),
          nombre: `Producto ${params.id}`,
          sku: `SKU-${params.id}`,
          categoria: 3,
          unidad_stock: 1,
          stock: '0.0000',
          demanda_pendiente: '0',
          disponibilidad_referencial: '0',
          precio_vigente: '100.00',
          precio_lista: '100.00',
          activo: true,
          categoria_info: { codigo: 'OTRO', nombre: 'Otros' },
          unidad_stock_info: { codigo: 'PIEZA', nombre: 'Pieza' },
        }),
      ),
    )
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/productos/:id', component: ProductoDetailView }],
    })
    await router.push('/productos/10')
    const wrapper = mount({ template: '<RouterView />' }, {
      global: { plugins: [createPinia(), router] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Producto 10')
    await router.push('/productos/11')
    await flushPromises()
    expect(wrapper.text()).toContain('Producto 11')
    expect(wrapper.text()).not.toContain('Producto 10')
    wrapper.unmount()
  })
  it('conserva cantidad, precio y descuento sin guardar al crear producto contextual', async () => {
    const pinia = createPinia()
    useSessionStore(pinia).capabilities = ['comercial.administrar']
    const props = {
      tipos: [{ id: 1, codigo: 'PRODUCTO', nombre: 'Producto', concepto_codigo: 'TIPO_ITEM' }],
      unidades: [{ id: 2, codigo: 'PIEZA', nombre: 'Pieza', concepto_codigo: 'UNIDAD_MEDIDA' }],
      moneda: 'BOB',
    }
    const form = mount(DetalleForm, { props, global: { plugins: [pinia] } })
    await form.get('input[name="cantidad-linea"]').setValue('7')
    await form.get('input[name="precio-unitario"]').setValue('125.00')
    await form.get('input[name="descuento-linea"]').setValue('12.00')
    const abrir = form.findAll('button').find((x) =>
      x.text().includes('Crear producto sin perder esta proforma'),
    )
    expect(abrir).toBeDefined()
    await abrir!.trigger('click')
    const snapshot = form.emitted('createProduct')?.[0]?.[0] as Record<string, string>
    expect(snapshot).toMatchObject({
      cantidad: '7',
      precio_unitario: '125.00',
      descuento: '12.00',
    })
    form.unmount()
    const restored = mount(DetalleForm, {
      props: { ...props, initialDraft: cloneEditorData(snapshot) },
      global: { plugins: [pinia] },
    })
    expect((restored.get('input[name="cantidad-linea"]').element as HTMLInputElement).value).toBe('7')
    expect((restored.get('input[name="precio-unitario"]').element as HTMLInputElement).value).toBe(
      '125.00',
    )
    restored.unmount()
  })

  it('impide abandonar una ficha con cambios pendientes y respeta el confirmacion', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/catalogo/productos/:id/', ({ params }) =>
        HttpResponse.json({
          id: Number(params.id),
          revision: 'c'.repeat(64),
          nombre: `Producto ${params.id}`,
          sku: `SKU-${params.id}`,
          categoria: 3,
          unidad_stock: 1,
          stock: '0.0000',
          demanda_pendiente: '0',
          disponibilidad_referencial: '0',
          precio_vigente: '100.00',
          precio_lista: '100.00',
          activo: true,
          categoria_info: { codigo: 'OTRO', nombre: 'Otros' },
          unidad_stock_info: { codigo: 'PIEZA', nombre: 'Pieza' },
        }),
      ),
    )
    const pinia = createPinia()
    useSessionStore(pinia).capabilities = ['comercial.administrar']
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/productos/:id', component: ProductoDetailView }],
    })
    await router.push('/productos/10')
    const wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [pinia, router] } })
    await flushPromises()
    const editar = wrapper.findAll('button').find((x) => x.text().includes('Editar datos comerciales'))
    expect(editar).toBeDefined()
    await editar!.trigger('click')
    await wrapper.get('input[name="nombre"]').setValue('Edición pendiente')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await router.push('/productos/11')
    expect(router.currentRoute.value.path).toBe('/productos/10')
    confirm.mockReturnValue(true)
    await router.push('/productos/11')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/productos/11')
    confirm.mockRestore()
    wrapper.unmount()
  })

})
