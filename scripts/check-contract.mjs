import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const temporary = mkdtempSync(join(tmpdir(), 'homex-openapi-'))
try {
  execFileSync(
    'npx',
    [
      'openapi-ts',
      '-i',
      './contracts/backend-openapi.yaml',
      '-o',
      temporary,
      '-p',
      '@hey-api/typescript',
    ],
    { stdio: 'inherit' },
  )
  execFileSync('npx', ['prettier', '--config', '.prettierrc.json', '--write', temporary], {
    stdio: 'inherit',
  })
  const expected = readdirSync('src/generated/api').sort()
  const actual = readdirSync(temporary).sort()
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    throw new Error('Cambió el conjunto generado.')
  for (const file of expected) {
    const expectedPath = join('src/generated/api', file)
    const actualPath = join(temporary, file)
    if (readFileSync(expectedPath, 'utf8') !== readFileSync(actualPath, 'utf8')) {
      try {
        execFileSync('diff', ['-u', expectedPath, actualPath], { stdio: 'inherit' })
      } catch {
        // diff devuelve 1 precisamente cuando encuentra diferencias.
      }
      throw new Error(`El tipo generado ${file} no corresponde al snapshot OpenAPI.`)
    }
  }
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
