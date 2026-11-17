# Voice HITL main integration

Objective: publish and integrate the verified existing branches in NLP → backend → frontend order.
Delivery: exactly one PR per repository, approved no-issue/size exceptions; preserve mandatory GitHub CI/protections. Runners: GitHub Actions, local focused checks.

## Specs

S1. Authorized request (verbatim):

```text
# HOMEX — Integración definitiva a main

Encárgate de completar la integración de `feat/voice-hitl-review` en los tres repositorios HOMEX.

1. **Verificación previa:** comprobar que las ramas estén actualizadas, limpias y sean compatibles con `main`, sin cambios pendientes ni conflictos.

2. **Publicación y PR:** publicar las tres ramas y crear sus respectivos Pull Requests hacia `main`, con descripciones claras de los cambios y verificaciones.

3. **CI y dependencias:** comprobar que todas las pruebas, builds, contratos OpenAPI y GitHub Actions estén correctos. Verificar especialmente la compatibilidad del Backend con NLP `0.1.29` y del Frontend con Backend.

4. **Correcciones necesarias:** resolver cualquier fallo de integración, dependencia, configuración o CI detectado, sin introducir funcionalidades nuevas ni desactivar validaciones.

5. **Fusión controlada:** fusionar los PR estrictamente en este orden:
   - NLP → `main`
   - Backend → `main`
   - Frontend → `main`

6. **Verificación posterior:** después de cada fusión, comprobar las CI y la compatibilidad antes de continuar con el siguiente repositorio.

7. **Estado final:** dejar los tres repositorios completamente integrados, actualizados y sincronizados con sus respectivas ramas `main`, sin cambios pendientes ni problemas de integración.

8. **Informe:** proporcionar los enlaces de los PR, commits definitivos, resultados de las CI y confirmación del estado final.

**Objetivo:** dejar HOMEX correctamente integrado, actualizado y funcionando con los tres repositorios en `main`. Respetar las protecciones y aprobaciones obligatorias; detenerse únicamente ante un bloqueo que no pueda resolverse sin autorización.
```

## Tasks

T1 | S1 | inline GitHub publication after read-only policy map | done | NLP PR47, backend PR62, frontend PR70
T2 | S1 | inline NLP PR/CI and main merge, verify main CI before T3 | done | PR47 merge5fa4ace; main CI44129312955 success
T3 | S1 | inline backend PR/CI with NLP0.1.29 and exact frontend peer, merge and verify main | pending
T4 | S1 | inline frontend PR/CI with exact backend main, merge and verify main | pending
T5 | S1 | inline final cross-repo CI, local main synchronization and clean readback | pending

## Log

L1. Original request is quoted verbatim in S1. User subsequently answered `si` to current authenticated gh-session authorization for these three repositories, and `si` to exactly one PR per repository without an approved linked issue and with size exception. Those waivers do not waive any CI or repository protection/review.
L2. Preflight: all three existing feature branches clean; git fetch completed, origin/main fully contained; zero main-only commits and merge-tree exit0 each. NLP8/backend10/frontend13 feature commits. Approximate full changed-line counts1012/3251/7631 include generated files/docs. No main protections/rulesets and no existing feature PRs found; no approved issue open/closed. No unrelated PRs will change. Parent owns remote/git mutations; delegated read-only map was used for CI/policy mapping.
L3. Actual main CI must be verified after each ordered merge. Ordinary backend/frontend CI uses historical pinned peer refs; workflow_dispatch supports integration_peer_ref for exact final source/merged peer compatibility. Preserve historical verification gates; fix only demonstrated CI/integration issues. RDD remains globallyoff, independent checking retained for any high-risk CI/dependency correction.

L4. Published all three branches and created NLP https://github.com/gabriel-arinez/homex-nlp/pull/47, backend https://github.com/gabriel-arinez/homex-backend/pull/62, frontend https://github.com/gabriel-arinez/homex-frontend/pull/70. Explicit maintainer waivers recorded in each PR; exactly one type:feature label and size:exception. No merge performed; GitHub CI pending.

L5. NLP PR47 merged via merge commit5fa4ace20e69bf1ba876b59b61a7edac4118ed15 after all current PR checks passed. Post-merge main CI44129312955 success confirms ordered step1 before any backend/frontend merge. Actual initial failure was a stale current release pointer25; corrected in2123155, preserving published25manifest and all29archive members. SOURCE_DATE_EPOCH=0 canonicalCIhasha559... differs only ZIPtimestamps from existing backendvendor4e8...; both same36members. RED2/GREEN2 plus1211fullsource tests and independent exact-epoch assertion passed.
L6. Backend initialf09CI fails oldfrontendOpenAPI; frontend initialcontractCI fails oldbackendOpenAPI. Current local snapshots match exactly. Plan immutablepeerupdates plus explicitfinalmain dispatch. Gitleaks flags exactlytwo historical unsignedmockJWTs, verifiedalg:none/literal fake signature; scopedexistingfingerprint convention preserveshistory/securityworkflow. Obsolete frontend integration runs44126892011/44126873829 cancelled, never counted as passing. Syntheticcommercialdictations were too short despite valid-durationaudio; backendfixturetexts/regressiontest corrected in7c9e748 withoutchanging appvalidation. CI/security config corrections remain independently checked before publication/merge.

L7. NLP original main checkout fast-forwarded to5fa4ace and its offline installed runtime reports0.1.29. Two pre-existing auto-generated local skill-index files under .atl were preserved byte-for-byte and excluded by their exact paths in repository-local info/exclude (no application/source path hidden). Local main has zero divergence and no pending source changes. NLP CI correction independently verified; frontend peer/security correction independently verified and committed7d19395. Backend paired immutable frontend-pin correction passed scoped independent checking. No backend/frontend merge yet.

L8. Frontend CI/security correction7d19395 and backend fixture7c9e748/corresponding pinned-peer correction passed independent checks. Strict current OpenAPI consumer verification succeeds against exact frontend7d19395 and backend7c9e748. All workflow gates/manual overrides remain active; only two exact historical unsigned-test-token fingerprints were added to the pre-existing ignore convention. Replacement branch/PR CI must pass before backend merge.
