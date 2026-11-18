import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { evaluateAudit, advisory, expires } from './audit-policy.mjs'
import { patchSource, verifyInstallations } from './picomatch.mjs'

const require = createRequire(new URL('../../node_modules/vite/package.json', import.meta.url))
const picomatch = require('picomatch')
const fixture = () => ({
  auditReportVersion: 2,
  vulnerabilities: {
    picomatch: {
      name: 'picomatch',
      nodes: ['node_modules/picomatch'],
      via: [{ name: 'picomatch', url: advisory }],
    },
    vite: { name: 'vite', nodes: ['node_modules/vite'], via: ['picomatch'] },
  },
  metadata: { vulnerabilities: { total: 2 } },
})
const now = new Date('2026-11-18T00:00:00Z')

test('only the approved advisory and its transitive propagation are accepted', () => {
  assert.deepEqual(evaluateAudit(fixture(), now), [advisory])
  const report = fixture()
  report.vulnerabilities.picomatch.via.push({
    name: 'picomatch',
    url: 'https://github.com/advisories/NEW',
  })
  assert.throws(() => evaluateAudit(report, now), /Unaccepted/)
})

test('moderate vulnerabilities, renamed packages and missing graph edges fail closed', () => {
  const report = fixture()
  report.vulnerabilities.vite.via.push({
    name: 'vite',
    severity: 'moderate',
    url: 'https://github.com/advisories/OTHER',
  })
  assert.throws(() => evaluateAudit(report, now), /Unaccepted/)
  const renamed = fixture()
  renamed.vulnerabilities.picomatch.via[0].name = 'other'
  assert.throws(() => evaluateAudit(renamed, now), /Unaccepted/)
  const missing = fixture()
  missing.vulnerabilities.vite.via = ['missing']
  assert.throws(() => evaluateAudit(missing, now), /Missing/)
})

test('expiry, malformed reports, empty findings and cyclic propagation fail closed', () => {
  assert.throws(() => evaluateAudit(fixture(), new Date(expires)), /expired/)
  for (const report of [
    {},
    { error: 'network failure' },
    { auditReportVersion: 2, vulnerabilities: {} },
  ]) {
    assert.throws(() => evaluateAudit(report, now), /Invalid/)
  }
  const empty = fixture()
  empty.vulnerabilities.vite.via = []
  assert.throws(() => evaluateAudit(empty, now), /Empty/)
  const cyclic = fixture()
  cyclic.vulnerabilities.picomatch.via = ['vite']
  assert.throws(() => evaluateAudit(cyclic, now), /Cyclic/)
})

test('clean audits pass without an exception, even after expiry', () => {
  assert.deepEqual(
    evaluateAudit(
      { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } },
      new Date(expires),
    ),
    [],
  )
})

test('parser patch is idempotent and refuses unknown source bytes', () => {
  const source = readFileSync(require.resolve('picomatch/lib/parse.js'), 'utf8')
  assert.equal(patchSource(source), source)
  assert.throws(() => patchSource(`${source}\n`), /Unexpected/)
  const original = readFileSync(new URL('./picomatch-patch.json', import.meta.url), 'utf8')
  const metadata = JSON.parse(original)
  let baseline = source
  for (const { before, after } of [...metadata.replacements].reverse())
    baseline = baseline.replace(after, before)
  assert.equal(patchSource(baseline), source)
})

test('every locked installation is patched; skipped scripts and byte tampering are rejected', () => {
  assert.ok(verifyInstallations().length > 0)
  const root = mkdtempSync(join(tmpdir(), 'homex-security-test-'))
  try {
    const path = 'node_modules/picomatch'
    cpSync(join(require.resolve('picomatch/package.json'), '..'), join(root, path), {
      recursive: true,
    })
    const lock = { packages: { [path]: { version: '4.0.7' } } }
    writeFileSync(join(root, 'package-lock.json'), JSON.stringify(lock))
    assert.equal(verifyInstallations(root).length, 1)
    const parser = join(root, path, 'lib/parse.js')
    writeFileSync(parser, `${readFileSync(parser, 'utf8')}\n`)
    assert.throws(() => verifyInstallations(root), /Unpatched/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('dangerous extglobs are literalized and adversarial matches cannot hang', () => {
  for (const pattern of [
    '+(*)',
    '+(*a)',
    '+(a*)',
    '+(a*a)',
    '*(*)',
    '*(*a)',
    '*(a*|b)',
    '+(ab|abab)',
    '+(abc|abcabc)',
  ]) {
    assert.equal(picomatch.isMatch(pattern, pattern), true, pattern)
    assert.equal(picomatch.isMatch('aaaaaaaaa!', pattern), false, pattern)
    assert.equal(picomatch.isMatch('aa', pattern), false, pattern)
  }
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `const p=require(${JSON.stringify(require.resolve('picomatch'))}); for(const g of ['+(*a)','+(*)a','+(a*)','+(ab|abab)']) p.isMatch('a'.repeat(100)+'!',g)`,
    ],
    { timeout: 2000, encoding: 'utf8' },
  )
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
})

test('normal consumer glob and safe extglob behavior stays compatible', () => {
  for (const [input, pattern, expected] of [
    ['src/main.ts', '**/*.ts', true],
    ['src/main.js', '**/*.ts', false],
    ['jsjsx', '+(js|jsx)', true],
    ['foofoobar', '+(foo|foobar)', true],
    ['fffooo', '*(*(f)*(o))', true],
    ['ffo', '*(f*(o))', true],
    ['foo', '!(bar)', true],
    ['bar', '!(bar)', false],
    ['a*', 'a\\*', true],
  ])
    assert.equal(picomatch.isMatch(input, pattern), expected, `${input}: ${pattern}`)
})

test(
  'audit CLI rejects transport errors, malformed reports and unrelated advisories',
  { skip: process.platform === 'win32' },
  () => {
    const root = mkdtempSync(join(tmpdir(), 'homex-audit-cli-'))
    try {
      writeFileSync(
        join(root, 'npm'),
        `#!${process.execPath}\nprocess.stdout.write(process.env.AUDIT_FIXTURE);process.exit(Number(process.env.AUDIT_STATUS))\n`,
        { mode: 0o755 },
      )
      const unrelated = fixture()
      unrelated.vulnerabilities.picomatch.via[0].url = 'https://github.com/advisories/OTHER'
      for (const [report, status, expected] of [
        [JSON.stringify(fixture()), 1, 0],
        [JSON.stringify(unrelated), 1, 1],
        ['not json', 1, 1],
        [JSON.stringify(fixture()), 2, 1],
      ]) {
        const result = spawnSync(
          process.execPath,
          [new URL('./audit.mjs', import.meta.url).pathname],
          {
            encoding: 'utf8',
            timeout: 5000,
            env: {
              ...process.env,
              PATH: `${root}:${process.env.PATH}`,
              AUDIT_FIXTURE: report,
              AUDIT_STATUS: String(status),
            },
          },
        )
        assert.equal(result.status, expected, result.stderr)
        assert.ok(result.stdout.includes(report), 'raw audit report must remain visible')
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  },
)
