import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
for (const extension of ['aac', 'opus', 'mp4', 'flac']) {
  test(`mobile ${extension} is converted to WAV or rejected clearly before any upload`, async ({
    page,
  }) => {
    const token = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo3fQ.signature'
    await page.addInitScript(
      (access) =>
        sessionStorage.setItem('homex.session.v1', JSON.stringify({ access, refresh: 'refresh' })),
      token,
    )
    let posts = 0
    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url()),
        path = url.pathname
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
        return route.fulfill({ json: { access: token, refresh: 'refresh' } })
      if (path.includes('/catalogo/opciones/'))
        return route.fulfill({
          json:
            url.searchParams.get('concepto') === 'CATEGORIA_PRODUCTO'
              ? [{ id: 1, codigo: 'SILLA', nombre: 'Silla' }]
              : [],
        })
      if (path.endsWith('/capturas/catalogo/') && route.request().method() === 'POST') {
        posts++
        expect(route.request().postData()).toContain('filename="tone.wav"')
        expect(route.request().postData()).toContain('solo_transcribir')
        return route.fulfill({ status: 202, json: { id: 1 } })
      }
      if (path.endsWith('/capturas/catalogo/1/'))
        return route.fulfill({
          json: {
            id: 1,
            estado: 'COMPLETADA',
            solo_transcribir: true,
            texto_transcrito_original: 'Transcripción de prueba',
            propuesta: null,
          },
        })
      return route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } })
    })
    await page.goto('/productos/nuevo?categoria=SILLA')
    await page.getByRole('button', { name: 'Completar por voz', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Completar por voz', exact: true })
    await drawer
      .locator('input[type=file]')
      .setInputFiles(
        fileURLToPath(new URL(`../fixtures/voice-mobile/tone.${extension}`, import.meta.url)),
      )
    await expect(drawer.locator('audio, [role="alert"]').first()).toBeVisible()
    await expect(drawer.getByText('Validando y preparando audio…')).toHaveCount(0)
    if (await drawer.locator('audio').count()) {
      await expect(drawer.locator('textarea')).toHaveValue('Transcripción de prueba')
      expect(posts).toBe(1)
    } else {
      await expect(drawer.getByRole('alert')).toContainText(
        /convertir|compatible|dañado|15 segundos/i,
      )
      expect(posts).toBe(0)
    }
  })
}
