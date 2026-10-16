import { readFile } from 'node:fs/promises'
import * as prettier from 'prettier'
import { it } from 'vitest'

it('diagnostica temporalmente formato canonico de dos archivos AP5', async () => {
  const paths = [
    'src/modules/productos/views/ProductoDetailView.vue',
    'src/tests/ap5/catalogo-proformas.spec.ts',
  ]
  for (const path of paths) {
    const source = await readFile(path, 'utf8')
    const config = await prettier.resolveConfig(path)
    const formatted = await prettier.format(source, { ...config, filepath: path })
    console.log('AP5_CANONICAL_FORMAT=' + JSON.stringify({ path, formatted }))
  }
})
