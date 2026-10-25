import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// FE09/F10 es una referencia histórica; PRF-04 mantiene su propio snapshot actual.
// No comparar contratos de versiones diferentes ni cambiar el backend productivo.
const frontendF10 = resolve(process.argv[3] ?? '../homex-frontend-f10')
const backend = resolve(process.argv[2] ?? '../homex-backend')
const frontendF10Sha = 'ffd1a3c27b4ec039760baddfd9649af4f4c3f100'
const actualFrontend = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: frontendF10,
  encoding: 'utf8',
}).trim()
if (actualFrontend !== frontendF10Sha)
  throw new Error(`El frontend FE09/F10 histórico no coincide: ${actualFrontend}`)

const expected = readFileSync(join(frontendF10, 'contracts/backend-ref.txt'), 'utf8').trim()
const actualBackend = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: backend,
  encoding: 'utf8',
}).trim()
if (actualBackend !== expected)
  throw new Error(`El backend FE09/F10 histórico no coincide: ${actualBackend} != ${expected}`)

const authority = readFileSync(join(backend, 'docs/openapi.yaml'))
const temporary = mkdtempSync(join(tmpdir(), 'homex-fe09-openapi-'))
try {
  const normalized = join(temporary, 'openapi.yaml')
  writeFileSync(normalized, authority)
  execFileSync(join(process.cwd(), 'node_modules', '.bin', 'prettier'), [
    '--config',
    join(process.cwd(), '.prettierrc.json'),
    '--write',
    normalized,
  ])
  const historicalSnapshot = readFileSync(join(frontendF10, 'contracts/backend-openapi.yaml'))
  if (!historicalSnapshot.equals(readFileSync(normalized)))
    throw new Error('El OpenAPI histórico FE09/F10 no coincide con su backend fijado.')
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
console.log(`fe09-backend-contract-ok frontend=${actualFrontend} backend=${actualBackend}`)
