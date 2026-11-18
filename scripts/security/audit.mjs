import { spawnSync } from 'node:child_process'
import { evaluateAudit, expires } from './audit-policy.mjs'
import { verifyInstallations, projectRoot } from './picomatch.mjs'

try {
  verifyInstallations()
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--json'], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  })
  // Preserve the complete raw report, including the accepted finding, in CI logs.
  process.stdout.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')
  if (result.error || ![0, 1].includes(result.status))
    throw new Error(`npm audit failed: ${result.error?.message ?? result.status}`)
  const report = JSON.parse(result.stdout)
  const accepted = evaluateAudit(report)
  if (accepted.length)
    console.warn(
      `TEMPORARY ACCEPTANCE, NOT AN OFFICIAL FIX: ${accepted.join(', ')}; expires ${expires}; hash-verified local mitigation active`,
    )
  else console.log('No advisories reported; evaluate removing the temporary mitigation')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
