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
  await expect(page.locator('#cliente-proforma option')).toContainText(['Cliente Integración FE08'])
  await page.locator('#cliente-proforma').selectOption({ label: 'Cliente Integración FE08' })
  await page.getByLabel('Título').fill(title)
  await page.getByRole('button', { name: 'Crear borrador' }).click()
  await expect(page).toHaveURL(/\/proformas\/\d+$/)
  const segments = new URL(page.url()).pathname.split('/').filter(Boolean)
  return Number(segments[segments.length - 1])
}

async function addCatalogLine(page: Page) {
  await page.getByRole('button', { name: 'Agregar línea' }).click()
  await page.getByLabel('Tipo de línea').selectOption({ label: 'Otro producto' })
  await expect(page.locator('#producto-linea option')).toContainText(['FE08-SILLA-001'])
  await page.locator('#producto-linea').selectOption({ index: 1 })
  await page.getByLabel('Cantidad', { exact: true }).fill('1')
  await page.locator('#unidad-linea').selectOption({ label: 'Pieza' })
  await page.getByRole('button', { name: 'Guardar línea' }).click()
  await expect(page.getByRole('heading', { name: 'Silla integración FE08' })).toBeVisible()
}

async function approveCurrentQuote(page: Page) {
  await page.getByRole('button', { name: 'Enviar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/modo lectura/)).toBeVisible()
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
    await page.getByLabel('Nuevo estado').selectOption({ label: 'En producción' })
    await page.getByRole('button', { name: 'Cambiar estado' }).click()
    await expect(page.getByRole('status')).toContainText('Estado actualizado')
    await page.getByLabel('Nuevo estado').selectOption({ label: 'Listo para entrega' })
    await page.getByRole('button', { name: 'Cambiar estado' }).click()
    await expect(page.getByRole('button', { name: 'Emitir nota de entrega' })).toBeVisible()
    await page.getByRole('button', { name: 'Emitir nota de entrega' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Emitir nota' }).click()
    await expect(page.getByRole('status')).toContainText('Nota de entrega emitida')
    await page.goto('/notas-entrega')
    await expect(
      page.getByRole('table').getByRole('cell', { name: `#${pedidoId}`, exact: true }).first(),
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
    const total = page.getByRole('spinbutton', { name: 'Total negociado' })
    if (!(await total.inputValue())) await total.fill('100')
    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar revisión' }).click()
    await expect(page.getByText(/Corrección incorporada.*permanece BORRADOR/)).toBeVisible()
    await page.goto(`/proformas/${proformaId}`)
    await expect(page.getByText('Borrador', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: /mesas/i })).toBeVisible()
    expect(consoleErrors).toEqual([])
  })
})
