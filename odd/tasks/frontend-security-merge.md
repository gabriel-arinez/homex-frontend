# Frontend dependency security and main integration

Objective: resolve PR #70 security blocking and integrate the existing feature, without unrelated functionality.
Branch: feat/voice-hitl-review. Delivery: exception-ok, existing PR #70 (previous maintainer size exception). Forecast: 350–550 authored lines plus lockfile. Runners: Node security tests, npm scripts, GitHub Actions real integration.

## Specs

S1. User request (verbatim):

```text
# HOMEX — Resolver dependencias y fusionar Frontend a main

Encárgate de **resolver definitivamente el bloqueo de seguridad del PR #70 y completar su fusión a `main`**, para continuar desarrollando las demás funcionalidades de HOMEX.

1. **Resolver las dependencias vulnerables:** corregir `minimatch` y `glob` mediante actualizaciones compatibles. Para `picomatch`, implementar la solución centralizada más segura, mantenible y reversible disponible, sin esperar indefinidamente una actualización oficial.

2. **Priorizar una corrección real:** evaluar actualizaciones, sustituciones o parches verificables. Si únicamente es viable una excepción temporal, limitarla al aviso específico, documentar el riesgo, establecer su caducidad y mantener activa la auditoría general. No presentar una excepción como vulnerabilidad corregida.

3. **Garantizar futuras actualizaciones:** preparar la solución para retirarla fácilmente cuando los responsables de `picomatch` publiquen una versión corregida, sin afectar el funcionamiento de HOMEX.

4. **Verificación integral:** ejecutar `npm audit`, pruebas unitarias, E2E, integración real, accesibilidad, lint, typecheck, build y contratos OpenAPI. No omitir verificaciones ni ocultar fallos.

5. **Completar la integración:** actualizar el PR #70, verificar las CI remotas y las aprobaciones obligatorias. Cuando se cumplan las condiciones de fusión, integrarlo a `main`.

6. **Sincronización final:** dejar `homex-frontend`, `homex-backend` y `homex-nlp` actualizados en `main`, con worktrees limpios y dependencias compatibles.

7. **Informe final breve:** indicar la solución aplicada, vulnerabilidades corregidas o temporalmente aceptadas, resultados de CI, enlace del PR, commits definitivos y estado de los tres repositorios.

**Objetivo prioritario:** completar el merge del Frontend y dejar HOMEX listo para continuar desarrollando otras funcionalidades desde `main`, sin arrastrar el bloqueo actual.

No introducir nuevas funcionalidades ni cambios ajenos a la integración. No desactivar globalmente los controles de seguridad ni omitir protecciones de GitHub. Si alguna decisión exige aceptar un riesgo de seguridad residual, solicita autorización explícita antes de aplicarla.
```

S2. User answered `si` to authorization to use the current authenticated gh session for CI/reviews, publishing PR70 changes, merging when eligible, and synchronizing all three HOMEX remotes.

S3. User answered `si` to: "¿Autorizás adoptar ese parche temporal tras verificarlo y, **si la auditoría sigue señalándolo**, aplicar una excepción exclusivamente para `GHSA-fc5q-39xc-vjpf`, con caducidad el **17/12/2026**, manteniendo activa la auditoría general y documentando el riesgo residual?"

## Tasks

T1 | S1,S3 | inline: one security behavior with tests/docs; no writer trigger | done | security work unit (commit recorded after creation); reproduce raw audit, adversarial RED, compatible dependency updates, hash-bound centralized patch and expiring advisory-only gate. Risk: items 2,5 (security and dependencies/CI).
T2 | S1,S2,S3 | delegated verification: named high-risk items 2,5; long full CI | in_progress | all required checks, independent security verifier, update PR70, check protections/reviews, merge only when passing.
T3 | S1,S2 | inline git synchronization and final readback | pending | verify main CI and three main revisions/clean status; preserve pre-existing local changes.

## Log

L1. Original request quoted verbatim in S1. Subsequent authorizations quoted in S2/S3.
L2. Baseline frontend 83efdc3. PR70 open; all current substantive CI jobs successful except dependency-audit. Raw npm audit reproduced three root advisories (25 propagated findings). No official picomatch fix; upstream PR235 closed/unmerged. RDD globally off; unchanged. Backend/NLP already on clean main. Frontend pre-existing modified .atl skill registry files must not be committed or destroyed.
L3. Proposed implementation: retain authentic picomatch4.0.7 identity and registry integrity, apply exact hash-bound upstream parser changes to every locked installation in postinstall, verify installed bytes in audit gate, preserve raw npm audit output and suppress only authorized GHSA until expiry. No invented package version or broad audit disable. minimatch/glob updated through centralized overrides only after compatibility verification. Safe extglobs and consumer checks must still pass. Expiry fails closed at 2026-12-17T00:00:00Z.

L4. Observed RED: original4.0.7 matches aa with +(*a), contrary to mitigation; initial security module tests could not load before implementation. GREEN: 9 focused security tests; 417 unit tests/68files; typecheck, lint, build, contract generation, exact backend-main OpenAPI equality all pass. Format first failed solely on two pre-existing .atl changes, preserved without edits in stash@{0}; subsequent full format passes. Live security gate exits0, raw audit reports19 propagated high findings from the sole authorized picomatch advisory; minimatch/glob advisories absent. npm install warns that its default allowScripts blocks the pre-existing msw postinstall; no permissions were changed.
L5. Independent security verifier found no blockers. Own isolated probes confirmed CLI accepted-only/unknown/malformed/transport behavior, expiry boundary, hash-bound idempotence/version drift, actual glob/minimatch sample compatibility. Parent reran9focused tests successfully. The applied parser SHA256 exactly matches upstream commit235 bytes. Normal matcher differential versus original package:11identical results. RDD remains globallyoff. Remote E2E/a11y/real-integration/release/main checks still pending, not claimed passing for this candidate.
