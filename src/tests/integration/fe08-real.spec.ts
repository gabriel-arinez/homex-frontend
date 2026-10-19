import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function login(page: Page) {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  await page.goto('/login')
  await page.getByLabel('Usuario').fill('fe08-admin')
  await page.getByLabel('Contraseña').fill('fe08-integration-only')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/resumen$/)
  await expect(page.getByText('Integración FE08', { exact: true })).toBeVisible()
  return consoleErrors
}

async function createDraft(page: Page, title: string) {
  await page.goto('/proformas/nueva')
  await page.getByRole('button', { name: /Cliente$/ }).click()
  await expect(page.locator('#cliente-proforma option')).toContainText(['Cliente Integración FE08'])
  await page.locator('#cliente-proforma').selectOption({ label: 'Cliente Integración FE08' })
  await page.getByRole('button', { name: /Condiciones$/ }).click()
  await page.getByLabel('Título').fill(title)
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(page).toHaveURL(/\/proformas\/\d+\/editar$/)
  const segments = new URL(page.url()).pathname.split('/').filter(Boolean)
  return Number(segments[segments.length - 2])
}

async function addCatalogLine(page: Page) {
  await page.getByRole('button', { name: /Productos$/ }).click()
  await page.getByRole('button', { name: 'Añadir ítem' }).click()
  await page.getByRole('button', { name: 'Producto de catálogo' }).click()
  await expect(page.getByText('FE08-SILLA-001')).toBeVisible()
  await page.getByRole('button', { name: 'Seleccionar para cotizar' }).click()
  await page.getByLabel('Cantidad', { exact: true }).fill('1')
  await expect(page.locator('#unidad-linea')).toBeDisabled()
  await expect(page.locator('#unidad-linea option:checked')).toHaveText('Pieza')
  await page.getByRole('button', { name: 'Guardar línea' }).click()
  // Verificar la línea incorporada, no la tarjeta del catálogo oculto con v-show.
  await expect(
    page.locator('.line-card').getByText('Silla integración FE08', { exact: true }),
  ).toBeVisible()
}

