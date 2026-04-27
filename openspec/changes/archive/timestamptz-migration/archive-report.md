# Archive Report — timestamptz-migration

**Date archived**: 2026-04-27
**Status**: ARCHIVED
**PR**: https://github.com/Marco-T2/avicont-ia/pull/1
**Verify result**: 8 PASS / 3 WARNING / 0 CRITICAL

## Phases completed

| Phase | Status | Date | Artifact |
|-------|--------|------|----------|
| sdd-init (cached) | DONE | (previous) | `sdd-init/avicont-ia` |
| sdd-explore | DONE | 2026-04-26 | `exploration.md` |
| sdd-propose | DONE | 2026-04-26 | `proposal.md` |
| sdd-spec | DONE | 2026-04-26 | `specs/persistence-timezone/spec.md`, `specs/audit-module/spec.md` |
| sdd-design | DONE | 2026-04-26 | `design.md` |
| sdd-tasks | DONE | 2026-04-26 | `tasks.md` |
| sdd-apply | DONE | 2026-04-26..27 | 12 commits (e9cec08..904a429) |
| sdd-verify | DONE | 2026-04-27 | 8 PASS / 3 WARNING / 0 CRITICAL |
| sdd-archive | DONE | 2026-04-27 | this file |

## Specs canonized

- `openspec/specs/persistence-timezone/spec.md` (NEW capability — 6 REQs, 18 scenarios)
- `openspec/specs/audit-module/spec.md` (MODIFIED — REQ-AUDIT.1 with `::timestamptz` modification + A1-S7/S8/S9 added)

## Commits delivered (12)

| Hash | Subject |
|------|---------|
| `e9cec08` | feat(prisma): annotate DateTime fields with @db.Timestamptz(3) |
| `a0b0322` | docs(sdd): correct counts in timestamptz-migration plan (49/16) |
| `4c6bc78` | docs(sdd): plan for timestamptz-migration |
| `8546b9d` | feat(db): migrate DateTime columns to TIMESTAMPTZ(3) |
| `4b4fdbf` | docs(audit): correct A1-S7/S8/S9 failure mode in spec |
| `7497abb` | docs(audit): consolidate A1-S7 into A1-S8 in spec |
| `80be86e` | docs(sdd): persist learnings.md for timestamptz-migration |
| `6fe4eef` | fix(db): force session timezone UTC in Prisma adapter |
| `6c862bc` | fix(audit): cast cursor as timestamptz for ANSI conformance |
| `3db4614` | docs(sdd): add learning #3 (root cause was Prisma adapter, not cursor) |
| `c57d651` | docs(sdd): apply verify recommendations (audit note + table name fix) |
| `904a429` | docs(timezone): add REQ-TZ.6 for session UTC invariant on Prisma adapter |

## REQs delivered

- **persistence-timezone**: REQ-TZ.1 a REQ-TZ.6 (6 REQs, 18 scenarios)
- **audit-module**: REQ-AUDIT.1 modified — cursor usa `::timestamptz`; A1-S7 (invariante consolidado), A1-S8 (paginación cross-page sin duplicados), A1-S9 (verificación negativa shift expansivo) añadidos. Tests A1-S8 y A1-S9 NO implementados — ver nota en spec.

## Aprendizajes (de learnings.md)

1. **Causa raíz**: el adapter `@prisma/adapter-pg@7.7.0` descarta información de timezone en ambas direcciones del wire — `formatDateTime` envía strings naive (sin `Z`) y `normalize_timestamptz` reemplaza el offset por `+00:00` via regex. La causa raíz era el adapter, no el tipo de columna ni el cursor directamente.
2. **Specs de bugs timezone/paginación requieren verificación empírica**: el failure mode inicial (A1-S7 como "filas omitidas") era incorrecto — el bug real es expansivo (incluye filas extra → duplicados cross-page). La corrección empírica fue posterior al TDD gate.
3. **El gate TDD detectó problemas en specs, no en código**: el ciclo RED/GREEN encontró que los specs tenían inconsistencias (failure modes incorrectos, consolidación A1-S7→S8) antes de que el código fuera un problema.

## Decisiones documentadas

- Tests A1-S8/A1-S9 NO implementados — justificación: bajo `session_timezone='UTC'` (forzado por config del adapter), `::timestamp` y `::timestamptz` producen resultados idénticos; tests no serían diferenciales (ver commit `6c862bc` body).
- A1-S7 consolidado en A1-S8 — el fenómeno físico del bug no genera assertion diferencial independiente; A1-S7 se preserva como descripción del invariante (commit `7497abb`).
- `pg_dump` omitido — base de desarrollo, NO aplica a producción. Prod maneja sus propias migraciones vía `prisma migrate deploy` (ver PR notes).
- `session_timezone='UTC'` forzado en adapter (no en DB-level) — contiene el alcance al pool de conexiones de la app sin afectar psql CLI, scripts externos, futuros servicios.

## Outstanding items (deuda técnica separada)

- 4 tests pre-existentes fallando (no relacionados al SDD): matrix-warnings, feature-boundaries, organizations route
- Refactor de `toNoonUtc()` — la función sigue siendo válida pero es candidata a refactor semántico
- Normalización de `dueDate` con `toNoonUtc()` en `receivables.repository.ts` — deuda técnica documentada en out-of-scope del spec
- Eliminación del patrón UTC-noon — cambio de semántica que requiere su propio SDD
- Resolución de `TZ=America/La_Paz` en proceso server-side (`startOfMonth`/`endOfMonth`) — deuda técnica documentada en `lib/date-utils.ts`
- Implementación de tests diferenciales A1-S8/A1-S9 — requiere infraestructura de test con `SET LOCAL timezone='America/La_Paz'`

## State persisted

- Engram topic_key: `sdd/timestamptz-migration/state` → `ARCHIVED`
