# Proposal: Client/Server Barrel Split Across Feature Modules

## Intent

Commit `7f36e28` shipped a Client Component importing a plain constant (`logoUploadConstraints`) from `@/features/org-profile`. Turbopack followed the barrel's full module graph — which re-exports `OrgProfileRepository` → `lib/prisma.ts` → `pg` → `dns` — and failed with `Module not found: Can't resolve 'dns'` in the browser bundle. Hotfix `ef30727` redirected imports to leaf files, but 26 of 27 feature barrels share the same dangerous shape: `index.ts` co-exports server-only Repository/Service alongside client-safe types/validation. This change makes the unsafe pattern impossible by construction, not by discipline.

## Scope

### In Scope
- Split 26 feature barrels into `index.ts` (client-safe: types, validation, constants) and `server.ts` (Repository, Service).
- Same split for `features/shared/` (types/permissions/utils stay in `index.ts`; repositories and server services move to `server.ts`).
- Add `import "server-only"` to every `*.repository.ts`, `*.service.ts`, and the new `server.ts` entry points as a fail-fast guardrail.
- Migrate all server-side consumers (~78+ imports under `app/` and sibling `features/*/`) from `@/features/X` to `@/features/X/server` for Service/Repo symbols.
- Update test files and mocks to the new import paths.

### Out of Scope
- Framework migration, Prisma setup changes, feature renames, or folder restructuring beyond the barrel split.
- Moving repositories/services out of `features/` into a separate `backend/` folder (considered, rejected below).
- ESLint rules and CI enforcement (mentioned as open questions, decided in design).
- Client consumer migrations — they stay on `@/features/X` (which becomes guaranteed safe).

## Capabilities

### New Capabilities
- `feature-module-boundaries`: Defines the two-entry-point contract for every `features/<name>/` module — `index.ts` is client-safe, `server.ts` is server-only, and the `server-only` package guards server code at the module level.

### Modified Capabilities
- None. This is a pure infrastructure refactor with no business-capability behavior changes.

## Approach

Two-entry-point pattern per feature:

```
features/<name>/
  index.ts        ← public SDK: types + validation + constants (client-safe)
  server.ts       ← Repository + Service re-exports, with `import "server-only"`
  *.repository.ts ← `import "server-only"` at top
  *.service.ts    ← `import "server-only"` at top
```

`server-only` is a Next.js 16 built-in guardrail (internal handling per `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`): any module marked with `import 'server-only'` triggers a build-time error if pulled into the client graph. Defense in depth — the barrel split prevents the bundling, `server-only` makes misuse fail fast with a clear message.

Migration is batched by consumer blast radius (smallest first: org-profile already done → shared → sale/payment → accounting last with 67 consumers). Each batch: add `server.ts`, stamp `server-only`, grep-sweep server consumers, run tests.

Strict TDD is active downstream: sdd-apply will require RED (failing build or runtime assertion proving the boundary) → GREEN (minimum split) → REFACTOR per batch.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `features/*/index.ts` (26 files) | Modified | Strip server exports |
| `features/*/server.ts` (26 new) | New | Re-export Repository + Service under `server-only` |
| `features/*/*.repository.ts`, `*.service.ts` | Modified | Add `import "server-only"` top line |
| `features/shared/index.ts`, `features/shared/server.ts` | Modified + New | Split `export *` fan-out |
| `app/**/*.ts`, `features/*/` cross-feature imports | Modified | ~78+ import path updates to `/server` |
| `__tests__/`, `*.test.ts`, `vitest.setup.ts` | Modified | Mock paths updated |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Large mechanical diff introduces regressions | Med | Batch per feature, run full test suite each batch, tests-first per TDD mode |
| Missed consumer imports (mixed barrel + direct paths) | Med | Grep sweep for `@/features/X` after each batch; `server-only` triggers build error if one slips |
| `accounting` blast radius (67 consumers) | High | Land accounting last, in its own PR, behind a dedicated feature branch |
| `server-only` package not installed | Low | Next.js 16 handles it internally; install if TS `noUncheckedSideEffectImports` complains |
| Test mocks break silently | Low | Run test suite per batch; TDD red-first ensures mocks are exercised |

## Rollback Plan

Each batch lands as an independent commit. Rollback = `git revert <batch-commit>` for the offending feature; no cross-batch coupling. If the entire change must be reverted post-merge, revert in reverse batch order (largest blast radius first). `ef30727`'s hotfix stays regardless — it's a strict improvement independent of this refactor.

## Dependencies

- Next.js 16.2.1 `server-only` handling (built-in, confirmed in docs).
- No new npm packages required unless TS strict side-effect imports demand `server-only` installation.

## Success Criteria

- [ ] No Client Component imports a module whose transitive graph reaches `lib/prisma.ts`.
- [ ] Every `*.repository.ts` and `*.service.ts` has `import "server-only"` as its first non-comment line.
- [ ] Every `features/<name>/` with server code has a `server.ts` entry; `index.ts` has zero server imports.
- [ ] Zero `Module not found: Can't resolve 'dns'` (or similar node-builtin errors) across `pnpm build` and dev.
- [ ] Full test suite green after each batch; no new `any` or `// @ts-ignore` introduced.
- [ ] Grep `from "@/features/[a-z-]+"` in Client Components returns only paths that end at `index.ts` (no transitive server pull).

## Open Questions (deferred to sdd-design)

1. Naming: `server.ts` vs `server/index.ts` vs `index.server.ts`?
2. Should every feature have an identical-shaped `index.ts`, or can features with no client-safe exports (e.g., `rag`) have an empty `index.ts` that re-exports nothing?
3. `features/shared/` — single `server.ts` or split further (e.g., `server/repositories.ts`, `server/services.ts`)?
4. Migration cadence: big-bang single commit, batched per-feature, or batched per-domain (accounting / org / sales)?
5. Post-migration: ESLint `no-restricted-imports` rule to ban `@/features/*/server` from Client Components?
6. CI check that Client Components never import from a feature `index.ts` when that feature has a `server.ts`?
7. Do we also tighten `features/reports/` (safe today, no Repository/Service) with a stub `server.ts` for consistency, or leave it as types-only?
