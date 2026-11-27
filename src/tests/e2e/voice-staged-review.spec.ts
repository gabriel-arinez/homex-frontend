import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('@a11y catalog voice uses automatic ASR, corrected text, explicit interpretation and explicit application', async ({
  page,
}) => {
  const access = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo3fQ.signature'
  await page.addInitScript(
    (token) =>
      sessionStorage.setItem(
        'homex.session.v1',
        JSON.stringify({ access: token, refresh: 'refresh' }),
      ),
    access,
  )
  let audioRequests = 0,
    textRequests = 0,
    saves = 0
  const corrected =
    'silla plegable de madera para oficina con respaldo asiento patas acabado natural cantidad dos unidades precio de lista 450' +
    ' bolivianos'
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/me/'))
      return route.fulfill({
        json: {
          id: 7,
          username: 'seller',
          display_name: 'Seller',
          capabilities: ['comercial.operar', 'catalogo.crear_producto'],
        },
      })
    if (path.endsWith('/auth/token/refresh/'))
      return route.fulfill({ json: { access, refresh: 'refresh' } })
    if (path.includes('/catalogo/opciones/')) {
      const concept = new URL(route.request().url()).searchParams.get('concepto')
      const values =
        concept === 'CATEGORIA_PRODUCTO'
          ? [{ id: 1, codigo: 'SILLA', nombre: 'Silla' }]
          : concept === 'UNIDAD_MEDIDA'
            ? [{ id: 2, codigo: 'PIEZA', nombre: 'Pieza' }]
            : []
      return route.fulfill({ json: values })
    }
    if (path.endsWith('/capturas/catalogo/') && route.request().method() === 'POST') {
      if (route.request().headers()['content-type']?.includes('multipart')) {
        audioRequests++
        expect(route.request().postData()).toContain('solo_transcribir')
        return route.fulfill({ status: 202, json: { id: 1, estado: 'PENDIENTE' } })
      }
      textRequests++
      expect(route.request().postDataJSON()).toMatchObject({ texto: corrected, captura_origen: 1 })
      return route.fulfill({ status: 202, json: { id: 2, estado: 'PENDIENTE' } })
    }
    if (path.endsWith('/capturas/catalogo/1/'))
      return route.fulfill({
        json: {
          id: 1,
          estado: 'COMPLETADA',
          solo_transcribir: true,
          texto_transcrito_original: 'silla plegable precio 40',
          texto_asr_original: 'silla plegable precio 40',
          propuesta: null,
        },
      })
    if (path.endsWith('/capturas/catalogo/2/'))
      return route.fulfill({
        json: {
          id: 2,
          estado: 'COMPLETADA',
          texto_transcrito_original: corrected,
          propuesta: {
            category: 'SILLA',
            fields: { nombre: 'Silla plegable', precio_lista: '450.00' },
            evidence: [
              {
                candidate_id: 'price',
                label: 'precio_lista',
                start: corrected.indexOf('450'),
                end: corrected.indexOf('450') + 3,
                text: '450',
                decision: 'UNRESOLVED',
                reason: 'Confirmar precio comercial',
                normalized_value: '450.00',
              },
            ],
            warnings: ['Confirmar precio comercial'],
            unrecognized: [],
            version: 'catalog-0.1.26',
          },
        },
      })
    if (path.endsWith('/catalogo/productos/') && route.request().method() === 'POST') saves++
    return route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } })
  })
  await page.goto('/productos/nuevo?categoria=SILLA')
  await page.getByRole('button', { name: 'Completar por voz', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Completar por voz', exact: true })
  // Fifteen seconds of valid PCM. Silence warning is advisory, not a blocker.
  const wav = Buffer.alloc(44 + 16000 * 2 * 15)
  wav.write('RIFF')
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(16000, 24)
  wav.writeUInt32LE(32000, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(wav.length - 44, 40)
  const shortWav = Buffer.from(wav.subarray(0, 44 + 16000 * 2 * 14))
  shortWav.writeUInt32LE(shortWav.length - 8, 4)
  shortWav.writeUInt32LE(shortWav.length - 44, 40)
  await drawer
    .locator('input[type=file]')
    .setInputFiles({ name: 'short.wav', mimeType: 'audio/wav', buffer: shortWav })
  await expect(drawer.getByRole('alert').filter({ hasText: '15 segundos' })).toBeVisible()
  expect(audioRequests).toBe(0)
  await drawer
    .locator('input[type=file]')
    .setInputFiles({ name: 'voice.wav', mimeType: 'audio/wav', buffer: wav })
  await expect(drawer.locator('audio')).toBeVisible()
  expect(textRequests).toBe(0)
  await expect(drawer.locator('textarea')).toHaveValue('silla plegable precio 40')
  expect(audioRequests).toBe(1)
  expect(textRequests).toBe(0)
  expect((await new AxeBuilder({ page }).include('.staged-voice').analyze()).violations).toEqual([])
  await expect(page.locator('input[name=nombre]')).toHaveValue('')
  // Partial text is processable; empty and numeric-only text still cannot be submitted.
  await drawer.locator('textarea').fill('dato '.repeat(19).trim())
  await expect(
    drawer.getByRole('button', { name: 'Procesar y aplicar', exact: true }),
  ).toBeEnabled()
  for (const invalid of ['', '123']) {
    await drawer.locator('textarea').fill(invalid)
    await expect(
      drawer.getByRole('button', { name: 'Procesar y aplicar', exact: true }),
    ).toBeDisabled()
  }
  await drawer.locator('textarea').fill('dato '.repeat(20).trim())
  await expect(
    drawer.getByRole('button', { name: 'Procesar y aplicar', exact: true }),
  ).toBeEnabled()
  expect(textRequests).toBe(0)
  await drawer.locator('textarea').fill(corrected)
  await drawer.getByRole('button', { name: 'Procesar y aplicar', exact: true }).click()
  await expect(page.locator('input[name=nombre]')).toHaveValue('Silla plegable')
  await expect(page.locator('input[name=precio]')).toHaveValue('450.00')
  await expect(drawer.locator('textarea')).toHaveCount(0)
  await expect(page.locator('input[name=precio]')).toHaveAttribute('data-voice-state', 'pending')
  await page.getByRole('button', { name: 'Guardar producto', exact: true }).click()
  expect(saves).toBe(0)
  await expect(
    page.getByRole('alert').filter({ hasText: 'Revisa los campos señalados' }),
  ).toBeVisible()
  await page.locator('#voice-status-precio').getByRole('button', { name: 'Validar valor' }).click()
  await expect(page.locator('input[name=precio]')).toHaveAttribute('data-voice-state', 'reviewed')
  expect(audioRequests).toBe(1)
  expect(textRequests).toBe(1)
  await page.screenshot({ path: '/tmp/homex-voice-review-after-apply.png', fullPage: true })
})
