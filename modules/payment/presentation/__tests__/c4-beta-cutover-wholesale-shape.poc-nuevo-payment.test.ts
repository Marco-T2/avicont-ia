/**
 * POC nuevo payment C4-β RED — wholesale delete features/payment/* atomic +
 * cross-feature TYPE swap consumers via LOCAL DTO presentation/dto/ canonical
 * home Path a (§13.A5-ε signature divergence MATERIAL 3ra evidencia
 * post-cementación canonical, 1ra A5-C2c voucher-types
 * `seedForOrg→seedDefaultsForOrg` + 2da C1
 * `findUnappliedPayments→findUnappliedByContact`).
 *
 * Mirror precedent paired-pr C7 Opción B EXACT estricto + A4-C3 + A5-C3
 * wholesale delete features/* atomic single batch + PaymentWithRelations C3
 * presentation/dto/ canonical home convention pre-existing.
 *
 * Marco lock final pre-RED chain (4 sub-checks pre-Marco lock retroactive
 * MANDATORY ratify):
 *   - Sub-check 1a §13.A5-ε divergence MATERIAL CONFIRMADA — 5 fields
 *     CreatePaymentInput (organizationId hex / NO legacy + journalEntryId hex /
 *     NO legacy + direction legacy / NO hex + creditSources legacy / NO hex +
 *     allocations type AllocationInput vs AllocationDraft) + 1 field
 *     UpdatePaymentInput (allocations legacy / NO hex). Same name semantic
 *     distinto: hex domain = entity construction puro / legacy = UI/API-facing
 *     orchestration. Path (a) LOCAL DTO RATIFY default — Path (b) cascade swap
 *     callsites viola Marco lock C3 L3 absorbed + tampoco resuelve §13
 *     R-name-collision sub-finding NEW emergente.
 *   - Sub-check 1b ESLint 8-9 axes grep clean — R1+R2+R4+R5+banServerBarrels
 *     NO violation predicted post-GREEN. §13.A features-legacy-type-only-import
 *     WHOLESALE RESOLUCIÓN (delete features/payment/* drops vector entire 1ra
 *     C2 + 2da C3 + 3ra C4-α evidencias cumulative resueltas wholesale). 9th
 *     axis cross-layer R1 NO emerge (Snapshot LOCAL Path C C4-α resolved
 *     cross-layer DTO concern).
 *   - Sub-check 1c vi.mock features/payment cleanup absorbed C1 GREEN ✓
 *     (0 real declarations PROJECT-scope, solo JSDoc strings cross-ref lineage
 *     dentro test files self-contained future-proof).
 *   - Sub-check 1d UnappliedPayment alias intra-features absorbed wholesale
 *     natural ✓ (0 consumers externos PROJECT-scope, intra-features uso
 *     únicamente en payment.repository.ts → wholesale delete absorbs cleanup
 *     natural).
 *
 * Sub-finding NEW emergente cementación target D1 — "client components ↔
 * server-only barrel TYPE-only erasure convention pre-existing precedent
 * VERIFIED": components ya importan TYPES desde presentation/dto/ deep path
 * (PaymentWithRelations C3 EXACT) NOT desde server-only barrel. Path (a) LOCAL
 * DTO double-justified (resolve §13.A5-ε divergence + match convention
 * pre-existing). TYPE-only erasure safe vs server-only directive — `import
 * type` fully erased compile-time, NO runtime server-only check tripped.
 *
 * §13 R-name-collision NEW invariant collision sub-category cumulative — hex
 * barrel `modules/payment/presentation/server.ts` re-exporta DOS pares mismo
 * concepto distinct shapes:
 *   - `CreatePaymentInput, UpdatePaymentInput` from `../domain/payment.entity`
 *     (entity construction shape pure: organizationId + journalEntryId +
 *     AllocationDraft, NO direction NO creditSources)
 *   - `CreatePaymentServiceInput, UpdatePaymentServiceInput` from
 *     `../application/payments.service` (orchestration-facing shape)
 * Path (a) LOCAL DTO presentation/dto/payment-input-types.ts unified canonical
 * home RESOLVES naming clarity — LOCAL CreatePaymentInput presentation/dto/
 * distinct de domain CreatePaymentInput vía namespace path. Cementación target
 * D1.
 *
 * Scope C4-β atomic single batch — 10 archivos:
 *   1-6. DELETE features/payment/{index, payment.repository, payment.service,
 *        payment.types, payment.validation, server}.ts wholesale
 *   7. rmdir features/payment/ (no orphan empty dir)
 *   8. NEW modules/payment/presentation/dto/payment-input-types.ts (LOCAL DTO
 *      Path a — CreatePaymentInput + UpdatePaymentInput legacy shape
 *      preservation LOCAL definition + AllocationInput LOCAL co-location +
 *      PaymentFilters re-export from hex barrel)
 *   9. UPDATE modules/payment/presentation/payment-service.adapter.ts
 *      (TYPE imports split: CreatePaymentInput + UpdatePaymentInput +
 *      AllocationInput from ./dto/payment-input-types LOCAL + PaymentFilters +
 *      CreditAllocationSource from ./server hex barrel)
 *  10a. UPDATE components/payments/payment-list.tsx cross-feature TYPE swap
 *       (PaymentDirection import legacy → hex barrel canonical home alias)
 *  10b. UPDATE components/payments/payment-form.tsx cross-feature TYPE swap
 *       (PaymentDirection + PaymentMethod + CreditAllocationSource imports
 *       legacy → hex barrel canonical home alias — TYPE-only erasure safe vs
 *       server-only directive convention pre-existing precedent C3 EXACT)
 *
 * Failure mode honest declared α 12/12 FAIL pre-GREEN (mirror
 * feedback_red_acceptance_failure_mode cumulative cross-POC):
 *   - T0 LOCAL DTO file absent pre-GREEN → fs.existsSync false →
 *     expect(false).toBe(true) FAILS
 *   - T1-T6: 6 archivos features/payment/* still exist pre-GREEN →
 *     fs.existsSync true → expect(true).toBe(false) FAILS
 *   - T7: features/payment/ directory still exists pre-GREEN → fs.existsSync
 *     true → expect(true).toBe(false) FAILS
 *   - T8: Adapter still imports from `@/features/payment/payment.types`
 *     pre-GREEN → multi-expect mix: 5 positive hex/LOCAL DTO matches FAIL +
 *     1 negative legacy match FAIL — Test 8 FAILS aggregated
 *   - T9: payment-list.tsx still imports PaymentDirection from
 *     `@/features/payment/payment.types` pre-GREEN → positive hex match FAIL +
 *     negative legacy match FAIL — Test 9 FAILS aggregated
 *   - T10: payment-form.tsx still imports 3 tipos from legacy pre-GREEN → 3
 *     positive hex matches FAIL + 1 negative legacy match FAIL — Test 10 FAILS
 *     aggregated
 *   - T11: PROJECT-scope grep returns 3 offenders residual pre-GREEN (adapter
 *     + payment-list + payment-form) → expect([3 offenders]).toEqual([])
 *     FAILS
 * Total expected FAIL pre-GREEN: 12/12 (Marco mandate failure mode honest
 * enumerated).
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock heredado
 * cumulative): shape test asserta paths que persisten post C4-β GREEN
 * (modules/payment/presentation/dto/payment-input-types.ts NEW + Adapter
 * UPDATE + 2 components UPDATE paths persistentes). Test vive en
 * modules/payment/presentation/__tests__/ — NO toca features/payment/* que
 * C4-β GREEN borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent EXACT C4-α + C3 + C2 + C1 +
 * C0-pre + paired-pr cumulative — `fs.readFileSync` regex match +
 * `fs.existsSync` file/dir checks + recursive walk PROJECT-scope safety net
 * forward-looking T11 (excluding test files test-shape-assertion-negative
 * paths).
 *
 * Cross-ref:
 *   - architecture.md §13.A5-ε signature divergence drop alias (3ra evidencia
 *     post-cementación canonical aplicado C4-β — Path a LOCAL DTO
 *     presentation/dto/ canonical home preserve UI/API-facing shape distinct
 *     de domain entity construction shape)
 *   - architecture.md §13 R-name-collision NEW invariant collision (Path a
 *     RESOLVES double pair CreatePaymentInput/CreatePaymentServiceInput
 *     ambiguity — cementación target D1)
 *   - architecture.md §13.A features-legacy-type-only-import (WHOLESALE
 *     RESOLUCIÓN — drops cross-module type-only import vector entire 1ra C2
 *     + 2da C3 + 3ra C4-α evidencias cumulative resueltas wholesale)
 *   - engram poc-nuevo/payment/c4-alpha/closed (precedent inmediato C4-α GREEN
 *     `fcfc7e1` cumulative single feature axis sub-cycle continuation)
 *   - engram poc-nuevo/payment/c3/closed (precedent C3 GREEN `f93dbd4` Path
 *     β-prod scope drop type axis PaymentWithRelations + hex local DTO
 *     canonical home presentation/dto/payment-with-relations.ts EXACT mirror
 *     convention pre-existing)
 *   - engram poc-paired/c7/closed (precedent paired-pr C7 Opción B EXACT
 *     atomic delete wholesale + cleanup superseded tests cumulative)
 *   - engram feedback/red-regex-discipline (mirror precedent EXACT
 *     convenciones — ^...m anchor import statements + \?? optional + \b
 *     boundaries + ["'] flexible quotes)
 *   - engram feedback/red-acceptance-failure-mode (failure mode honest
 *     enumerated 12/12 single side payment cumulative cross-POC)
 *   - engram feedback/canonical-rule-application-commit-body (cite +
 *     rationale + cross-ref applied RED body — §13.A5-ε 3ra + §13
 *     R-name-collision RESOLVES + §13.A WHOLESALE RESOLUCIÓN cumulative)
 *   - engram feedback/retirement-reinventory-gate (5-axis + 8-9 axes
 *     classification applied Step 0 expand pre-RED MANDATORY: CONSUMER 3 +
 *     TEST-SHAPE-ASSERTION-NEGATIVE 3 + RESIDUAL 0 + DEAD-IMPORT 0 +
 *     vi.mock 0 + value imports 0 — verified clean pre-RED)
 *   - engram feedback/diagnostic-stash-gate-pattern (Marco lock procedure
 *     PROACTIVE applied post-GREEN — cumulative cross-POC 11ma evidencia
 *     anticipated this RED→GREEN turn)
 *   - engram feedback/textual-rule-verification (cumulative invariant
 *     arithmetic preservation forward-applicable — suite 5232 invariant
 *     post-C4-β prediction NO test deltas solo source DELETE)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C4-β scope target paths ──────────────────────────────────────────────────

// NEW LOCAL DTO file (Test 0)
const LOCAL_DTO_FILE = path.join(
  REPO_ROOT,
  "modules/payment/presentation/dto/payment-input-types.ts",
);

// 6 archivos features/payment/* DELETE wholesale (Tests 1-6)
const LEGACY_INDEX_FILE = path.join(REPO_ROOT, "features/payment/index.ts");
const LEGACY_REPOSITORY_FILE = path.join(
  REPO_ROOT,
  "features/payment/payment.repository.ts",
);
const LEGACY_SERVICE_FILE = path.join(
  REPO_ROOT,
  "features/payment/payment.service.ts",
);
const LEGACY_TYPES_FILE = path.join(
  REPO_ROOT,
  "features/payment/payment.types.ts",
);
const LEGACY_VALIDATION_FILE = path.join(
  REPO_ROOT,
  "features/payment/payment.validation.ts",
);
const LEGACY_SERVER_FILE = path.join(REPO_ROOT, "features/payment/server.ts");

// rmdir features/payment/ directory (Test 7)
const LEGACY_DIR = path.join(REPO_ROOT, "features/payment");

// Cross-feature TYPE swap consumers (Tests 8-10)
const ADAPTER_FILE = path.join(
  REPO_ROOT,
  "modules/payment/presentation/payment-service.adapter.ts",
);
const PAYMENT_LIST_FILE = path.join(
  REPO_ROOT,
  "components/payments/payment-list.tsx",
);
const PAYMENT_FORM_FILE = path.join(
  REPO_ROOT,
  "components/payments/payment-form.tsx",
);

// ── Regex patterns (mirror precedent EXACT — feedback/red-regex-discipline) ──

// Test 8 — Adapter TYPE imports split LOCAL DTO + hex barrel
// Accept relative `./dto/payment-input-types` OR alias path for LOCAL DTO;
// accept relative `./server` OR alias path for hex barrel.
const ADAPTER_LOCAL_DTO_CREATE_RE =
  /^import\s+type\s+\{[^}]*\bCreatePaymentInput\b[^}]*\}\s+from\s+["'](?:\.\/dto\/payment-input-types|@\/modules\/payment\/presentation\/dto\/payment-input-types)["']/m;
const ADAPTER_LOCAL_DTO_UPDATE_RE =
  /^import\s+type\s+\{[^}]*\bUpdatePaymentInput\b[^}]*\}\s+from\s+["'](?:\.\/dto\/payment-input-types|@\/modules\/payment\/presentation\/dto\/payment-input-types)["']/m;
const ADAPTER_LOCAL_DTO_ALLOCATION_RE =
  /^import\s+type\s+\{[^}]*\bAllocationInput\b[^}]*\}\s+from\s+["'](?:\.\/dto\/payment-input-types|@\/modules\/payment\/presentation\/dto\/payment-input-types)["']/m;
const ADAPTER_HEX_BARREL_FILTERS_RE =
  /^import\s+type\s+\{[^}]*\bPaymentFilters\b[^}]*\}\s+from\s+["'](?:\.\/server|@\/modules\/payment\/presentation\/server)["']/m;
const ADAPTER_HEX_BARREL_CREDIT_RE =
  /^import\s+type\s+\{[^}]*\bCreditAllocationSource\b[^}]*\}\s+from\s+["'](?:\.\/server|@\/modules\/payment\/presentation\/server)["']/m;
const ADAPTER_LEGACY_FEATURES_IMPORT_RE =
  /^import\s+type\s+\{[^}]*\}\s+from\s+["']@\/features\/payment\/payment\.types["']/m;

// Test 9 — payment-list.tsx PaymentDirection cross-feature TYPE swap
const PAYMENT_LIST_HEX_PAYMENT_DIRECTION_RE =
  /^import\s+type\s+\{[^}]*\bPaymentDirection\b[^}]*\}\s+from\s+["']@\/modules\/payment\/presentation\/server["']/m;
const PAYMENT_LIST_LEGACY_FEATURES_IMPORT_RE =
  /^import\s+type\s+\{[^}]*\}\s+from\s+["']@\/features\/payment\/payment\.types["']/m;

// Test 10 — payment-form.tsx 3 tipos cross-feature TYPE swap
const PAYMENT_FORM_HEX_PAYMENT_DIRECTION_RE =
  /^import\s+type\s+\{[^}]*\bPaymentDirection\b[^}]*\}\s+from\s+["']@\/modules\/payment\/presentation\/server["']/m;
const PAYMENT_FORM_HEX_PAYMENT_METHOD_RE =
  /^import\s+type\s+\{[^}]*\bPaymentMethod\b[^}]*\}\s+from\s+["']@\/modules\/payment\/presentation\/server["']/m;
const PAYMENT_FORM_HEX_CREDIT_SOURCE_RE =
  /^import\s+type\s+\{[^}]*\bCreditAllocationSource\b[^}]*\}\s+from\s+["']@\/modules\/payment\/presentation\/server["']/m;
const PAYMENT_FORM_LEGACY_FEATURES_IMPORT_RE =
  /^import\s+type\s+\{[^}]*\}\s+from\s+["']@\/features\/payment\/payment\.types["']/m;

// Test 11 — PROJECT-scope safety net forward-looking zero residual real
// imports legacy alias. Excluding test files (test-shape-assertion-negative
// paths) — JSDoc cross-ref citations + regex `not.toMatch` patterns inside
// test files NOT real imports per inventory pre-RED Step 0 expand.
const PROJECT_LEGACY_FEATURES_PAYMENT_IMPORT_RE =
  /from\s+["']@\/features\/payment(?:\/[^"']*)?["']/;

function* walkSourceFiles(dir: string): Generator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Skip irrelevant directories (perf + non-source content)
      if (
        e.name === "node_modules" ||
        e.name === ".next" ||
        e.name === ".git" ||
        e.name === "coverage" ||
        e.name === "out" ||
        e.name === "build" ||
        e.name === "__tests__"
      ) {
        continue;
      }
      yield* walkSourceFiles(full);
    } else if (
      e.isFile() &&
      (e.name.endsWith(".ts") || e.name.endsWith(".tsx"))
    ) {
      // Skip test files (test-shape-assertion-negative exclusion per Marco
      // lock T11 PROJECT-scope safety net forward-looking)
      if (
        e.name.endsWith(".test.ts") ||
        e.name.endsWith(".test.tsx") ||
        e.name.endsWith(".spec.ts") ||
        e.name.endsWith(".spec.tsx")
      ) {
        continue;
      }
      yield full;
    }
  }
}

describe("POC nuevo payment C4-β — wholesale delete features/payment/* atomic + cross-feature TYPE swap consumers via LOCAL DTO presentation/dto/ canonical home (Path a §13.A5-ε signature divergence MATERIAL 3ra evidencia post-cementación canonical + §13 R-name-collision NEW invariant collision RESOLVES double pair CreatePaymentInput/CreatePaymentServiceInput + §13.A WHOLESALE RESOLUCIÓN drops cross-module type-only import vector entire)", () => {
  // ── A: NEW LOCAL DTO file existence (Test 0) ─────────────────────────────

  it("Test 0 — NEW LOCAL DTO file exists at modules/payment/presentation/dto/payment-input-types.ts (Path a §13.A5-ε MATERIAL divergence resolution canonical home unified UI/API-facing input types cluster)", () => {
    expect(fs.existsSync(LOCAL_DTO_FILE)).toBe(true);
  });

  // ── B: 6 archivos features/payment/* DELETE wholesale (Tests 1-6) ────────

  it("Test 1 — features/payment/index.ts removed wholesale", () => {
    expect(fs.existsSync(LEGACY_INDEX_FILE)).toBe(false);
  });

  it("Test 2 — features/payment/payment.repository.ts removed wholesale", () => {
    expect(fs.existsSync(LEGACY_REPOSITORY_FILE)).toBe(false);
  });

  it("Test 3 — features/payment/payment.service.ts removed wholesale", () => {
    expect(fs.existsSync(LEGACY_SERVICE_FILE)).toBe(false);
  });

  it("Test 4 — features/payment/payment.types.ts removed wholesale", () => {
    expect(fs.existsSync(LEGACY_TYPES_FILE)).toBe(false);
  });

  it("Test 5 — features/payment/payment.validation.ts removed wholesale", () => {
    expect(fs.existsSync(LEGACY_VALIDATION_FILE)).toBe(false);
  });

  it("Test 6 — features/payment/server.ts removed wholesale", () => {
    expect(fs.existsSync(LEGACY_SERVER_FILE)).toBe(false);
  });

  // ── C: rmdir features/payment/ directory (Test 7) ────────────────────────

  it("Test 7 — features/payment/ directory rmdir wholesale (no orphan empty dir)", () => {
    expect(fs.existsSync(LEGACY_DIR)).toBe(false);
  });

  // ── D: Adapter cross-feature TYPE swap split LOCAL DTO + hex barrel (Test 8) ──
  // CreatePaymentInput + UpdatePaymentInput + AllocationInput from LOCAL DTO
  // (Path a §13.A5-ε divergence MATERIAL preservation legacy shape +
  // co-location unified canonical home Marco lock #4) + PaymentFilters +
  // CreditAllocationSource from hex barrel (single source-of-truth Marco lock
  // #5) + NO legacy `@/features/payment/payment.types` import (wholesale drop
  // §13.A WHOLESALE RESOLUCIÓN).

  it("Test 8 — Adapter TYPE imports split: CreatePaymentInput + UpdatePaymentInput + AllocationInput from LOCAL DTO + PaymentFilters + CreditAllocationSource from hex barrel + NO legacy features/payment/payment.types import (Path a §13.A5-ε MATERIAL + §13 R-name-collision RESOLVES + §13.A WHOLESALE)", () => {
    const content = fs.readFileSync(ADAPTER_FILE, "utf8");
    expect(content).toMatch(ADAPTER_LOCAL_DTO_CREATE_RE);
    expect(content).toMatch(ADAPTER_LOCAL_DTO_UPDATE_RE);
    expect(content).toMatch(ADAPTER_LOCAL_DTO_ALLOCATION_RE);
    expect(content).toMatch(ADAPTER_HEX_BARREL_FILTERS_RE);
    expect(content).toMatch(ADAPTER_HEX_BARREL_CREDIT_RE);
    expect(content).not.toMatch(ADAPTER_LEGACY_FEATURES_IMPORT_RE);
  });

  // ── E: payment-list.tsx cross-feature TYPE swap (Test 9) ─────────────────
  // PaymentDirection import legacy → hex barrel canonical home alias
  // (TYPE-only erasure safe vs server-only directive convention pre-existing
  // precedent C3 EXACT — `import type` fully erased compile-time).

  it("Test 9 — payment-list.tsx imports PaymentDirection from hex barrel (TYPE-only erasure safe vs server-only directive convention pre-existing precedent C3 EXACT) + NO legacy features/payment/payment.types import", () => {
    const content = fs.readFileSync(PAYMENT_LIST_FILE, "utf8");
    expect(content).toMatch(PAYMENT_LIST_HEX_PAYMENT_DIRECTION_RE);
    expect(content).not.toMatch(PAYMENT_LIST_LEGACY_FEATURES_IMPORT_RE);
  });

  // ── F: payment-form.tsx cross-feature TYPE swap (Test 10) ────────────────
  // PaymentDirection + PaymentMethod + CreditAllocationSource imports legacy
  // → hex barrel canonical home alias.

  it("Test 10 — payment-form.tsx imports PaymentDirection + PaymentMethod + CreditAllocationSource from hex barrel (TYPE-only erasure safe convention C3 EXACT) + NO legacy features/payment/payment.types import", () => {
    const content = fs.readFileSync(PAYMENT_FORM_FILE, "utf8");
    expect(content).toMatch(PAYMENT_FORM_HEX_PAYMENT_DIRECTION_RE);
    expect(content).toMatch(PAYMENT_FORM_HEX_PAYMENT_METHOD_RE);
    expect(content).toMatch(PAYMENT_FORM_HEX_CREDIT_SOURCE_RE);
    expect(content).not.toMatch(PAYMENT_FORM_LEGACY_FEATURES_IMPORT_RE);
  });

  // ── G: PROJECT-scope safety net forward-looking (Test 11) ────────────────
  // Excluding test files (test-shape-assertion-negative paths) — JSDoc
  // cross-ref citations + regex `not.toMatch` patterns inside test files NOT
  // real imports (per inventory pre-RED Step 0 expand classification verified
  // clean — 3 test files c0-pre + c1 + c4-alpha contain JSDoc strings only).

  it("Test 11 — PROJECT-scope safety net zero real imports residual `from \"@/features/payment(/...)?\"` (excluding __tests__/ + *.test.* + *.spec.* test-shape-assertion-negative paths)", () => {
    const offenders: string[] = [];
    for (const file of walkSourceFiles(REPO_ROOT)) {
      const content = fs.readFileSync(file, "utf8");
      if (PROJECT_LEGACY_FEATURES_PAYMENT_IMPORT_RE.test(content)) {
        offenders.push(path.relative(REPO_ROOT, file));
      }
    }
    expect(
      offenders,
      `legacy imports residual: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
