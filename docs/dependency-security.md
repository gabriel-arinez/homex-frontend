# Temporary picomatch mitigation

**Status:** locally mitigated, **not an official upstream fix**. The maintainer explicitly authorized the residual risk and the single-advisory exception on 2026-11-17. The exception expires **2026-12-17 at 00:00 UTC**; CI fails closed thereafter. Owner: HOMEX maintainers / PR #70.

## What changes

- `minimatch` is overridden to **11.0.1**, addressing [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
- `glob` is overridden to **14.0.2**, addressing [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). Both upgrades support Node 24; consumer verification covers the cross-major overrides.
- `picomatch` stays at its authentic registry version **4.0.7**. Root `postinstall` applies the parser-only changes from [upstream PR #235](https://github.com/micromatch/picomatch/pull/235), immutable commit `0150ed18b7971894bfd1824c8f96d6b63c70ad1f`, to every installed lockfile copy. This proposal is **closed and unmerged**; HOMEX owns this temporary local patch.
- `scripts/security/picomatch-patch.json` records exact replacement contexts and SHA-256 hashes before/after patching. Unknown versions/bytes fail installation rather than silently carrying the patch forward. Reapplication is idempotent. Upstream MIT attribution is retained in `scripts/security/PICOMATCH-LICENSE`.

## Verification and remaining risk

Run `npm ci` with lifecycle scripts enabled, then `npm run security:check`. The check verifies installed parser hashes, tests malicious and normal patterns, and runs a full `npm audit --json`. Raw findings remain visible in CI logs. Plain `npm audit` still reports picomatch and exits nonzero: **the exception is not a claim of zero vulnerabilities**.

Only [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), attached to `picomatch`, and graph findings derived exclusively from that advisory are accepted before expiry. All other severities/advisories, malformed reports, audit transport errors, skipped/tampered patches, and expiry block the security check. No global audit configuration or GitHub protection is disabled.

Residual risks:

- The patch is not upstream-supported or a proof against all ReDoS patterns. It literalizes risky repeated extglobs, changing their matching semantics; normal patterns and actual HOMEX consumers are tested.
- Upstream's `maxExtglobRecursion: false` opt-out remains: never enable it for untrusted patterns. The patch does not make arbitrary attacker-supplied glob syntax safe. HOMEX's known consumers use build/tooling patterns; prior production module-graph analysis did not include these matcher modules, but that is not a universal reachability guarantee.
- `--ignore-scripts` bypasses installation patching. The security gate refuses unpatched bytes; do not build or release from installations that skip this gate. Bare npm audit does not validate installed file contents.

## Remove when an official fix is available

1. Check the advisory and official release diff; select a release that actually fixes this issue (do not invent a version or rename the package).
2. Remove the picomatch override and `postinstall`, regenerate the lockfile with the fixed release, and remove the local patch files and the advisory allowance together. Keep a full audit gate without an exception.
3. Re-run security, unit, E2E, real integration, accessibility, lint, typecheck, build, release and OpenAPI checks on the same candidate. Confirm every resolved picomatch copy is fixed and raw audit is clean.
4. Remove minimatch/glob overrides separately only when all parent ranges resolve fixed versions naturally; do not roll back those security fixes when removing the picomatch patch.

No automatic extension occurs. If no official fix exists at expiry, stop and obtain a new explicit risk decision rather than silently extending the date. Rollback of the local patch must never restore a passing audit gate over unmitigated code.
