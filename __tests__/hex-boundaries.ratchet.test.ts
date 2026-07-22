/**
 * Hexagonal boundary RATCHET — freezes R1/R2/R4/R5 debt at its current level
 * and lets it move in ONE direction only: down.
 *
 * WHAT THIS IS
 * `eslint.config.mjs` declares four hexagonal boundary rules over `modules/**`
 * (R1 domain-inward, R2 application→domain-only, R4 presentation→application,
 * R5 no-Prisma-outside-infrastructure). The repo currently violates them 63
 * times (frozen at 138 when this ratchet was written; the [DTO] cluster
 * paydown brought it to 131; the M1 barrel-hide paydown brought it to 130;
 * the M2 Decimal-via-decimal.js paydown brought it to 120; the D4 paydown
 * (payment shortcut-source query port) brought it to 119; the D1 paydown
 * brought it to 101 — accounting's Prisma enum imports now go through
 * domain-owned mirrors in
 * `modules/accounting/domain/value-objects/account-classification.ts`, kept
 * honest by `modules/accounting/__tests__/enum-domain-mirror.sync.test.ts`.
 * D1 also landed the fix for `accounting/presentation/validation.ts:R5` whose
 * first attempt was reverted: routing enums through composition-root.ts
 * dragged a real import cycle in and crashed with a TDZ ReferenceError at
 * runtime; the leaf enum-mirror file is the dedicated enum-only home that
 * revert note asked for; the [EXPORT] cluster paydown brought it to 83 — the
 * 7 report families (ledger, contact-ledger, equity-statement,
 * initial-balance, trial-balance, worksheet, financial-statements) each got a
 * narrow `XxxExporterPort` (domain) + a thin adapter (infrastructure)
 * delegating to the EXISTING pure PDF/XLSX exporter functions, unchanged;
 * application services gained injected `exportPdf`/`exportXlsx` methods
 * (generalizing the pattern `FinancialStatementsService` already used), and
 * `presentation/server.ts` barrels stopped re-exporting the raw exporter
 * functions — route.ts call sites now call `service.exportPdf(...)` instead.
 * The 3 `make-*-service.ts:R2` "reverse composition-root delegation"
 * violations (equity-statement/initial-balance/trial-balance) are a DIFFERENT
 * pattern (application reaching UP into presentation/composition-root) and
 * were deliberately left untouched by this paydown; the [REVERSE-WIRING]
 * paydown then closed those 3 by inverting the wiring — application/
 * make-*-service.ts is now the real injectable, port-typed factory and
 * presentation/composition-root.ts instantiates the concretions and calls
 * it — bringing the count to 80; the [CACHE] type-only paydown relocated the
 * `OrgMatrix` TYPE from infrastructure/permissions.cache.ts into
 * domain/permissions.ts (with a back-compat re-export kept on the cache),
 * closing the 4 type-only R2 import sites and bringing it to 76; the
 * organizations D4 paydown moved the `Organization`/`OrganizationMember`/
 * `User`/`CustomRole` MODEL types into domain-owned structural interfaces in
 * `modules/organizations/domain/types.ts`, bringing it to 72; the [BARREL]
 * Group A paydown repointed ai-agent's and tags' static cross-module type
 * imports (plus tags' `slugify` value import) from sibling `presentation` /
 * `presentation/server` barrels to the actual domain/application files,
 * bringing it to 60; the R5 enum-repoint paydown repointed ai-agent's four
 * Prisma enum imports (AccountSubtype, ExpenseCategory, ContactType ×2) to
 * the existing domain-owned mirrors in accounting, expense and contacts,
 * bringing it to 56; the accounting Account D4 paydown moved the `Account`
 * MODEL type into a domain-owned structural interface in
 * `modules/accounting/domain/accounts.types.ts` (enum fields typed via the D1
 * mirrors) and repointed the crud port + 3 application tests, bringing it to
 * 51. The [BARREL] Group A cross-module repoints were then REVERTED (they
 * collided with the POC-cutover framework: financial-statements/expense/
 * mortality C4/C1 sentinels pin those consumers to presentation/server;
 * ratchet-R2 vs POC-cutover is a real conflict deferred to a human), restoring
 * 12 R2 lines back to 63 — `accounts.service.ts` (live injected PrismaClient,
 * D1/D3 design locks) remains deferred; the journal D4 paydown later moved
 * the `JournalEntry`/`JournalLine` MODEL types into domain-owned structural
 * interfaces in `journal.types.ts`, closing its R5 line.).
 * Turning the lint gate red today would mean either 63 fixes in one commit or 63
 * `eslint-disable`s
 * — so instead this sentinel
 * PINS the exact set of violations that exist. New debt fails. Fixed debt ALSO
 * fails, loudly, demanding the baseline shrink. That second half is what makes
 * it a ratchet instead of a permanent allowlist that quietly rots into a rubber
 * stamp.
 *
 * ── DESIGN DECISION 1: parse ESLint's OUTPUT, never re-implement the rules ──
 * This file runs ESLint through its programmatic Node API and reads the
 * reported messages. It does NOT scan source with regexes looking for banned
 * import specifiers.
 *
 * That is deliberate and it is the single most important property here. ESLint
 * has already resolved the `files`/`ignores` globs, the layered config cascade,
 * the `allowTypeImports` carve-out R5 grants `presentation/`, and the module
 * specifier matching. A regex re-implementation would have to re-derive all of
 * it and would get it wrong in the silent direction — this repo has a
 * documented history of exactly that (see `__tests__/feature-boundaries.test.ts`,
 * header). If the ratchet and ESLint ever disagreed, the ratchet would be
 * measuring its own bugs rather than the codebase.
 *
 * The programmatic API is used rather than `npx eslint --format json` because
 * pnpm injects a banner and an `ELIFECYCLE` epilogue into stdout, so the piped
 * output is NOT pure JSON and `JSON.parse` on it is a coin flip.
 *
 * ── DESIGN DECISION 2: scope is `modules/**`, and that is LOSSLESS ──
 * All four rules are declared in `eslint.config.mjs` under `files:` globs that
 * every one begin `modules/**\/{domain,application,presentation}/**`. No other
 * (that `**\/` is escaped because an unescaped `*` + `/` would CLOSE this very
 * comment — the first draft of this header did exactly that and the file failed
 * to parse. The hazard DESIGN DECISION 4 describes is not academic.)
 * path in the repo can produce an R1/R2/R4/R5 message, so narrowing the lint
 * run to `modules/**` drops ZERO coverage — it is not a performance shortcut
 * that trades away correctness. It costs ~17s (1201 files) instead of a
 * full-repo run. `α0` re-asserts the file count so a glob typo that silently
 * narrows the scan cannot pass unnoticed.
 *
 * ── DESIGN DECISION 3: the baseline is a LIST, never a COUNT ──
 * `BASELINE` is a multiset of `<repo-relative-path>:<rule>` entries, sorted.
 * It is emphatically NOT `expect(violations).toBe(120)`. A scalar count lets
 * you fix one violation and introduce a different one in the same commit while
 * the gate stays green — the debt would churn sideways forever at a constant
 * 120. Pinning identities makes every individual violation load-bearing.
 *
 * Entries REPEAT when one file violates one rule more than once (e.g.
 * `permissions.server.ts:R2` appears 4 times — four distinct restricted
 * imports of the infrastructure permissions cache).
 * The comparison is multiset-aware on purpose: fixing 1 of those 4 must turn
 * this file RED so the baseline is forced down to 3. A set-based (deduplicated)
 * comparison would let 3 of the 4 be re-introduced for free after one is fixed.
 * The repetition is not redundancy — each line is one real violation.
 *
 * NOTE: an entry does not carry a LINE NUMBER, by choice. Line numbers churn on
 * every unrelated edit above them, which would make this baseline a permanent
 * merge-conflict generator and train people to regenerate it blindly — the
 * failure mode that kills allowlists. Path + rule + multiplicity is the
 * coarsest identity that still refuses a sideways swap within a file.
 *
 * ── DESIGN DECISION 4: reading eslint.config.mjs — TOKENS, NOT TEXT ──
 * `α3` checks the four rules are still DECLARED, so nobody can delete a rule
 * from the config and watch this sentinel go green over an empty rule set.
 * It reads the config via `stringLiterals()` (tokenizer) and NEVER via a naive
 * comment-stripper. `eslint.config.mjs` is the most adversarial file in the
 * repo for a stripper: its rule groups are almost entirely globs shaped like
 * `"**\/infrastructure/*"`, and the `/*` inside such a string opens a PHANTOM
 * BLOCK COMMENT that deletes everything up to the next `*\/` — which is to say,
 * it deletes the `message:` strings under test and leaves the assertion GREEN
 * over a hole.
 *
 * THIS IS MEASURED ON THIS EXACT FILE, NOT INHERITED FROM ANOTHER SENTINEL:
 *   stripSourceComments(eslint.config.mjs) → 4392 chars in, 1994 out.
 *   2398 characters (55% of the file) DELETED, and the surviving text contains
 *   the R1, R2 and R4 messages but NOT R5 — the phantom comment opened by the
 *   `/*` in a `"**\/…/*"` glob swallowed the entire banPrismaInDomain block.
 * The tokenizer, by contrast, recovers all four from 50 string literals.
 * So the stripper is not a theoretical hazard here — it demonstrably eats one
 * of the four rules this assertion exists to pin. Prior art on the same class:
 * `stripSourceComments(vitest.config.ts)` destroys 911 of 2055 chars; full
 * write-up in `__tests__/feature-boundaries.test.ts` lines 30-59.
 *
 * ── WHY A COMMENT CANNOT MOVE THIS FILE ──
 * Because the input is ESLint's own AST-derived diagnostics, prose is
 * structurally incapable of registering. `// import x from "@prisma/client"`
 * inside a domain file produces no message and therefore no baseline entry.
 * This was verified by mutation, not assumed.
 *
 * ── SCOPE LIMIT, STATED HONESTLY ──
 * This sentinel is NOT wired into the CI lint gate and does not make `pnpm lint`
 * pass or fail. `pnpm lint` still reports all 119 as errors. This file's job is
 * to stop the number from growing while that gate stays off.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import path from "node:path";
import { stringLiterals } from "@/modules/shared/__tests__/string-literals";

// __dirname = <repo>/__tests__ → one hop to repo root.
const REPO_ROOT = path.resolve(__dirname, "..");

/** The four hexagonal rules, keyed by the prefix ESLint emits in `message`. */
const RULES = ["R1", "R2", "R4", "R5"] as const;

