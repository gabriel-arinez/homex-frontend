# Product Quick View

Objective: unify read-only product detail previews across quotes, the contextual catalog selector, and the product list.
Branch: `feat/voz-panel-unificado-20261105` · Delivery: ask-on-risk · Chain strategy: stacked-to-main · Forecast: ~1,600 authored changed lines · Runner: npm / Vitest / Playwright.

## Specs

### S1 — Shared responsive consultation view

Authorized scope: reusable product quick-view presentation and only a narrowly scoped modal variant if required. The user asked to “Crea un componente reutilizable, por ejemplo ProductoVistaRapida.vue, con adaptadores para los distintos contextos.”
Acceptance: one shared viewer, max-width around 1120–1200 px on desktop, responsive columns, structured commercial/identification/technical information, accessible images and no-images state, clear/light and dark theme, sticky header/footer with scrollable content, keyboard/focus/Escape support, and loading/error/retry/empty states where data is fetched. Do not expose private images or auth tokens, add dependencies, or broadly change `Modal.vue`.
Checks: focused unit tests; `npm run type-check`; `npm run lint:check`; `npm run format:check`; `npm run build`.

### S2 — Preserve quote snapshots and furniture detail

Authorized scope: editor read view and existing quote presentation services only. The user requires “Importante: distingue expresamente los datos actuales del catálogo de los valores históricos o negociados de la proforma. No sustituyas precios cotizados por precios vigentes.” Preserve “TOTAL_NEGOCIADO” and current numeric precision; show line type, description, quantity/unit, quoted unit price, discount and estimated/historical negotiated amount. Present furniture dimensions as independent labeled fields with units, and components structurally; keep unknown/historical attributes in a safe readable additional section and hide optional empty sections.
Acceptance: existing edit-line functions and their restrictions remain unchanged; a missing or failed product-master fetch never prevents reading a saved quote line.
Checks: regression/unit tests for historic lines, TOTAL_NEGOCIADO, incomplete/extended furniture specs, and edit restrictions.

### S3 — Integrate all three entry points

Authorized scope: `ProformaEditorView.vue`, `CatalogoContextual.vue`, `ProductosListView.vue`, and relevant product detail navigation. The user requires “unificar su presentación en tres ubicaciones”: quote lines including made-to-order furniture; contextual catalog selector; product list in table and card modes. Keep contextual “Seleccionar para cotizar” or “Ir a línea” actions and provide “Ver ficha completa” from the viewer while preserving full-product navigation.
Acceptance: same viewer component across all entry points; product list can open quick view from both layouts without removing full detail navigation; contextual actions and permissions remain as today.
Checks: tests for opening/closing in each location, categories, permissions/actions, and no regressions in Proformas/Productos.

### S4 — Reuse frontend services and verify scope

Authorized scope: existing frontend product, gallery/image services/components and API contracts for inspection; no backend/NLP or unrelated changes unless a demonstrated technical necessity is reported and authorized. The user requires “No modifiques backend, NLP ni funcionalidades ajenas al alcance sin una necesidad técnica demostrable.”
Acceptance: reuse sufficient existing endpoints/types; avoid unnecessary requests and ignore stale async responses. Do not add dependencies.
Checks: gallery present/missing/failure behavior; responsive/theme/accessibility checks; run available TypeScript, lint, format, unit, E2E/integration and build verifications, reporting unavailable or environment-blocked checks honestly.

## Tasks

- T1 — S1,S2 — inline — complete; commit pending slice commits — shared component, data model, and safe quote/furniture presentation. RED: missing component import; GREEN: viewer unit suite.
- T2 — S3,S4 — inline — complete; commit pending slice commits — connected editor, contextual selector, and both product-list layouts.
- T3 — S1-S4 — inline — verified with environment advisories — regression coverage and applicable verification. Risk: item 4 (async gallery requests and stale-response ordering).

## Log
- L1 — User request (verbatim): “2. Objetivo\n\nRediseñar completamente el modal de visualización rápida de productos de HOMEX y unificar su presentación en tres ubicaciones:\n\nProductos incorporados a una proforma, incluidos muebles a pedido.\n\nSelector de productos de catálogo dentro del editor de proformas.\n\nBandeja principal de Productos, tanto en vista de tabla como de tarjetas.” Full acceptance requirements remain in the conversation prompt dated 2026-11-06.
- L2 — Read-only map confirms the contextual selector already has a preview modal, editor quote-line view separates saved negotiated values from current catalog master data, and main product list has independent card/table render paths. Existing product and gallery frontend endpoints appear sufficient; verify details while implementing.
- L3 — Built one shared `ProductoVistaRapida` and used opt-in `extraWide`/`stickyFrame` Modal styling. Current catalog list/detail, contextual selector, and quote-line data stay separate; historic totals continue using `totalEstimadoLinea` and saved `total`. Product and furniture gallery endpoints reuse existing authorized services; inline image zoom avoids a nested modal.
- L4 — Independent verification reproduced a stale nested-gallery-fallback error. Added a request-generation guard to the fallback catch; regression RED reproduced the stale error and focused GREEN passed (8 component tests). Final focused suite after fix: 5 files / 29 tests passed; type-check passed.
- L5 — `npm run test:e2e -- --reporter=line`: 107 passed. `npm run test:a11y -- --reporter=line`: 29 passed. `npm run build`: passed. Full unit suite: 265 passed; unrelated failure in untouched `src/tests/prf04/asistidas.spec.ts:149` (`reinterpretar` button is undefined). `npm run lint:check` remains blocked by untouched unused `Check` import in `src/modules/pedidos/views/PedidoDetailView.vue`; full `npm run format:check` reports existing formatting warnings in unrelated files and `.atl/skill-registry.md`, while all feature files pass targeted Prettier check. `npm run test:integration`: 12 failed / 2 did not run; real backend login/fixtures unavailable, including missing `HOMEX_CATALOGO_AUDIO_DIR`, `HOMEX_CATALOGO_PASSWORD`, WAV fixtures and redirect to `/login` instead of `/resumen`.
- L6 — The feature forecast exceeds the ~400-line delivery budget. User selected `stacked-to-main`; prepare focused PR-ready slices ordered by dependency. Creating/pushing PRs remains unapproved remote work.
- L7 — User selected the `stacked-to-main` chain strategy. Local work-unit commits may be prepared; no push or PR creation without explicit remote authorization.
- L8 — Screenshot review found private gallery images were loaded through plain `<img>` URLs without the authenticated blob-fetch path already implemented by `GalleryPhoto.vue`. Reused that component for main and thumbnail images, surfaced load/error events for retries, added variant fallback when the largest variant fails, and removed sticky positioning that clipped the tall gallery panel. Regression RED reproduced variant failure; GREEN focused tests 10 passed; type-check, focused quick-view E2E (1 passed), and build passed. A later independent probe found a closed-view request still dispatched its fallback; added the guard immediately after primary resolution, with RED then GREEN and 15 focused tests passed.
