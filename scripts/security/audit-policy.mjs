export const advisory = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf'
export const expires = '2026-12-17T00:00:00Z'

// Resolve transitive findings to their advisory leaves; never ignore a package wholesale.
export function evaluateAudit(report, now = new Date()) {
  if (
    report?.error ||
    report?.auditReportVersion !== 2 ||
    !report.vulnerabilities ||
    typeof report.vulnerabilities !== 'object' ||
    Array.isArray(report.vulnerabilities) ||
    !Number.isInteger(report.metadata?.vulnerabilities?.total) ||
    !Number.isFinite(now.getTime())
  ) {
    throw new Error('Invalid npm audit report or clock')
  }
  const findings = report.vulnerabilities
  const entries = Object.entries(findings)
  if (report.metadata.vulnerabilities.total !== entries.length)
    throw new Error('Invalid audit finding count')
  const accepted = new Set()
  function inspect(name, visiting = new Set()) {
    if (visiting.has(name)) throw new Error(`Cyclic audit dependency: ${name}`)
    const finding = findings[name]
    if (!finding) throw new Error(`Missing audit dependency: ${name}`)
    if (!Array.isArray(finding.via) || !finding.via.length)
      throw new Error(`Empty audit finding: ${name}`)
    const next = new Set([...visiting, name])
    for (const via of finding.via) {
      if (typeof via === 'string') {
        inspect(via, next)
        continue
      }
      if (name !== 'picomatch' || via?.name !== 'picomatch' || via.url !== advisory) {
        throw new Error(`Unaccepted security advisory: ${via?.url ?? name}`)
      }
      if (now >= new Date(expires)) throw new Error(`Security exception expired: ${expires}`)
      accepted.add(advisory)
    }
  }
  for (const [name] of entries) inspect(name)
  return [...accepted]
}