/**
 * ESLint tags every hexagonal violation by prefixing the configured `message`
 * with `"<rule> violated: "`. It arrives WRAPPED, e.g.
 *   "'@/generated/prisma/client' import is restricted from being used by a
 *    pattern. R5 violated: domain/application/presentation must NOT import…"
 * so this is deliberately NOT anchored at ^. α3 pins the fact that these four
 * message strings still exist in eslint.config.mjs, which is what stops this
 * regex from silently matching nothing.
 */
const RULE_TAG = /\b(R[1245]) violated:/;

/**
 * FROZEN HEXAGONAL DEBT — 63 violations across 41 distinct file+rule pairs.
 *
 * Format: `<repo-relative path>:<rule>`, sorted, ONE LINE PER VIOLATION.
 * Repeated lines are NOT duplicates — a file that trips the same rule on eight
 * different imports gets eight lines. See DESIGN DECISION 3 in the header.
 *
 * DO NOT ADD LINES HERE. A new violation means new hexagonal debt; fix the
 * import instead. Lines may only ever be REMOVED, and removing one is the
 * point of the exercise.
 *
 * The debt falls into five recurring clusters:
 *
 *   [DTO]      Accounting DTOs live in `presentation/dto/*.types` but are the
 *              shared vocabulary of domain and application. Every layer reaches
 *              up into presentation to get them. Fix: move them to `domain/`.
 *   [PRISMA]   `@/generated/prisma/{client,enums}` and `@/lib/prisma` imported
 *              outside infrastructure. Fix: define a port, map at the boundary.
 *   [EXPORT]   PDF/XLSX exporters live in `infrastructure/exporters/` and are
 *              called straight from presentation (R4) and application (R2).
 *              Fix: an exporter port owned by domain. The 18 violations across
 *              the 7 report-family barrels/services (ledger, contact-ledger,
 *              equity-statement, initial-balance, trial-balance, worksheet,
 *              financial-statements) were CLOSED by the [EXPORT] cluster
 *              paydown. The `voucher-pdf` exporter reached from
 *              `journals.service.ts:R2` (4 entries, initially deferred) was
 *              then CLOSED too: `VoucherPdfExporterPort` (domain) + a thin
 *              adapter delegating to the unchanged pure helpers, wired in
 *              `modules/accounting/presentation/composition-root.ts`.
 *   [CACHE]    `permissions.cache` (infrastructure) reached from domain and
 *              application. Fix: a caching port. The 4 TYPE-ONLY `OrgMatrix`
 *              imports were closed by moving the type to domain/permissions.ts;
 *              the value-import injection (getMatrix/ensureOrgSeeded/test hooks)
 *              is DEFERRED pending a decision on composition-root indirection
 *              (prior D1 attempt hit an import-cycle TDZ crash).
 *   [BARREL]   Cross-module `presentation/server` / `presentation` barrels used
 *              as the public API of another module. Fix: publish an application
 *              -level contract per module instead of a presentation barrel.
 */
