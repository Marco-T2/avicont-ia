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
 * D1/D3 design locks) and `journal.types.ts` (6 model types) remain deferred.).
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
 * `journals.service.ts:R2` appears 8 times — eight distinct restricted imports).
 * The comparison is multiset-aware on purpose: fixing 3 of those 8 must turn
 * this file RED so the baseline is forced down to 5. A set-based (deduplicated)
 * comparison would let 7 of the 8 be re-introduced for free after one is fixed.
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
 *              `journals.service.ts:R2` remains OPEN — deliberately deferred,
 *              see the comment at
 *              `modules/accounting/presentation/composition-root.ts:50-52`.
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
  "modules/account-balances/application/account-balances.service.ts:R2",
  "modules/account-balances/application/account-balances.service.ts:R2",
  "modules/account-balances/application/account-balances.service.ts:R5",

  // ── modules/accounting/ — [DTO][PRISMA][EXPORT][BARREL] the epicentre — presentation/dto/* reached from every layer,
  //     infrastructure/exporters/* called from presentation and application, Prisma
  //     client/enums in domain, and four sibling modules consumed via presentation/server
  "modules/accounting/application/accounts.service.ts:R5",
  "modules/accounting/application/auto-entry-generator.ts:R2",
  "modules/accounting/application/auto-entry-generator.ts:R2",
  "modules/accounting/application/auto-entry-generator.ts:R5",
  "modules/accounting/application/journals.service.ts:R2",
  "modules/accounting/application/journals.service.ts:R2",
  "modules/accounting/application/journals.service.ts:R2",
  "modules/accounting/application/journals.service.ts:R2",
  "modules/accounting/application/journals.service.ts:R2",
  "modules/accounting/application/journals.service.ts:R2",
  "modules/accounting/application/journals.service.ts:R2",
  // moved here from presentation/dto by the [DTO] paydown; the R5 residue is
  // [PRISMA]-cluster debt (MODEL types — not the enums D1 mirrored) closed by
  // defining domain-local types + mapping at the infra boundary. The accounting
  // `Account` model type was migrated to domain (D4) — accounts.types.ts now
  // owns a structural `Account` interface (enum fields via the D1 mirrors) and
  // the crud port + 3 application tests were repointed; `accounts.service.ts`
  // (live injected PrismaClient, D1/D3 design locks) and `journal.types.ts`
  // (6 model types) remain deferred.
  "modules/accounting/domain/journal.types.ts:R5",
  // validation.ts:R5 (the M1 revert — composition-root TDZ cycle) was CLOSED
  // by D1: the enum imports now come from the LEAF mirror file
  // domain/value-objects/account-classification.ts, which is exactly the
  // "small dedicated enum-only" home the revert note called for.
  // The 3 make-*-service.ts:R2 reverse-wiring entries (equity-statement,
  // initial-balance, trial-balance) were CLOSED by the [REVERSE-WIRING]
  // paydown — see header narrative.

  // ── modules/ai-agent/ — [PRISMA][BARREL] one LLM adapter reached from presentation, Prisma enums in domain prompts
  //     The [BARREL] Group A paydown CLOSED the 10 application/*:R2 entries by
  //     repointing the static type imports (financial-statements types,
  //     LotInquiryPort, ExpenseService, MortalityService, OrgSettingsService,
  //     ContactsService) from sibling presentation/server barrels to the actual
  //     domain/application files. HONESTY NOTE: ai-agent still has SHADOW DEBT —
  //     6 dynamic `await import(".../presentation/server")` factory loads
  //     (pricing.service ×3, find-accounts, find-contact, parse-operation) that
  //     ESLint's no-restricted-imports does NOT catch; closing them is a
  //     deferred composition-root injection refactor (the constructors already
  //     accept the deps), carries TDZ risk, and needs runtime testing.
  //     The 4 R5 enum entries (find-contact.ts, income-statement-analysis
  //     .prompt.ts, tool-output.types.ts, agent.types.ts) were CLOSED by
  //     repointing the Prisma enum imports to the existing domain mirrors
  //     (AccountSubtype→accounting/domain/value-objects/account-classification,
  //     ExpenseCategory→expense/domain/value-objects/expense-category,
  //     ContactType→contacts/domain/value-objects/contact-type). NOTE: the
  //     ExpenseCategory and ContactType mirrors have no Prisma deep-sync guard
  //     like accounting's enum-domain-mirror.sync.test.ts — pre-existing gap,
  //     hardening deliberately deferred to a separate decision.
  // [BARREL] cross-module presentation-barrel imports — REVERTED (was BARREL
  // Group A, commit 77f35522): the repoints to domain/application collided with
  // the POC cutover framework (financial-statements/expense/mortality C4/C1
  // sentinels pin these consumers to presentation/server). Ratchet-R2 vs
  // POC-cutover is a real architectural conflict — deferred to a human decision.
  "modules/ai-agent/application/agent.service.ts:R2",
  "modules/ai-agent/application/agent.service.ts:R2",
  "modules/ai-agent/application/modes/balance-sheet-analysis.ts:R2",
  "modules/ai-agent/application/modes/chat.ts:R2",
  "modules/ai-agent/application/modes/income-statement-analysis.ts:R2",
  "modules/ai-agent/application/pricing/pricing.service.ts:R2",
  "modules/ai-agent/application/pricing/pricing.service.ts:R2",
  "modules/ai-agent/application/pricing/pricing.service.ts:R2",
  "modules/ai-agent/application/tools/find-accounts.ts:R2",
  "modules/ai-agent/application/tools/find-contact.ts:R2",
  "modules/ai-agent/application/tools/parse-operation.ts:R2",
  "modules/ai-agent/domain/prompts/balance-sheet-analysis.prompt.ts:R1",
  "modules/ai-agent/domain/prompts/balance-sheet-analysis.prompt.ts:R1",
  "modules/ai-agent/domain/prompts/income-statement-analysis.prompt.ts:R1",
  "modules/ai-agent/domain/prompts/income-statement-analysis.prompt.ts:R1",

  // ── modules/organizations/ — [PRISMA] Prisma client across ports/types; roles repo + singleton cross-layer
  // Model-types migrated to domain (D4); Prisma.TransactionClient sites (organizations.repository.port + 3 seed ports) DEFERRED to a UoW-vs-opaque-token decision.
  "modules/organizations/domain/members.validation.ts:R1",
  "modules/organizations/domain/ports/account-seed.port.ts:R5",
  "modules/organizations/domain/ports/operational-doc-type-seed.port.ts:R5",
  "modules/organizations/domain/ports/organizations.repository.port.ts:R5",
  "modules/organizations/domain/ports/voucher-type-seed.port.ts:R5",

  // ── modules/payment/ — [PRISMA] shared/infrastructure/audit-tx from both layers
  // fetch-shortcut-source.ts:R5 CLOSED by the D4 paydown — the helper now
  // depends on `ShortcutSourceQueryPort` (domain/ports/) instead of importing
  // `@/lib/prisma` directly; the Prisma query moved into
  // infrastructure/adapters/prisma-shortcut-source-query.adapter.ts, wired via
  // composition-root.ts (`makeShortcutSourceQueryPort`).
  "modules/payment/application/payments.service.ts:R2",

  // ── modules/permissions/ — [CACHE] permissions.cache (infrastructure) reached from domain and application,
  //     plus organizations consumed via presentation barrels
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

  // ── modules/tags/ — [BARREL] tags.service.ts:R2 — REVERTED with the rest of
  //     BARREL Group A (POC-cutover collision); `slugify` imports from
  //     organizations/presentation again pending a human ratchet-vs-POC decision.
  "modules/tags/application/tags.service.ts:R2",

  // ── modules/users/ — [PRISMA] own infra repository + Prisma client from application
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