async function approveCurrentQuote(page: Page) {
  await page.getByRole('button', { name: 'Emitir proforma' }).click()
  await expect(page.getByText('En revisión', { exact: true })).toBeVisible()
  const segments = new URL(page.url()).pathname.split('/').filter(Boolean)
  const proformaId = Number(segments[segments.length - 2])
  await page.goto(`/proformas/${proformaId}`)
  await expect(page.getByRole('button', { name: 'Aprobar' })).toBeVisible()
  await page.getByRole('button', { name: 'Aprobar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click()
  const status = page.getByRole('status').filter({ hasText: /Pedido #\d+/ })
  await expect(status).toBeVisible()
  const text = (await status.textContent()) ?? ''
  const id = Number(text.match(/Pedido #(\d+)/)?.[1])
  expect(id).toBeGreaterThan(0)
  return id
}

async function createApprovedOrder(page: Page, title: string) {
  await createDraft(page, title)
  await addCatalogLine(page)
  return approveCurrentQuote(page)
}

test.describe.serial('FE08 backend real', () => {
  test('recorrido comercial completo, bloqueos, anulación y cancelación', async ({ page }) => {
    const consoleErrors = await login(page)

    await page.goto('/clientes')
    await expect(page.getByText('Cliente Integración FE08', { exact: true })).toBeVisible()
    await page.goto('/productos')
    await expect(page.getByText('Silla integración FE08', { exact: true }).first()).toBeVisible()

    const pedidoId = await createApprovedOrder(page, 'Flujo comercial FE08')

    await page.goto('/movimientos-stock')
    await expect(page.getByText('Silla integración FE08', { exact: true }).first()).toBeVisible()
    await expect(
      page
        .getByRole('table')
        .getByText(/Salida por venta asociada/)
        .first(),
    ).toBeVisible()

    await page.goto('/ordenes-trabajo')
    await expect(page.getByText('Pendiente', { exact: true }).first()).toBeVisible()

    await page.goto(`/pedidos/${pedidoId}`)
    await page.getByRole('button', { name: 'Emitir recibo' }).click()
    await page.getByLabel('Nombre completo').fill('Cliente Integración FE08')
    await page.getByLabel('Monto en letras').fill('Cincuenta bolivianos')
    await page.getByLabel('Concepto').fill('Anticipo FE08')
    await page.getByLabel('Tipo de pago').selectOption({ label: 'Efectivo' })
    await page.getByLabel('Pago actual').fill('50')
    await page.getByRole('button', { name: 'Emitir', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Recibo emitido')

    await page.getByRole('button', { name: 'Cancelar pedido' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar pedido' }).click()
    await expect(page.getByRole('alert')).toContainText(/recibo|cobro/i)
    // El 400 anterior es la respuesta comercial esperada, no un error del flujo nominal.
    consoleErrors.length = 0

    await page.goto('/recibos')
    await page.getByRole('link', { name: 'Ver detalle' }).first().click()
    await page.getByRole('button', { name: 'Anular recibo' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Anular' }).click()
    await expect(page.getByRole('status')).toContainText('Recibo anulado')

    await page.goto(`/pedidos/${pedidoId}`)
    await page.getByLabel('Nuevo estado').selectOption({ label: 'Listo para entrega' })
    await page.getByRole('button', { name: 'Cambiar estado' }).click()
    await expect(page.getByRole('status')).toContainText('Estado actualizado')
    await expect(page.getByRole('button', { name: 'Emitir nota de entrega' })).toBeVisible()
    await page.getByRole('button', { name: 'Emitir nota de entrega' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Emitir nota' }).click()
    await expect(page.getByRole('status')).toContainText('Nota de entrega emitida')
    await page.goto('/notas-entrega')
    await expect(
      page
        .getByRole('table')
        .getByRole('cell', { name: `#${pedidoId}`, exact: true })
        .first(),
    ).toBeVisible()

    const cancelableId = await createApprovedOrder(page, 'Cancelación válida FE08')
    await page.goto(`/pedidos/${cancelableId}`)
    await page.getByRole('button', { name: 'Cancelar pedido' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar pedido' }).click()
    await expect(page.getByRole('status')).toContainText('Pedido cancelado')
    await page.goto('/movimientos-stock')
    await expect(
      page
        .getByRole('table')
        .getByText(/Devolución de stock por cancelación/)
        .first(),
    ).toBeVisible()

    const navigation = await page.evaluate(
      () => performance.getEntriesByType('navigation')[0]?.duration ?? 0,
    )
    expect(navigation).toBeLessThan(10_000)
    expect(consoleErrors).toEqual([])
  })

  test('audio real pasa por worker, ASR, NLP y confirmación HITL', async ({ page }) => {
    const consoleErrors = await login(page)
    const proformaId = await createDraft(page, 'Captura de voz FE08')
    const audioPath = process.env.FE08_AUDIO_FIXTURE
    if (!audioPath) throw new Error('FE08_AUDIO_FIXTURE es obligatorio para el gate real.')
    const audioBase64 = (await readFile(audioPath)).toString('base64')
    await page.addInitScript(
      ({ fixture }) => {
        const binary = atob(fixture)
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
        class FixtureMediaRecorder {
          static isTypeSupported() {
            return false
          }

          state = 'inactive'
          mimeType = 'audio/wav'
          ondataavailable: ((event: BlobEvent) => void) | null = null
          onstop: (() => void) | null = null

          constructor(_stream: MediaStream) {}

          start() {
            this.state = 'recording'
          }

          stop() {
            this.state = 'inactive'
            const data = new Blob([bytes], { type: 'audio/wav' })
            this.ondataavailable?.({ data } as BlobEvent)
            this.onstop?.()
          }
        }

        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: {
            getUserMedia: async () => ({
              getTracks: () => [{ stop() {} }],
            }),
          },
        })
        Object.defineProperty(window, 'MediaRecorder', {
          configurable: true,
          value: FixtureMediaRecorder,
        })
      },
      { fixture: audioBase64 },
    )

    await page.goto('/capturas/nueva')
    await page.getByLabel('Proforma').fill(String(proformaId))
    await page.getByRole('button', { name: 'Grabar' }).click()
    await expect(page.getByRole('status')).toContainText('Grabando')
    await page.getByRole('button', { name: 'Detener' }).click()
    await expect(page.getByRole('status')).toContainText('Audio listo para enviar')
    await page.getByRole('button', { name: 'Enviar a procesamiento' }).click()
    await expect(page).toHaveURL(/\/capturas\/\d+$/)
    await expect(page.getByText('Propuesta IA · requiere revisión')).toBeVisible()
    await expect(page.locator('blockquote')).toContainText(/mesas/i)
    const unitPrice = page.getByRole('spinbutton', { name: 'Precio unitario' })
    if (!(await unitPrice.inputValue())) await unitPrice.fill('100')
    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar revisión' }).click()
    await expect(page.getByText(/Corrección incorporada.*permanece BORRADOR/)).toBeVisible()
    await page.goto(`/proformas/${proformaId}`)
    await expect(page.getByText('Borrador', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: /mesas/i })).toBeVisible()
    expect(consoleErrors).toEqual([])
  })
  test('PRF-03 persiste y reabre cinco muebles reales desde el configurador', async ({ page }) => {
    test.setTimeout(360_000)
    await login(page)
    const casos = [
      { nombre: 'Velador PRF03', componente: 'Cajón', cantidad: 2, medidas: [{ clave: 'ancho', valor: '40' }], accesorio: 'Jalador' },
      { nombre: 'Escritorio en L PRF03', componente: 'Mesón', cantidad: 1, medidas: [{ clave: 'lado_1', valor: '160' }, { clave: 'lado_2', valor: '120' }], grupo: 'Ala principal', accesorio: 'Pasacables' },
      { nombre: 'Mesa de reuniones PRF03', componente: 'Tablero', cantidad: 1, medidas: [{ clave: 'diámetro', valor: '180' }] },
      { nombre: 'Sillones modulares PRF03', componente: 'Asiento', cantidad: 3, medidas: [{ clave: 'largo', valor: '250' }], grupo: 'Módulo principal' },
      { nombre: 'Vitrina PRF03', componente: 'Cristal', cantidad: 2, medidas: [{ clave: 'alto', valor: '190' }], accesorio: 'Iluminación' },
    ]
    for (const caso of casos) {
      const id = await createDraft(page, `Configuración real ${caso.nombre}`)
      await page.getByRole('button', { name: /Productos$/ }).click()
      await page.getByRole('button', { name: 'Añadir ítem' }).click()
      await page.getByRole('button', { name: 'Mueble a pedido' }).click()
      const modal = page.getByRole('dialog')
      await expect(modal).toBeVisible()
      await modal.getByLabel('Nombre comercial del mueble').fill(caso.nombre)
      await modal.getByLabel('Cantidad cotizada').fill('2')
      await modal.getByLabel('Precio unitario negociado (BOB)').fill('350')
      for (const medida of caso.medidas) {
        if (!['ancho', 'alto', 'profundidad'].includes(medida.clave)) {
          await modal.getByLabel('Nueva medida').fill(medida.clave)
          await modal.getByRole('button', { name: 'Añadir medida' }).click()
        }
        await modal.locator(`input[name="${medida.clave}"]`).fill(medida.valor)
      }
      if (caso.grupo) {
        await modal.getByRole('button', { name: 'Añadir conjunto' }).click()
        await modal.locator('input[name="grupo-0"]').fill(caso.grupo)
        await modal.getByRole('button', { name: 'Añadir componente' }).click()
      } else {
        await modal.getByRole('button', { name: 'Agregar componente' }).click()
      }
      await modal.locator('#componente-nombre-0').fill(caso.componente)
      await modal.locator('input[name="componente-0-cantidad"]').fill(String(caso.cantidad))
      if (caso.accesorio) {
        await modal.getByRole('button', { name: 'Añadir accesorio' }).click()
        await modal.locator('input[name="accesorio-0"]').fill(caso.accesorio)
      }
      await modal.getByRole('button', { name: 'Guardar especificación' }).click()
      await expect(page.locator('.line-card').getByText(caso.nombre, { exact: true })).toBeVisible()

      const escritura = page.waitForResponse((r) =>
        r.url().endsWith(`/api/v1/proformas/${id}/integral/`) && r.request().method() === 'PUT')
      await page.getByRole('button', { name: 'Guardar borrador' }).click()
      expect((await escritura).ok(), `No se guardó ${caso.nombre} en PostgreSQL`).toBe(true)

      const lectura = page.waitForResponse((r) =>
        r.url().endsWith(`/api/v1/proformas/${id}/`) && r.request().method() === 'GET')
      await page.reload()
      const respuesta = await lectura
      expect(respuesta.ok()).toBe(true)
      const datos = (await respuesta.json()) as {
        detalles: Array<{
          nombre: string
          especificacion: { datos_tecnicos: {
            componentes?: Array<{ nombre: string; cantidad_interna?: number; conjunto_uid?: string }>
            conjuntos?: Array<{ uid: string; nombre: string }>
            accesorios?: string[]
            caracteristicas_generales?: { dimensiones?: Record<string, { valor: string }> }
          }} | null
        }>
      }
      const linea = datos.detalles.find((item) => item.nombre === caso.nombre)
      expect(linea?.especificacion, `Falta la ficha persistida de ${caso.nombre}`).toBeTruthy()
      const tecnico = linea!.especificacion!.datos_tecnicos
      expect(tecnico.componentes?.[0]).toMatchObject({
        nombre: caso.componente,
        cantidad_interna: caso.cantidad,
      })
      for (const medida of caso.medidas)
        expect(tecnico.caracteristicas_generales?.dimensiones?.[medida.clave]?.valor).toBe(medida.valor)
      if (caso.accesorio) expect(tecnico.accesorios).toContain(caso.accesorio)
      if (caso.grupo) {
        expect(tecnico.conjuntos?.[0]?.nombre).toBe(caso.grupo)
        expect(tecnico.componentes?.[0]?.conjunto_uid).toBe(tecnico.conjuntos?.[0]?.uid)
      }
      await page.getByRole('button', { name: /Productos$/ }).click()
      await expect(page.locator('.line-card').getByText(caso.nombre, { exact: true })).toBeVisible()
    }
  })

})