const BASELINE: ReadonlyArray<string> = [

  // ── modules/account-balances/ — [DTO][PRISMA] own infra repo/types + accounting DTO barrel + Prisma client
  // account-balances.service.ts:R5 CLOSED by the [UoW-vs-opaque-token] paydown
  // — applyPost/applyVoid now type `tx: unknown` (opaque token), casting
  // internally via `Parameters<AccountBalancesRepository["upsert"]>[0]`. The
  // 2 R2 entries (application → infra reach for the repo + its Prisma-derived
  // type) were CLOSED by the domain-port paydown — AccountBalancesRepositoryPort
  // + AccountBalanceWithRelations now live under domain/, the service depends
  // on the port only, and `presentation/composition-root.ts` wires the
  // concrete AccountBalancesRepository (infra is R2/R5-exempt).

  // ── modules/accounting/ — [DTO][PRISMA][EXPORT][BARREL] the epicentre — presentation/dto/* reached from every layer,
  //     Prisma client/model types in domain/application, and sibling modules
  //     consumed via presentation barrels (the infrastructure/exporters/*
  //     reads were all CLOSED by the [EXPORT] paydowns, voucher-pdf last)
  "modules/accounting/application/accounts.service.ts:R5",
  // auto-entry-generator.ts:R5 CLOSED by the [UoW-vs-opaque-token] paydown —
  // generate() now types `tx: unknown`, casting internally via
  // `Parameters<JournalRepository["createWithRetryTx"]>[0]`. The 2 R2 entries
  // (voucher-types presentation re-export + concrete JournalRepository) were
  // CLOSED: the VoucherTypeRepository import now points straight at
  // `voucher-types/domain/voucher-type.repository`, and the JournalRepository
  // reach is behind a new narrow `AutoEntryJournalWriterPort` (domain) +
  // `AutoEntryJournalWriterAdapter` (infrastructure), mirroring the
  // `VoucherPdfExporterPort` precedent.
  // The 4 journals.service.ts:R2 entries (voucher-pdf infra reads) were
  // CLOSED by the [EXPORT] voucher paydown — VoucherPdfExporterPort (domain)
  // + voucher-pdf-exporter.adapter.ts (infrastructure), wired in
  // composition-root.ts. See the [EXPORT] cluster note below.
  // moved here from presentation/dto by the [DTO] paydown; the R5 residue is
  // [PRISMA]-cluster debt (MODEL types — not the enums D1 mirrored) closed by
  // defining domain-local types + mapping at the infra boundary. The accounting
  // `Account` model type was migrated to domain (D4) — accounts.types.ts now
  // owns a structural `Account` interface (enum fields via the D1 mirrors) and
  // the crud port + 3 application tests were repointed; `accounts.service.ts`
  // (live injected PrismaClient, D1/D3 design locks) remains deferred.
  // journal.types.ts:R5 (6 model types) was CLOSED by the journal D4 paydown —
  // journal.types.ts now owns structural `JournalEntry`/`JournalLine` mirrors
  // (Decimal via decimal.js per DEC-1, status via the domain
  // journal-entry-status mirror), reuses the accounting `Account` D4 mirror,
  // the voucher-types/operational-doc-type domain Snapshots, and a minimal
  // raw-row-assignable `JournalContactRef` for the contact relations.
  // validation.ts:R5 (the M1 revert — composition-root TDZ cycle) was CLOSED
  // by D1: the enum imports now come from the LEAF mirror file
  // domain/value-objects/account-classification.ts, which is exactly the
  // "small dedicated enum-only" home the revert note called for.
  // The 3 make-*-service.ts:R2 reverse-wiring entries (equity-statement,
  // initial-balance, trial-balance) were CLOSED by the [REVERSE-WIRING]
  // paydown — see header narrative.

  // ── modules/ai-agent/ — [PRISMA][BARREL] LLM adapters + cross-module presentation-barrel imports
  //     Two paydowns landed here:
  //     • [BARREL] R5 enum entries CLOSED — Prisma enum imports repointed to the
  //       existing domain mirrors (AccountSubtype→accounting/domain/value-objects/
  //       account-classification, ExpenseCategory→expense/domain/value-objects/
  //       expense-category, ContactType→contacts/domain/value-objects/contact-type).
  //       NOTE: the ExpenseCategory and ContactType mirrors have no Prisma deep-sync
  //       guard like accounting's enum-domain-mirror.sync.test.ts — pre-existing gap,
  //       hardening deliberately deferred to a separate decision.
  //     • FREE cross-module repoints CLOSED (commit 07c549df) — the 7 imports with
  //       NO POC-cutover sentinel over them moved off presentation barrels to their
  //       canonical domain/application source: LotInquiryPort→lot/domain/ports/
  //       lot-inquiry.port (agent.service, chat, pricing.service), OrgSettingsService→
  //       org-settings/application/org-settings.service (find-accounts), ContactsService→
  //       contacts/application/contacts.service (find-contact, parse-operation).
  //     HONESTY NOTE: ai-agent still has SHADOW DEBT — 6 dynamic `await import(
  //     ".../presentation/server")` factory loads (pricing.service ×3, find-accounts,
  //     find-contact, parse-operation) that ESLint's no-restricted-imports does NOT
  //     catch; closing them is a deferred composition-root injection refactor (the
  //     constructors already accept the deps), carries TDZ risk, needs runtime testing.
  //
  //  ── DESIGN-LOCKED by POC-cutover (Option B, human decision 2026-07-21) ──
  //     The 9 entries below are NOT payable debt. Repointing them off presentation/
  //     server to domain/application would RE-BREAK live POC-cutover sentinels that
  //     DELIBERATELY pin these cross-module consumers to each module's public
  //     presentation barrel — the barrel IS the intended cross-module API surface
  //     (the underlying features/ migration is 100% complete; the C4/C1 shape tests
  //     now act as permanent regression locks). This is the same R2-vs-POC conflict
  //     that reverted BARREL Group A (commit 77f35522). Decision: POC-cutover wins;
  //     these stay frozen WITH citations, per the §18 deferred-with-citation
  //     convention (docs/architecture/03-rules-hard-rules.md §18). Each entry cites
  //     the live sentinel assertion that locks it (file:line):
  //       agent.service.ts:R2              → financial-statements C4 test:185-191
  //       balance-sheet-analysis.ts:R2     → financial-statements C4 test:193-201
  //       income-statement-analysis.ts:R2  → financial-statements C4 test:203-211
  //       balance-sheet-analysis.prompt.ts:R1 ×2    → financial-statements C4 test:213-221
  //       income-statement-analysis.prompt.ts:R1 ×2 → financial-statements C4 test:223-231
  //       pricing.service.ts:R2 (expense)  → expense C4 test α53:108-117
  //       pricing.service.ts:R2 (mortality)→ mortality C1 test:124,154-172
  //     Sentinel files:
  //       modules/accounting/financial-statements/__tests__/c4-cutover-shape.poc-financial-statements-hex.test.ts
  //       modules/expense/__tests__/c4-cross-feature-cutover-shape.poc-expense-hex.test.ts
  //       modules/mortality/presentation/__tests__/c1-cutover-shape.poc-nuevo-mortality.test.ts
  //     To ever pay these down, the owning POC must first be cemented AND its C4/C1
  //     shape assertions retired (the organizations-hex precedent), not before.
  "modules/ai-agent/application/agent.service.ts:R2",
  "modules/ai-agent/application/modes/balance-sheet-analysis.ts:R2",
  "modules/ai-agent/application/modes/income-statement-analysis.ts:R2",
  "modules/ai-agent/application/pricing/pricing.service.ts:R2",
  "modules/ai-agent/application/pricing/pricing.service.ts:R2",
  "modules/ai-agent/domain/prompts/balance-sheet-analysis.prompt.ts:R1",
  "modules/ai-agent/domain/prompts/balance-sheet-analysis.prompt.ts:R1",
  "modules/ai-agent/domain/prompts/income-statement-analysis.prompt.ts:R1",
  "modules/ai-agent/domain/prompts/income-statement-analysis.prompt.ts:R1",

  // ── modules/organizations/ — [PRISMA] Prisma client across ports/types; roles repo + singleton cross-layer
  // Model-types migrated to domain (D4); the [UoW-vs-opaque-token] paydown
  // CLOSED all 4 Prisma.TransactionClient sites (organizations.repository.port
  // + the 3 seed ports) by retyping `tx` opaquely (`tx?: unknown`), mirroring
  // accounts-crud.port.ts / voucher-types.service.ts. The infra adapters
  // (prisma-organizations.repository.ts, the 3 legacy-*-seed adapters, plus
  // base.repository.ts's transaction()) cast back internally. The
  // `transaction()` method's `options.isolationLevel` was DROPPED from the
  // domain port surface (no call site passed it) rather than mirrored as a
  // Prisma-enum domain type, to avoid scope-creep — infra keeps its own
  // Prisma-typed isolationLevel internally. The raw `tx.customRole.createMany`
  // call in organizations.service.ts (structural Prisma leakage via `tx`) was
  // also moved behind a new `SystemRoleSeedPort.seedSystemRoles` method +
  // `LegacySystemRoleSeedAdapter`, closing the last raw-Prisma coupling this
  // paydown depended on. members.validation.ts:R1 (domain → presentation
  // `rolesService` singleton reach) was CLOSED by the domain-port paydown —
  // `buildAddMemberSchema`/`buildUpdateMemberRoleSchema` now take a narrow
  // `RoleSlugExistencePort` parameter (declared locally in the domain file)
  // instead of importing the singleton; the 2 route callers pass the
  // existing `rolesService` singleton in from presentation/.

  // ── modules/payment/ — [PRISMA] shared/infrastructure/audit-tx from both layers
  // fetch-shortcut-source.ts:R5 CLOSED by the D4 paydown — the helper now
  // depends on `ShortcutSourceQueryPort` (domain/ports/) instead of importing
  // `@/lib/prisma` directly; the Prisma query moved into
  // infrastructure/adapters/prisma-shortcut-source-query.adapter.ts, wired via
  // composition-root.ts (`makeShortcutSourceQueryPort`).
  // payments.service.ts:R2 CLOSED by the [UoW-shape] paydown — the human
  // decision (§18-logged, 2026-07-22) picked shape (a): a minimal PASSTHROUGH
  // `PaymentUnitOfWork.run(ctx, fn: (tx: unknown, correlationId) => ...)`
  // domain port (domain/ports/payment-unit-of-work.ts). The service no longer
  // imports withAuditTx; `PrismaPaymentUnitOfWork` (infrastructure/) delegates
  // to it, `BoundPaymentUnitOfWork` covers `makePaymentsServiceForTx(tx)`
  // (installs audit vars on the PROVIDED tx, no nested transaction), both
  // wired via presentation/composition-root.ts. The 5 tx-threaded ports were
  // untouched — they were already `tx: unknown` end-to-end.

  // ── modules/permissions/ — [CACHE] permissions.cache (infrastructure) reached from domain and application,
  //     plus organizations consumed via presentation barrels
  //  ── DESIGN-LOCKED: these 10 split 5+5, neither half mechanical (§18, human
  //     decision 2026-07-22; audit read-only, all imports verified) ──
  //     GROUP A — 5 true [CACHE] entries (client-matrix.test.ts, require-permission
  //     .test.ts ×1 of its 3, client-matrix.ts, permissions.server.ts ×1 of its 4,
  //     server.ts): all VALUE imports of getMatrix/ensureOrgSeeded/_setLoader/
  //     _resetCache from infrastructure/permissions.cache. The type-only subset
  //     (OrgMatrix) was ALREADY closed in a prior paydown — what remains is only the
  //     hard case. A domain CachePort + DI risks RE-CREATING the org⇄permissions
  //     import cycle that is real in this exact module (why the surgical
  //     `infrastructure/cache.ts` barrel-split exists; same TDZ family that crashed
  //     accounting's D1). Extra blockers: `_setLoader`/`_resetCache` are TEST-ONLY
  //     hooks with no natural home on a production domain port, and permissions has
  //     NO presentation/ layer at all (only domain/app/infra) — no composition-root
  //     to extend without creating one from scratch. Medium-high risk, not free.
  //     GROUP B — 5 cross-module barrel reaches (permissions.server.ts ×3,
  //     require-permission.test.ts ×2): imports of requireAuth (shared/presentation/
  //     middleware), requireOrgAccess/requireRole (organizations/presentation/
  //     middleware), makeEnsureFromClerkService (organizations/presentation/
  //     composition-root). VERIFIED these symbols live GENUINELY in presentation
  //     (HTTP auth middleware + Clerk composition) — NO domain/application home to
  //     repoint to, unlike the ai-agent/tags FREE barrel closures. The real question
  //     is whether `permissions.server.ts` itself is misplaced in application/ —
  //     an architecture call, not a repoint. Both halves deferred to a human.
  "modules/permissions/application/__tests__/client-matrix.test.ts:R2",
  "modules/permissions/application/__tests__/require-permission.test.ts:R2",
  "modules/permissions/application/__tests__/require-permission.test.ts:R2",
  "modules/permissions/application/__tests__/require-permission.test.ts:R2",
  "modules/permissions/application/client-matrix.ts:R2",
  "modules/permissions/application/permissions.server.ts:R2",
  "modules/permissions/application/permissions.server.ts:R2",
  "modules/permissions/application/permissions.server.ts:R2",
  "modules/permissions/application/permissions.server.ts:R2",
  "modules/permissions/application/server.ts:R2",

  // ── modules/purchase/ — [BARREL] accounting shared/infrastructure/document-type-codes from application

  // ── modules/shared/ — [BARREL] presentation/http-error-serializer imported by a domain error test

  // ── modules/tags/ — [BARREL] tags.service.ts:R2 CLOSED (commit 07c549df) —
  //     `slugify` repointed from organizations/presentation to its canonical domain
  //     home organizations/domain/roles.validation. It was FREE: no POC sentinel
  //     enforced the barrel import (organizations POC fully cemented, its shape
  //     tests already deleted), so it carried none of the R2-vs-POC collision.

  // ── modules/users/ — [PRISMA] own infra repository + Prisma client from application
  //  ── DESIGN-LOCKED: no contained fix exists (§18, human decision 2026-07-22) ──
  //     `users.service.ts` imports its own `UsersRepository` (infra) and news it
  //     as a zero-arg constructor default (`repo ?? new UsersRepository()`), so
  //     `new UsersService()` is called at 17+ sites — the overwhelming majority in
  //     `app/api/organizations/[orgSlug]/{mortality,sales,purchases,payments,
  //     expenses,journal,dispatches,periods,monthly-close,annual-close}/**/route.ts`,
  //     which live OUTSIDE `modules/**` and so are invisible to this ratchet yet
  //     functionally load-bearing. Every clean fix has an unacceptable cost:
  //     (a) a domain `UsersRepositoryPort` + required-injection forces all ~17
  //     unrelated route files onto a `makeUsersService()` factory — a wide,
  //     cross-cutting change on auth-adjacent code for zero business benefit; or
  //     (b) a presentation-layer singleton (like organizations' roles.service
  //     .singleton) merely RELOCATES the same R1/R2 violation rather than closing
  //     it (exactly the debt members.validation.ts carried until commit 63d754aa).
  //     Unlike the FREE items, no narrow 2-5 file fix exists — deferred to a human.
  "modules/users/application/users.service.ts:R2",
];

