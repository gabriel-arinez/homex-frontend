import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { EspecificacionMueble, ValorCatalogoPublico } from '@/generated/api'
import EspecificacionForm from '@/modules/proformas/components/EspecificacionForm.vue'

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
})
