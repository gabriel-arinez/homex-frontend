import { expect, test } from '@playwright/test'
import { join } from 'node:path'

const directory = process.env.HOMEX_CATALOGO_AUDIO_DIR
const password = process.env.HOMEX_CATALOGO_PASSWORD
const samples = [
  ['SILLA', 'silla'],
  ['PISO_FLOTANTE', 'piso'],
  ['OTRO', 'otro'],
] as const
for (const [category, file] of samples) {
  test.describe(category, () => {
    test.use({
      launchOptions: {
        args: directory
          ? [
              '--use-fake-ui-for-media-stream',
              '--use-fake-device-for-media-stream',
              `--use-file-for-fake-audio-capture=${join(directory, file + '.wav')}`,
            ]
          : [],
      },
    })
    for (const mode of ['upload', 'record'] as const) {
      test(`${mode}: ASR → propuesta → formulario → guardado manual`, async ({ page }) => {
        test.skip(!directory || !password, 'Requiere stack local, credenciales y audios de prueba.')
        const writes: string[] = []
        page.on('request', (request) => {
          if (request.method() === 'POST' && /\/catalogo\/productos\/$/.test(request.url()))
            writes.push(request.url())
        })
        await page.goto('/login')
        await page.getByLabel('Usuario').fill(process.env.HOMEX_CATALOGO_USERNAME ?? 'demo-admin')
        await page.getByLabel('Contraseña').fill(password!)
        await page.getByRole('button', { name: 'Ingresar' }).click()
        await page.waitForURL((url) => !url.pathname.endsWith('/login'))
        await page.goto(`/productos/nuevo?categoria=${category}`)
        await expect(page.getByRole('heading', { name: 'Descripción por voz' })).toBeVisible()
        if (mode === 'upload') {
          await page
            .getByLabel('Subir audio', { exact: true })
            .setInputFiles(join(directory!, file + '.wav'))
        } else {
          await page.getByRole('button', { name: 'Grabar descripción', exact: true }).click()
          await expect(page.getByRole('status').filter({ hasText: 'Grabando' })).toBeVisible()
          await page.waitForTimeout(16000)
          await page.getByRole('button', { name: 'Detener', exact: true }).click()
        }
        await page.getByRole('button', { name: 'Procesar audio', exact: true }).click()
        await expect(page.getByRole('heading', { name: 'Campos detectados' })).toBeVisible()
        const text = page.getByRole('textbox', { name: 'Transcripción / texto corregido' })
        expect((await text.inputValue()).trim().length).toBeGreaterThan(4)
        expect(writes).toEqual([])
        await page.getByRole('button', { name: 'Aplicar al formulario', exact: true }).click()
        expect(writes).toEqual([])
        // Required SKU remains a deliberate manual choice.
        await page
          .getByLabel('SKU', { exact: true })
          .fill(`VOICE-${category}-${mode}-${Date.now()}`)
        const name = page.getByLabel('Nombre comercial', { exact: true })
        if (!(await name.inputValue())) await name.fill(`Prueba voz ${category}`)
        await page.getByLabel('Precio de lista (BOB)', { exact: true }).fill('100')
        await page.getByRole('button', { name: 'Guardar producto', exact: true }).click()
        await expect(page).toHaveURL(/\/productos(?:\?|$)/)
        expect(writes).toHaveLength(1)
      })
    }
  })
}