// ── ESLint run: ONCE for the whole file, ~17s ──
// Every assertion below reads from these two values. Running the linter per
// test would multiply a 17s cost by four for no added signal.
let observed: string[] = [];
let filesLinted = 0;

beforeAll(async () => {
  const eslint = new ESLint({ cwd: REPO_ROOT });
  // Scoped to modules/** — lossless, see DESIGN DECISION 2.
  const results = await eslint.lintFiles(["modules/**/*.{ts,tsx}"]);
  filesLinted = results.length;

  const rows: string[] = [];
  for (const result of results) {
    const rel = path
      .relative(REPO_ROOT, result.filePath)
      .split(path.sep)
      .join("/");
    for (const message of result.messages) {
      if (message.ruleId !== "no-restricted-imports") continue;
      const tag = RULE_TAG.exec(message.message);
      // A no-restricted-imports message that is NOT one of the four hexagonal
      // rules would be a fifth rule someone added; surface it rather than drop
      // it silently, so it cannot hide from the ratchet.
      rows.push(`${rel}:${tag ? tag[1] : "UNTAGGED"}`);
    }
  }
  observed = rows.sort();
}, 180_000);

/** Multiset tally — how many times each entry occurs. */
function tally(entries: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry, (counts.get(entry) ?? 0) + 1);
  return counts;
}

