# Feature Module Boundaries Specification

## Purpose

Define the two-entry-point contract for every `features/<name>/` module that contains server code. After this change, `index.ts` is structurally client-safe, `server.ts` is server-only, and the `server-only` package guards server code at the module level — making the unsafe pattern impossible by construction, not by discipline.

---

## Requirements

### Requirement: REQ-FMB.1 — Two-Entry-Point Structure

Every `features/<name>/` that contains at least one `*.repository.ts` or `*.service.ts` MUST expose exactly two barrel entry points: `index.ts` (client-safe) and `server.ts` (server-only). Features with no server code (e.g. `reports/`) MUST NOT have a `server.ts`.

#### Scenario: Feature with server code has both entry points

- GIVEN a feature folder such as `features/org-profile/` containing `org-profile.repository.ts`
- WHEN the codebase is scanned for barrel entry points
- THEN `features/org-profile/index.ts` exists AND `features/org-profile/server.ts` exists

#### Scenario: Feature without server code keeps only index.ts

- GIVEN a feature folder such as `features/reports/` with no `*.repository.ts` or `*.service.ts` files
- WHEN the codebase is scanned for barrel entry points
- THEN `features/reports/index.ts` exists AND `features/reports/server.ts` does NOT exist

#### Scenario: Sub-barrels inside accounting are also split

- GIVEN `features/accounting/iva-books/` and `features/accounting/financial-statements/` each containing repository/service files
- WHEN the codebase is scanned
- THEN each sub-barrel folder also contains its own `server.ts` alongside its `index.ts`

---

### Requirement: REQ-FMB.2 — server-only Guardrail

Every `*.repository.ts`, `*.service.ts`, and every `server.ts` barrel MUST have `import "server-only"` as the first non-comment, non-blank statement. This is an absolute prohibition — no such file may be imported into a client bundle.

#### Scenario: Repository file carries the guardrail

- GIVEN `features/org-profile/org-profile.repository.ts`
- WHEN its source is parsed for the first executable statement
- THEN that statement is `import "server-only"`

#### Scenario: server.ts barrel carries the guardrail

- GIVEN `features/sale/server.ts`
- WHEN its source is parsed for the first executable statement
- THEN that statement is `import "server-only"`

#### Scenario: Build fails when client component imports server file

- GIVEN a file with `"use client"` directive that directly imports `features/sale/sale.service`
- WHEN `pnpm build` (Turbopack) is executed
- THEN the build fails with a `server-only` violation error (not a `dns` resolution error)

---

### Requirement: REQ-FMB.3 — index.ts Client-Safety Invariant

Every `features/<name>/index.ts` for a feature that has server code MUST NOT re-export any symbol whose name ends in `Repository` or `Service`, and MUST NOT transitively import any file that begins with `import "server-only"`.

#### Scenario: Boundary test detects server symbol in index.ts

- GIVEN `features/foo/foo.repository.ts` and `features/foo/foo.service.ts` exist
- WHEN `__tests__/feature-boundaries.test.ts` inspects the exports of `features/foo/index.ts`
- THEN the test asserts zero exported identifiers match `/(Repository|Service)$/`
- AND the test fails if any such identifier is found

#### Scenario: Boundary test detects transitive server-only import

- GIVEN `features/bar/index.ts` re-exports a helper that itself imports `features/bar/bar.repository.ts`
- WHEN the boundary test resolves the transitive import graph of `features/bar/index.ts`
- THEN the test fails because a resolved file starts with `import "server-only"`

#### Scenario: Feature without server code is exempt from REQ-FMB.3

- GIVEN `features/reports/` has no `*.repository.ts` or `*.service.ts`
- WHEN the boundary test scans `features/reports/index.ts`
- THEN the feature is skipped (no `server.ts` expected, no client-safety check required)

---

### Requirement: REQ-FMB.4 — Consumer Migration Invariant

Server-side consumers (Server Components, Route Handlers, Services, Repositories) MUST import Repository and Service symbols from `@/features/<name>/server`. Client-side consumers MUST import from `@/features/<name>` (root barrel, no `/server` suffix). No consumer in either category MAY import directly from a leaf file (e.g., `@/features/org-profile/org-profile.service`).

#### Scenario: Server Component imports from /server

- GIVEN a Server Component that needs `OrgProfileService`
- WHEN it is written
- THEN its import statement is `import { OrgProfileService } from "@/features/org-profile/server"`
- AND NOT `import { OrgProfileService } from "@/features/org-profile"`

#### Scenario: Client Component imports from root barrel only

- GIVEN a Client Component (`"use client"`) that needs `logoUploadConstraints`
- WHEN it is written
- THEN its import statement is `import { logoUploadConstraints } from "@/features/org-profile"`
- AND NOT from any `/server` sub-path

#### Scenario: No consumer uses a leaf file path

- GIVEN any file anywhere in `app/` or `features/`
- WHEN imports referencing `@/features/<name>/<name>.service` or `@/features/<name>/<name>.repository` are searched
- THEN zero matches are found (all go through the barrel)

---

### Requirement: REQ-FMB.5 — ESLint Enforcement

The project's ESLint configuration MUST include a `no-restricted-imports` rule that produces a build-breaking error whenever a file containing the `"use client"` directive imports from a path matching `@/features/*/server`. The rule message MUST clearly direct the developer to use `@/features/X` instead.

#### Scenario: ESLint blocks /server import in client file

