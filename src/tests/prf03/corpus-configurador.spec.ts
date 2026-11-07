import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { EspecificacionMueble, ValorCatalogoPublico } from '@/generated/api'
import EspecificacionForm from '@/modules/proformas/components/EspecificacionForm.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'

const opciones = {
  tipos: [{ id: 5, codigo: 'ESCRITORIO', nombre: 'Escritorio' }] as ValorCatalogoPublico[],
  unidades: [{ id: 20, codigo: 'PIEZA', nombre: 'Pieza' }] as ValorCatalogoPublico[],
  moneda: 'BOB' as const,
}
const corpus = [
  {
    nombre: 'Velador',
    datos: {
      caracteristicas_generales: {
        dimensiones: { alto: { valor: '55', unidad: 'cm' }, ancho: { valor: '40', unidad: 'cm' } },
      },
      componentes: [{ uid: 'v-tapa', nombre: 'Tapa', cantidad_interna: 1, material: 'Melamina' }],
      accesorios: ['Jalador'],
    },
  },
  {
    nombre: 'Escritorio en L',
    datos: {
      caracteristicas_generales: {
        dimensiones: {
          lado_1: { valor: '160', unidad: 'cm' },
          lado_2: { valor: '120', unidad: 'cm' },
        },
        atributo_heredado: { formato: 'L' },
      },
      conjuntos: [
        { uid: 'e-1', nombre: 'Ala principal' },
        { uid: 'e-2', nombre: 'Ala secundaria' },
      ],
      componentes: [
        { uid: 'e-a', nombre: 'Tapa principal', conjunto_uid: 'e-1', cantidad_interna: 1 },
        { uid: 'e-b', nombre: 'Tapa lateral', conjunto_uid: 'e-2', cantidad_interna: 1 },
      ],
      accesorios: ['Pasacables'],
    },
  },
  {
    nombre: 'Mesa de reuniones',
    datos: {
      caracteristicas_generales: {
        dimensiones: { diametro: { valor: '1.8', unidad: 'm', tolerancia: '2 mm' } },
      },
      componentes: [
        { uid: 'm-t', nombre: 'Tablero', cantidad_interna: 1 },
        { uid: 'm-p', nombre: 'Patas', cantidad_interna: 4 },
      ],
      accesorios: [],
    },
  },
  {
    nombre: 'Sillones modulares',
    datos: {
      conjuntos: [
        { uid: 's-1', nombre: 'Módulo A' },
        { uid: 's-2', nombre: 'Módulo B' },
      ],
      componentes: [
        { uid: 's-a', nombre: 'Asiento A', conjunto_uid: 's-1', cantidad_interna: 2 },
        { uid: 's-b', nombre: 'Asiento B', conjunto_uid: 's-2', cantidad_interna: 3 },
      ],
      caracteristicas_generales: { tela: 'A elección' },
      accesorios: [],
    },
  },
  {
    nombre: 'Vitrina',
    datos: {
      componentes: [
        {
          uid: 'vi-1',
          nombre: 'Cristal',
          cantidad_interna: 2,
          dimensiones: { alto: 120, ancho: 40 },
          acabado: 'Templado',
        },
      ],
      caracteristicas_generales: { dimensiones: { altura_total: { valor: '1.9', unidad: 'm' } } },
      detalle_no_catalogado: { bisagras: ['izquierda', 'derecha'] },
      accesorios: ['Iluminación'],
    },
  },
]
describe('PRF-03 corpus representativo conservado por el configurador visual', () => {
  it('organiza la revisión con acciones identificables y conserva datos incompletos', () => {
    const wrapper = mount(EspecificacionForm, {
      props: {
        ...opciones,
        studio: true,
        activeSection: 'revision',
        especificacion: {
          tipo_mueble: 5,
          datos_tecnicos: { componentes: [{ uid: 'p1', nombre: 'Tablero', material: 'Melamina' }] },
        } as EspecificacionMueble,
      },
    })
    expect(wrapper.get('#revision').text()).toContain('Cantidad no especificada')
    expect(wrapper.get('#revision').text()).toContain('Melamina')
    expect(wrapper.find('[aria-label="Editar estructura y componentes"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('organiza datos comerciales junto al resumen sin cambiar importes cotizados', () => {
    const wrapper = mount(EspecificacionForm, {
      props: {
        ...opciones,
        studio: true,
        activeSection: 'comercial',
        detalle: {
          nombre: 'Mesa',
          cantidad: '2',
          unidad: 20,
          precio_unitario: '125.50',
          descuento: '10.00',
        },
      },
    })
    expect(wrapper.find('.commercial-layout .commercial-fields').exists()).toBe(true)
    expect(wrapper.get('.commercial-total').text()).toContain('Resumen de cotización')
    expect(wrapper.get('.commercial-total').text()).toContain('241.00 BOB')
    expect((wrapper.get('[name="mueble-precio"]').element as HTMLInputElement).value).toBe('125.50')
    wrapper.unmount()
  })
  it('orienta el apartado de accesorios y observaciones cuando está vacío', () => {
    const wrapper = mount(EspecificacionForm, {
      props: { ...opciones, studio: true, activeSection: 'accesorios' },
    })
    expect(wrapper.get('#accesorios').text()).toContain('Todavía no hay accesorios')
    expect(wrapper.get('.observaciones-heading svg').attributes('aria-hidden')).toBe('true')
    expect(wrapper.find('[name="observaciones-especificacion"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('presenta la pieza seleccionada sin un desplegable nativo sin título', () => {
    const wrapper = mount(EspecificacionForm, {
      props: {
        ...opciones,
        studio: true,
        activeSection: 'estructura',
        especificacion: {
          tipo_mueble: 5,
          datos_tecnicos: { componentes: [{ uid: 'p1', nombre: 'Tablero', cantidad_interna: 2 }] },
        } as EspecificacionMueble,
      },
    })
    expect(wrapper.find('.studio-component-detail > details.card').exists()).toBe(false)
    expect(wrapper.get('.studio-component-detail').text()).toContain('Tablero')
    expect(wrapper.get('[name="componente-0-cantidad"]').attributes('min')).toBe('1')
    wrapper.unmount()
  })
  it('orienta la identificación y las medidas en el estudio sin alterar sus campos', async () => {
    const wrapper = mount(EspecificacionForm, {
      props: { ...opciones, studio: true, activeSection: 'general' },
    })
    expect(wrapper.get('#identificacion h3 svg').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('#dimensiones h3 svg').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('Identifica el mueble con un nombre claro')
    expect(wrapper.text()).toContain('Registra las medidas principales del mueble')
    expect(wrapper.text()).toContain('Sin características generales registradas')
    expect(wrapper.find('#mueble-nombre-comercial').exists()).toBe(true)

    const chipLargo = wrapper.findAll('.quick-chip').find((b) => b.text().includes('Largo'))
    expect(chipLargo).toBeDefined()
    await chipLargo!.trigger('click')
    expect(wrapper.find('input[name="largo"]').exists()).toBe(true)
    await wrapper.get('button[aria-label="Quitar medida largo"]').trigger('click')
    expect(wrapper.find('input[name="largo"]').exists()).toBe(false)
    wrapper.unmount()
  })
  for (const caso of corpus) {
    it(`${caso.nombre}: no altera dimensiones, asociaciones ni JSON desconocido al guardar y reabrir`, async () => {
      const especificacion = {
        id: 7,
        proforma_detalle: 99,
        tipo_mueble: 5,
        datos_tecnicos: caso.datos,
        observaciones: 'A confirmar con el cliente',
      } as unknown as EspecificacionMueble
      const props = {
        ...opciones,
        especificacion,
        detalle: {
          nombre: caso.nombre,
          cantidad: '2',
          unidad: 20,
          precio_unitario: '380.00',
          descuento: '15.00',
        },
      }
      const editor = mount(EspecificacionForm, { props })
      await editor.get('form').trigger('submit')
      const emitido = editor.emitted('save')?.[0]
      expect(emitido).toBeDefined()
      if (!emitido) throw new Error(editor.text())
      const guardado = emitido[0] as { datos_tecnicos: unknown }
      expect(guardado.datos_tecnicos).toEqual(caso.datos)
      expect(emitido[1]).toMatchObject({
        nombre: caso.nombre,
        cantidad: '2',
        unidad: 20,
        precio_unitario: '380.00',
        descuento: '15.00',
      })
      editor.unmount()

      const nuevo = mount(EspecificacionForm, {
        props: {
          ...props,
          especificacion: {
            ...especificacion,
            datos_tecnicos: guardado.datos_tecnicos,
          } as EspecificacionMueble,
        },
      })
      await nuevo.get('form').trigger('submit')
      const reabierto = nuevo.emitted('save')?.[0]?.[0] as { datos_tecnicos: unknown }
      expect(reabierto.datos_tecnicos).toEqual(caso.datos)
      nuevo.unmount()
    })
  }

  it('conserva intactas 41 piezas históricas sin impedir editar el importe comercial', async () => {
    const datos = {
      componentes: Array.from({ length: 41 }, (_, i) => ({
        uid: `legacy-${i}`,
        nombre: `Pieza ${i}`,
        cantidad_interna: 1,
      })),
      origen_externo: { version: 'anterior' },
    }
    const wrapper = mount(EspecificacionForm, {
      props: {
        ...opciones,
        detalle: {
          nombre: 'Legado',
          cantidad: '1',
          unidad: 20,
          precio_unitario: '250.00',
          descuento: '0.00',
        },
        especificacion: { tipo_mueble: 5, datos_tecnicos: datos } as EspecificacionMueble,
      },
    })
    await wrapper.get('#mueble-precio').setValue('275.00')
    await wrapper.get('form').trigger('submit')
    const evento = wrapper.emitted('save')?.[0]
    expect(evento).toBeDefined()
    if (!evento) throw new Error(wrapper.text())
    expect((evento[0] as { datos_tecnicos: unknown }).datos_tecnicos).toEqual(datos)
    expect(evento[1]).toMatchObject({ precio_unitario: '275.00' })
    wrapper.unmount()
  })
  it('exige elegir el destino al quitar un conjunto con piezas y conserva sus UID', async () => {
    const wrapper = mount(EspecificacionForm, {
      props: {
        ...opciones,
        detalle: {
          nombre: 'Sillón',
          cantidad: '1',
          unidad: 20,
          precio_unitario: '300',
          descuento: '0',
        },
        especificacion: {
          tipo_mueble: 5,
          datos_tecnicos: {
            conjuntos: [
              { uid: 'g1', nombre: 'Principal' },
              { uid: 'g2', nombre: 'Alternativo' },
            ],
            componentes: [
              { uid: 'pieza', conjunto_uid: 'g1', nombre: 'Asiento', cantidad_interna: 1 },
            ],
          },
        } as EspecificacionMueble,
      },
    })
    const quitar = wrapper.findAll('button').find((b) => b.text() === 'Quitar conjunto')
    expect(quitar).toBeDefined()
    await quitar!.trigger('click')
    expect(wrapper.text()).toContain('Elige a dónde mover sus componentes')
    await wrapper.get('select[aria-label="Destino de componentes"]').setValue('g2')
    const mover = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Mover componentes y quitar conjunto')
    expect(mover).toBeDefined()
    await mover!.trigger('click')
    await wrapper.get('form').trigger('submit')
    const guardado = wrapper.emitted('save')?.[0]?.[0] as {
      datos_tecnicos: {
        conjuntos: Array<{ uid: string }>
        componentes: Array<{ uid: string; conjunto_uid: string }>
      }
    }
    expect(guardado.datos_tecnicos.conjuntos.map((g) => g.uid)).toEqual(['g2'])
    expect(guardado.datos_tecnicos.componentes).toMatchObject([
      { uid: 'pieza', conjunto_uid: 'g2' },
    ])
    wrapper.unmount()
  })

  it('deshace múltiples accesorios y permite vaciar cantidad interna sin inventar cero', async () => {
    const wrapper = mount(EspecificacionForm, {
      props: {
        ...opciones,
        detalle: {
          nombre: 'Mesa',
          cantidad: '1',
          unidad: 20,
          precio_unitario: '200',
          descuento: '0',
        },
        especificacion: {
          tipo_mueble: 5,
          datos_tecnicos: {
            componentes: [{ uid: 'pie', nombre: 'Pata', cantidad_interna: 4 }],
            accesorios: ['Tapones', 'Guías'],
          },
        } as EspecificacionMueble,
      },
    })
    await wrapper.get('input[name="componente-0-cantidad"]').setValue('')
    const quitarAccesorio = () =>
      wrapper
        .get('#accesorios')
        .findAll('button')
        .find((b) => b.text() === 'Quitar')
    await quitarAccesorio()!.trigger('click')
    await quitarAccesorio()!.trigger('click')
    const deshacer = () =>
      wrapper.findAll('button').find((b) => b.text() === 'Deshacer eliminación de accesorio')
    await deshacer()!.trigger('click')
    await deshacer()!.trigger('click')
    await wrapper.get('form').trigger('submit')
    const guardado = wrapper.emitted('save')?.[0]?.[0] as {
      datos_tecnicos: {
        accesorios: string[]
        componentes: Array<{ cantidad_interna?: number }>
      }
    }
    expect(guardado.datos_tecnicos.accesorios).toEqual(['Tapones', 'Guías'])
    expect(guardado.datos_tecnicos.componentes[0]).not.toHaveProperty('cantidad_interna')
    wrapper.unmount()
  })

  it('duplica profundamente una tarjeta y permite modificarla sin alterar el original', async () => {
    const wrapper = mount(EspecificacionForm, {
      props: {
        ...opciones,
        detalle: {
          nombre: 'Mesa',
          cantidad: '1',
          unidad: 20,
          precio_unitario: '200',
          descuento: '0',
        },
        especificacion: {
          tipo_mueble: 5,
          datos_tecnicos: {
            componentes: [
              {
                uid: 'original',
                nombre: 'Cubierta',
                cantidad_interna: 1,
                material: 'Melamina',
                atributos: [{ nombre: 'Acabado', valor: 'Nogal' }],
              },
            ],
          },
        } as EspecificacionMueble,
      },
    })
    const duplicar = wrapper.findAll('button').find((b) => b.text() === 'Duplicar')
    expect(duplicar).toBeDefined()
    await duplicar!.trigger('click')
    await wrapper.get('#componente-material-1').setValue('Vidrio')
    await wrapper.get('form').trigger('submit')
    const dato = wrapper.emitted('save')?.[0]?.[0] as {
      datos_tecnicos: {
        componentes: Array<{ uid: string; material: string; atributos: unknown[] }>
      }
    }
    expect(dato.datos_tecnicos.componentes).toHaveLength(2)
    expect(dato.datos_tecnicos.componentes[0]).toMatchObject({
      uid: 'original',
      material: 'Melamina',
      atributos: [{ nombre: 'Acabado', valor: 'Nogal' }],
    })
    expect(dato.datos_tecnicos.componentes[1]).toMatchObject({
      material: 'Vidrio',
      atributos: [{ nombre: 'Acabado', valor: 'Nogal' }],
    })
    expect(dato.datos_tecnicos.componentes[1]?.uid).not.toBe('original')
    wrapper.unmount()
  })

  it('propaga un tipo recién creado para que el editor pueda mostrarlo al reabrir la ficha', async () => {
    const crear = vi
      .spyOn(proformasService, 'createFurnitureType')
      .mockResolvedValue({ id: 77, codigo: 'VITRINA_TEST', nombre: 'Vitrina Test' })
    const wrapper = mount(EspecificacionForm, { props: opciones })
    try {
      await wrapper.get('input[name="nuevo-tipo"]').setValue('Vitrina Test')
      const boton = wrapper.findAll('button').find((item) => item.text() === 'Crear tipo')
      expect(boton).toBeDefined()
      await boton!.trigger('click')
      await flushPromises()
      expect(wrapper.emitted('typeCreated')?.[0]?.[0]).toMatchObject({
        id: 77,
        codigo: 'VITRINA_TEST',
        nombre: 'Vitrina Test',
        concepto_codigo: 'TIPO_MUEBLE',
      })
    } finally {
      wrapper.unmount()
      crear.mockRestore()
    }
  })

  it('en modo Studio optimiza Estructura con chips iniciales, resumen real de pieza, acciones directas y conjunto condicional', async () => {
    const wrapper = mount(EspecificacionForm, {
      props: {
        ...opciones,
        studio: true,
        activeSection: 'estructura',
        detalle: {
          nombre: 'Mesa de reunión',
          cantidad: '1',
          unidad: 20,
          precio_unitario: '500',
          descuento: '0',
        },
      },
    })
    try {
      expect(wrapper.find('.studio-group-management--compact').exists()).toBe(true)
      expect(wrapper.find('.studio-component-tree').exists()).toBe(false)
      expect(wrapper.find('.studio-component-layout--empty').exists()).toBe(true)

      const chipTablero = wrapper
        .findAll('.empty-editor__chips .quick-chip')
        .find((b) => b.text().includes('Tablero'))
      expect(chipTablero).toBeDefined()
      await chipTablero!.trigger('click')

      expect(wrapper.find('.studio-component-tree').exists()).toBe(true)
      expect(
        (wrapper.get('input[name="componente-nombre-0"]').element as HTMLInputElement).value,
      ).toBe('Tablero')
      expect(wrapper.find('select[name="componente-0-grupo"]').exists()).toBe(false)
      expect(wrapper.find('.component-actions-menu').exists()).toBe(false)

      await wrapper.get('#componente-material-0').setValue('Melamínico')
      await wrapper.get('#componente-espesor-0').setValue('18 mm')
      expect(wrapper.get('.tree-item__meta').text()).toBe('1 unidad · Melamínico · 18 mm')

      await wrapper.get('input[name="componente-0-cantidad"]').setValue('')
      expect(wrapper.get('.tree-item__meta').text()).toBe('Melamínico · 18 mm')

      const pickerInput = wrapper.get('#buscar-atributo-componente-0')
      await pickerInput.trigger('focus')
      await pickerInput.setValue('Tapacanto PVC')
      const crearAtributo = wrapper
        .findAll('.mueble-picker__create')
        .find((b) => b.text().includes('Tapacanto PVC'))
      expect(crearAtributo).toBeDefined()
      await crearAtributo!.trigger('click')
      expect(wrapper.find('input[name="atributo-0-0"]').exists()).toBe(true)

      const btnConjunto = wrapper
        .findAll('button')
        .find((b) => b.text().includes('Añadir conjunto'))
      await btnConjunto!.trigger('click')
      expect(wrapper.find('.studio-group-management--compact').exists()).toBe(false)
      expect(wrapper.find('select[name="componente-0-grupo"]').exists()).toBe(true)

      const btnDuplicar = wrapper
        .findAll('.component-direct-actions .component-tool-btn')
        .find((b) => b.text().includes('Duplicar'))
      expect(btnDuplicar).toBeDefined()
      await btnDuplicar!.trigger('click')
      expect(wrapper.findAll('.tree-item')).toHaveLength(2)

      const btnsQuitar = wrapper.findAll('button[aria-label="Quitar componente Tablero"]')
      expect(btnsQuitar).toHaveLength(2)
      await btnsQuitar[1]!.trigger('click')
      expect(wrapper.findAll('.tree-item')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })
})
