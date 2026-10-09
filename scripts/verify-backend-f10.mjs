import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const expected = readFileSync('contracts/backend-ref.txt', 'utf8').trim()
const backend = resolve(process.argv[2] ?? '../homex-backend')
execFileSync('git', ['cat-file', '-e', `${expected}^{commit}`], { cwd: backend })
const authority = execFileSync('git', ['show', `${expected}:docs/openapi.yaml`], { cwd: backend })
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
  const snapshot = readFileSync('contracts/backend-openapi.yaml')
  if (!snapshot.equals(readFileSync(normalized)))
    throw new Error(
      'El snapshot OpenAPI no coincide con Backend F10 después de normalizar formato.',
    )
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
console.log(`fe09-backend-contract-ok revision=${expected}`)