- GIVEN a file with `"use client"` at the top that contains `import { Foo } from "@/features/sale/server"`
- WHEN ESLint is run (`pnpm lint`)
- THEN ESLint reports an error on that import line with the configured message
- AND the CI lint step fails

#### Scenario: ESLint allows /server import in server file

- GIVEN a Server Component or Route Handler with no `"use client"` directive importing from `@/features/sale/server`
- WHEN ESLint is run
- THEN no error is reported for that import

#### Scenario: ESLint rule disallows type-only /server imports too

- GIVEN a `"use client"` file using `import type { SaleService } from "@/features/sale/server"`
- WHEN ESLint is run
- THEN the error is still reported (the rule applies regardless of `type`-only qualifier)

---

### Requirement: REQ-FMB.6 — Machine-Checked Boundary Test in CI

A test file at `__tests__/feature-boundaries.test.ts` MUST exist and MUST run in CI as part of `pnpm test`. It MUST assert both invariants: (a) no `index.ts` exports a `Repository` or `Service` symbol; (b) no `index.ts` transitively imports a `server-only`-guarded file. The test MUST skip features with no server code.

#### Scenario: Boundary test starts RED before any split

- GIVEN the boundary test file has been added but no feature has been split yet
- WHEN `pnpm test` is run
- THEN the test fails for all 26 unsplit features (this is the expected RED state)

#### Scenario: Boundary test goes GREEN feature by feature

- GIVEN `features/org-profile/` has been split (batch 1 complete)
- WHEN `pnpm test` is run
- THEN the boundary test passes for `org-profile` and still fails for the remaining unsplit features

#### Scenario: Boundary test is fully GREEN after all batches

- GIVEN all 26 features plus accounting sub-barrels have been split
- WHEN `pnpm test` is run
- THEN the boundary test passes for every feature with server code
- AND CI is green

---

### Requirement: REQ-FMB.7 — Build-Time Error on Violation

If any module with `import "server-only"` is pulled into the client-side bundle by Turbopack, the build MUST fail with an explicit `server-only` error — not a silent no-op or an obscure `dns`/`node-builtin` resolution error.

#### Scenario: Accidental client import triggers clear error

- GIVEN `features/purchase/server.ts` carries `import "server-only"`
- WHEN a Client Component imports from `@/features/purchase/server` and `pnpm build` runs
- THEN Turbopack fails with a message referencing `server-only` (not `dns`)
- AND the error makes the violation obvious to the developer

#### Scenario: Properly split index.ts does not trigger server-only error

- GIVEN `features/purchase/index.ts` exports only types, validation, and constants
- WHEN a Client Component imports from `@/features/purchase` and `pnpm build` runs
- THEN the build succeeds with no `server-only` or node-builtin error

---

### Requirement: REQ-FMB.8 — Per-Batch Rollback Granularity

Each feature split (one feature per commit) MUST leave the full test suite and the production build green independently. Reverting a single feature's commit with `git revert <sha>` MUST NOT break any other feature's tests or build.

#### Scenario: Reverting batch N does not break batch N-1

- GIVEN batches 1 through N have been committed and `pnpm test && pnpm build` is green
- WHEN `git revert <batch-N-sha>` is applied
- THEN `pnpm test && pnpm build` remains green for all features in batches 1 through N-1

#### Scenario: Full rollback in reverse order is valid

- GIVEN all 27 commits (26 features + 1 ESLint rule) have landed
- WHEN each commit is reverted in reverse order (27 → 1)
- THEN `pnpm test && pnpm build` is green after each individual revert

---

### Requirement: REQ-FMB.9 — Vitest Mock Path Consistency

Any `vi.mock("@/features/<name>")` or `vi.mock("@/features/<name>/server")` call in test files MUST target the correct barrel. Mocks for Repository or Service symbols MUST reference `@/features/<name>/server`. Mocks for types, validation, or constants MUST reference `@/features/<name>`.

#### Scenario: Existing mock updated in same commit as split

- GIVEN a test file that mocks `@/features/org-profile` to stub `OrgProfileService`
- WHEN the `org-profile` barrel split commit is applied
- THEN the mock path is updated to `@/features/org-profile/server` in that same commit
- AND `pnpm test` passes after the commit

#### Scenario: Wrong mock path causes test failure (not silent pass)

- GIVEN a test mocks `@/features/foo` but the real symbol moved to `@/features/foo/server`
- WHEN `pnpm test` is run
- THEN the test fails with an import or `undefined` error — it does NOT silently pass with an unmocked real module

---

## Out of Scope

| Item | Decision |
|------|----------|
| Stub `server.ts` for features without server code (e.g. `reports/`) | Rejected — YAGNI; no `server.ts` for type-only features |
| Sub-splitting `features/shared/server.ts` into `repositories.ts` / `services.ts` | Rejected — single `server.ts`, YAGNI (ADR-6) |
| Moving repositories/services to a separate `backend/` layer | Rejected in proposal — out of scope for this change |
| CI check beyond ESLint + boundary test (e.g., custom Turbopack plugin) | Out of scope — ESLint + `server-only` build error is sufficient |
| ESLint rule applied per-directive (granular `"use client"` detection in flat config) | Best-effort; fallback to path-glob exemptions if directive detection is complex |
| Framework migration, Prisma changes, feature renames | Out of scope |
| Client consumer import path changes (they stay on `@/features/X`) | Out of scope — client consumers need no migration |
| `import type` bypass workarounds | Covered by REQ-FMB.5 — type imports are also blocked by the ESLint rule |
