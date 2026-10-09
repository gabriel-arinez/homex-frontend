import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, relative } from 'node:path'

const apiBaseUrl = process.env.VITE_API_BASE_URL
if (!apiBaseUrl) throw new Error('VITE_API_BASE_URL es obligatoria para una release.')
const parsed = new URL(apiBaseUrl)
if (
  !['http:', 'https:'].includes(parsed.protocol) ||
  parsed.username ||
  parsed.password ||
  parsed.search ||
  parsed.hash ||
  parsed.pathname !== '/'
)
  throw new Error(
    'VITE_API_BASE_URL debe ser HTTP(S), sin rutas, credenciales, query ni fragmento.',
  )

const root = mkdtempSync(join(tmpdir(), 'homex-fe09-'))
const builds = [join(root, 'a'), join(root, 'b')]
const vite = join(process.cwd(), 'node_modules', '.bin', 'vite')

function files(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
}

function manifest(directory) {
  return files(directory).map((file) => ({
    path: relative(directory, file),
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
    bytes: statSync(file).size,
  }))
}

try {
  for (const output of builds)
    execFileSync(vite, ['build', '--outDir', output, '--emptyOutDir'], {
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'inherit',
    })

  const first = manifest(builds[0])
  const second = manifest(builds[1])
  if (JSON.stringify(first) !== JSON.stringify(second))
    throw new Error('Dos builds limpios con el mismo lock y entorno no son idénticos.')

  for (const build of builds) {
    const bundleContainsOrigin = files(build).some((file) =>
      readFileSync(file).includes(Buffer.from(parsed.origin)),
    )
    if (!bundleContainsOrigin)
      throw new Error('El bundle no incorpora el origen público configurado para la release.')
  }

  const paths = first.map(({ path }) => path)
  if (!paths.includes('index.html')) throw new Error('La release no contiene index.html.')
  if (paths.some((path) => path.endsWith('.map')))
    throw new Error('La release contiene source maps.')
  const assets = paths.filter((path) => path.startsWith('assets/'))
  if (!assets.length || assets.some((path) => !/-[A-Za-z0-9_-]{8,}\.[^.]+$/.test(basename(path))))
    throw new Error('Todos los assets productivos deben estar versionados por hash.')

  const sourceEnv = files(join(process.cwd(), 'src'))
    .filter((file) => /\.(ts|vue)$/.test(file))
    .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)])
    .map((match) => match[1])
  const unexpectedEnv = [...new Set(sourceEnv)].filter(
    (name) => !['VITE_API_BASE_URL', 'BASE_URL'].includes(name),
  )
  if (unexpectedEnv.length)
    throw new Error(`Variables públicas no autorizadas: ${unexpectedEnv.join(', ')}`)

  const forbidden = [
    'DJANGO_SECRET_KEY',
    'CLOUDFLARE_TUNNEL_TOKEN',
    'R2_SECRET_ACCESS_KEY',
    'AWS_SECRET_ACCESS_KEY',
    'postgresql://',
    'BEGIN PRIVATE KEY',
  ]
  const exposed = files(builds[0]).flatMap((file) => {
    const content = readFileSync(file, 'utf8')
    return forbidden
      .filter((token) => content.includes(token))
      .map((token) => `${relative(builds[0], file)}:${token}`)
  })
  if (exposed.length)
    throw new Error(`El bundle contiene indicadores sensibles: ${exposed.join(', ')}`)

  const bytes = first.reduce((total, file) => total + file.bytes, 0)
  if (bytes > 3_000_000) throw new Error(`El bundle excede 3 MB (${bytes} bytes).`)
  console.log(`fe09-release-ok files=${first.length} bytes=${bytes} reproducible=true sourcemaps=0`)
} finally {
  rmSync(root, { recursive: true, force: true })
}