describe("Hexagonal boundary ratchet — R1/R2/R4/R5 debt is frozen", () => {
  it("α0: the ESLint run actually covered modules/ (anti-vacuity smoke)", () => {
    // modules/** holds 1201 lintable files today. A glob typo, a stray
    // `globalIgnores`, or an ESLint API change that returns [] would otherwise
    // leave every assertion below trivially satisfied over an empty result set.
    // 1000 leaves room for real deletions without becoming a second ratchet.
    expect(
      filesLinted,
      `ESLint reported only ${filesLinted} file(s) under modules/. Expected 1000+. ` +
        `The scan is not seeing the codebase — every assertion in this file is ` +
        `VACUOUS until this is fixed. Check the lintFiles() glob and eslint.config.mjs ignores.`,
    ).toBeGreaterThan(1000);
  });

  it("α1: every violation ESLint reports carries a known rule tag", () => {
    const untagged = observed.filter((entry) => entry.endsWith(":UNTAGGED"));
    expect(
      untagged,
      `A no-restricted-imports violation did not match /${RULE_TAG.source}/. ` +
        `Either a fifth restricted-import rule was added to eslint.config.mjs ` +
        `(give it a tag and extend RULES), or an existing message was reworded ` +
        `and this ratchet stopped classifying it.`,
    ).toEqual([]);
  });

  it("α2: the frozen debt has not grown and the baseline is not stale", () => {
    const expected = tally(BASELINE);
    const actual = tally(observed);

    const added: string[] = [];
    const removed: string[] = [];

    for (const key of new Set([...expected.keys(), ...actual.keys()]).values()) {
      const want = expected.get(key) ?? 0;
      const got = actual.get(key) ?? 0;
      if (got > want) added.push(`  ${key}  baseline ${want} → found ${got}`);
      else if (got < want) removed.push(`  ${key}  baseline ${want} → found ${got}`);
    }

    // Direction 1 — NEW debt. This is the gate doing its day job.
    expect(
      added,
      `\n${added.length} NEW hexagonal boundary violation(s):\n${added.join("\n")}\n\n` +
        `This is NEW hexagonal debt. DO NOT ADD IT TO THE BASELINE.\n` +
        `Fix the import instead:\n` +
        `  R1 — domain/ must not reach application/, infrastructure/ or presentation/.\n` +
        `  R2 — application/ may only depend on domain/.\n` +
        `  R4 — presentation/ talks to application/, not infrastructure/\n` +
        `       (composition-root.ts is the ONE exception).\n` +
        `  R5 — no Prisma outside infrastructure/; define a port in domain/.\n` +
        `See docs/architecture.md.\n`,
    ).toEqual([]);

    // Direction 2 — debt that is GONE. Without this half the baseline rots:
    // a stale entry is a licence to silently re-introduce the violation later.
    expect(
      removed,
      `\n${removed.length} baseline entr(y/ies) no longer violate anything:\n${removed.join("\n")}\n\n` +
        `You FIXED these — thank you. Now REMOVE the corresponding line(s) from\n` +
        `BASELINE above so the ratchet tightens and the debt cannot come back.\n` +
        `(Where "baseline N → found M" with M > 0, delete N-M of that line.)\n`,
    ).toEqual([]);
  });

  it("α3: all four rules are still DECLARED in eslint.config.mjs", () => {
    // Without this, deleting a rule from the config would empty its violations
    // out of `observed`, and α2 would report them as "fixed" — inviting someone
    // to delete the baseline lines and call the debt paid. The rule set itself
    // has to be pinned.
    //
    // READ VIA TOKENIZER, NEVER VIA A COMMENT-STRIPPER. eslint.config.mjs is
    // full of globs like "**/infrastructure/*"; the `/*` inside such a string
    // opens a phantom block comment in a naive stripper and deletes the very
    // `message:` strings under test, leaving this assertion GREEN over a hole.
    // See DESIGN DECISION 4 in the header.
    const configPath = path.resolve(REPO_ROOT, "eslint.config.mjs");
    const literals = stringLiterals(readFileSync(configPath, "utf8"));

    // Anchored at the START of the literal: the real `message:` values BEGIN
    // with "R5 violated:". Prose that merely mentions the tag mid-sentence is
    // not a declaration — and comments never reach here anyway.
    const missing = RULES.filter(
      (rule) => !literals.some((value) => value.startsWith(`${rule} violated:`)),
    );

    expect(
      missing,
      `eslint.config.mjs no longer declares: ${missing.join(", ")}.\n` +
        `A hexagonal rule was deleted or its message reworded. This ratchet ` +
        `measures ESLint's output, so a deleted rule reads as "debt fixed" — ` +
        `which is why the rules themselves are pinned here. Restore the rule, ` +
        `or if the removal is intentional, delete its baseline entries in the ` +
        `SAME commit and update RULES.`,
    ).toEqual([]);
  });
});
