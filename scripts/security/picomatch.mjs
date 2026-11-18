import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const patch = JSON.parse(readFileSync(new URL('./picomatch-patch.json', import.meta.url), 'utf8'))
export const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const hash = (value) => createHash('sha256').update(value).digest('hex')

export function patchSource(source) {
  if (hash(source) === patch.patchedSha256) return source
  if (hash(source) !== patch.originalSha256)
    throw new Error('Unexpected picomatch source; review upstream before updating')
  let output = source
  for (const { before, after } of patch.replacements) {
    if (output.split(before).length !== 2) throw new Error('Unexpected patch context')
    output = output.replace(before, after)
  }
  if (hash(output) !== patch.patchedSha256) throw new Error('Unexpected patched source hash')
  return output
}

export function verifyInstallations(root = projectRoot, apply = false) {
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
  const paths = Object.entries(lock.packages).filter(([path]) =>
    /(^|\/)node_modules\/picomatch$/.test(path),
  )
  if (!paths.length)
    throw new Error('No locked picomatch installations; remove the workaround explicitly')
  const installed = []
  for (const [path, entry] of paths) {
    if (!existsSync(join(root, path)) && (entry.dev || entry.optional)) continue
    const pkg = JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8'))
    if (
      entry.version !== patch.version ||
      pkg.version !== patch.version ||
      pkg.name !== 'picomatch'
    ) {
      throw new Error(`Unexpected picomatch version at ${path}`)
    }
    const file = join(root, path, 'lib/parse.js')
    const source = readFileSync(file, 'utf8')
    if (apply) writeFileSync(file, patchSource(source))
    if (hash(readFileSync(file)) !== patch.patchedSha256)
      throw new Error(`Unpatched picomatch at ${path}; run npm ci with scripts enabled`)
    installed.push(path)
  }
  if (!installed.length) throw new Error('No installed picomatch found')
  return installed
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = verifyInstallations(projectRoot, process.argv.includes('--apply'))
  console.log(`Verified patched picomatch 4.0.7: ${paths.length} installation(s)`)
}
