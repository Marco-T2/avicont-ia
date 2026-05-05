/**
 * POC nuevo payment C4-α RED — Adapter Layer presentation/ delegate via reader
 * port + composition-root chain canonical R4 exception path EXACT mirror α-A3.B
 * (shim functional move legitimate translation logic split read/write roles
 * post invariant collision retroactive escalation).
 *
 * Marco lock chain (cumulative resolution path Sub-opción 2 → C → B2):
 *   - Sub-opción 2 split C4-α cutover production + C4-β delete wholesale
 *     (5 ciclos → 6 ciclos expand Marco lock L1 ESTRICTO retroactive — cementación
 *     target D1 lección REFINED feedback/marco-lock-L1-estricto-expand-axis-distinct-collision).
 *   - Sub-opción C precedent α-A3.B EXACT con role separation cleaner: read-side
 *     queries Prisma value INTO infrastructure reader adapter, write-side
 *     translation logic INTO presentation Adapter delegate via composition-root
 *     chain (canonical R4 exception path EXACT mirror paired C1b-α `89e6441`).
 *   - Sub-opción B2 PaymentNotFound class hex domain mirror IvaBookNotFound +
 *     ContactNotFound canonical pattern (NEW class extends NotFoundError +
 *     `import { NotFoundError } from "@/features/shared/errors"` convention
 *     canonical hex actual cumulative cross-modules preserved at domain layer).
 *   - Sub-issue A resolution: MOVE mapper.ts presentation/mappers/ →
 *     infrastructure/mappers/ mismo batch C4-α (paymentInclude + toPaymentWithRelations
 *     conceptualmente data-access concern, infrastructure layer canonical home
 *     post-move drop reverse smell + DRY violation).
 *
 * Scope C4-α atomic single batch — 8 archivos (3 NEW + 1 MOVE + 5 UPDATE):
 *   1. NEW modules/payment/domain/ports/payment-with-relations-reader.port.ts
 *   2. NEW modules/payment/infrastructure/adapters/payment-with-relations.reader.adapter.ts
 *   3. MOVE modules/payment/{presentation→infrastructure}/mappers/payment-with-relations.mapper.ts
 *   4. NEW modules/payment/presentation/payment-service.adapter.ts
 *   5. UPDATE modules/payment/presentation/composition-root.ts (+wire reader +
 *      makePaymentServiceAdapter factory + PaymentService re-export chain)
 *   6. UPDATE modules/payment/presentation/server.ts (drop línea 86 +
 *      re-export from composition-root chain canonical R4 exception)
 *   7. UPDATE app/api/.../unapplied-payments/route.ts (PrismaPaymentsRepository
 *      cutover trivial, drop legacy PaymentRepository alias)
 *   8. UPDATE features/payment/payment.service.ts (delegate Prisma queries
 *      removed + mapper import path swap a infrastructure — preserve transitorio
 *      post-C4-α, full removal C4-β)
 *   9. UPDATE modules/payment/domain/errors/payment-errors.ts (+class
 *      PaymentNotFound extends NotFoundError mirror IvaBookNotFound canonical)
 *
 * 7 PaymentService production callsites (NO 8 per Marco lock count
 * calibration — empirically grep PROJECT-scope: 2 pages dashboard + 5 routes
 * API, NOT 6) preservation positive — imports `from "@/modules/payment/presentation/server"`
 * NO cambian post-GREEN (Adapter target underneath swapped via composition-root
 * chain transparent a callsites):
 *   - app/(dashboard)/[orgSlug]/payments/page.tsx
 *   - app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx
 *   - app/api/organizations/[orgSlug]/payments/route.ts
 *   - app/api/organizations/[orgSlug]/payments/[paymentId]/route.ts
 *   - app/api/organizations/[orgSlug]/payments/[paymentId]/status/route.ts
 *   - app/api/organizations/[orgSlug]/payments/[paymentId]/allocations/route.ts
 *   - app/api/organizations/[orgSlug]/payments/apply-credits/route.ts
 *
 * 1 PaymentRepository production callsite cutover trivial (PrismaPaymentsRepository
 * hex direct, method invocation idéntica `findUnappliedByContact`):
 *   - app/api/organizations/[orgSlug]/contacts/[contactId]/unapplied-payments/route.ts
 *
 * §13 NEW classification cementación target D1 doc-only — "Adapter Layer
 * presentation/ delegate via reader port + composition-root chain canonical R4
 * exception path EXACT mirror α-A3.B" (1ra evidencia POC payment C4-α
 * cumulative 2da evidencia post paired C1b-α α-A3.B canonical R4 exception
 * precedent EXACT). Distinto §13.A5-ε signature divergence drop alias (cuando
 * shim cosmetic only) y distinto §13.B-paired DTO drop axis paired (paired-only).
 * Esta es shim functional move legitimate translation layer split read/write
 * roles. Sub-pattern emergent: paymentInclude + mapper move from presentation/
 * → infrastructure/ when Prisma include shape + row→DTO assembly conceptual
 * data-access concern (NOT presentation/dto territory).
 *
 * §13.A5-ε signature divergence drop alias 2da evidencia POST-cementación
 * canonical applied este turno C4-α — hex `PaymentsService` (lowercase plural)
 * + `makePaymentsService(deps)` factory NO drop-in legacy `PaymentService`
 * (UpperCase singular zero-arg construct). Adapter Layer encapsula args
 * reorder + envelope DTO PaymentWithRelations + zero-arg construct via
 * composition-root deps injection internal — translation logic legitimate
 * Adapter pattern hex permanent (NOT transitional cleanup target).
 *
 * §13.A5-α multi-level composition delegation NEW evidencia matures cumulative
 * cross-POC sub-cycle continuation — Adapter delegate inner PaymentsService
 * + reader port inyectado via composition-root chain (multi-level: callsite →
 * server.ts barrel → composition-root → Adapter → inner PaymentsService).
 *
 * Failure mode honest declared α (mirror feedback_red_acceptance_failure_mode
 * cumulative cross-POC 14 assertions — 13 FAIL + 1 PASS preservation):
 *   - Tests 1-3: 3 NEW files don't exist pre-GREEN → fs.existsSync false →
 *     expect(true).toBe(false) FAILS
 *   - Test 4: NEW mapper infra location absent pre-GREEN → fs.existsSync
 *     false → FAILS
 *   - Test 5: OLD mapper presentation location still exists pre-GREEN →
 *     fs.existsSync true → expect(false).toBe(true) FAILS
 *   - Test 6: PaymentNotFound class absent pre-GREEN → regex no match → FAILS
 *   - Test 7: reader port interface shape verify (file absent → existsSync
 *     guard short-circuit → existence FAIL trips test before content read)
 *   - Test 8: reader adapter implements port + Prisma queries (file absent →
 *     existence guard FAIL)
 *   - Test 9: presentation Adapter class delegate + R5 honored (file absent →
 *     existence guard FAIL)
 *   - Test 10: composition-root NO contains makePaymentServiceAdapter factory + reader
 *     wire pre-GREEN → regex no match → FAILS
 *   - Test 11: server.ts línea 86 still has from "@/features/payment/server"
 *     pre-GREEN → regex matches legacy → FAILS expect not toMatch
 *   - Test 12: unapplied-payments still imports PaymentRepository legacy
 *     pre-GREEN → regex matches → FAILS expect not toMatch
 *   - Test 13: 7 PaymentService production callsites preservation positive —
 *     PASS pre-GREEN AND post-GREEN (preservation honest declared)
 *   - Test 14: legacy shim still has prisma queries + presentation mapper
 *     import pre-GREEN → regex matches legacy → FAILS expect not toMatch
 *
 * Cross-ref:
 *   - architecture.md §13.A5-α MATERIAL cumulative cross-POC sub-cycle (Adapter
 *     delegate multi-level composition NEW evidencia matures)
 *   - architecture.md §13.A5-ε signature divergence drop alias (3ra evidencia
 *     post-cementación canonical applied C4-α split clean axis)
 *   - architecture.md §13 NEW classification "Adapter Layer presentation/
 *     delegate via reader port + composition-root chain canonical R4 exception
 *     path EXACT mirror α-A3.B" (cementación target D1)
 *   - engram canonical home `arch/§13/A5-alpha-multi-level-composition-root-delegation`
 *   - engram canonical home `arch/§13/A-features-legacy-type-only-import` (post
 *     C4-α resolves cross-module type-only import desaparece definitivamente
 *     post-mapper-move + Adapter)
 *   - engram poc-paired/c1b-alpha/closed `89e6441` (precedent α-A3.B canonical
 *     R4 exception path EXACT — composition-root chain + functional move INTO
 *     infrastructure)
 *   - engram poc-nuevo/payment/c3/closed (precedent inmediato C3 GREEN
 *     `f93dbd4` cumulative single-feature axis)
 *   - engram feedback/marco-lock-L1-estricto-expand-axis-distinct-collision NEW
 *     (cementación target D1 — cuando emerge axis-distinct invariant collision
 *     post-cycle-start lock, expand granularity retroactive split sub-cycle
 *     supersedes super-batch heterogéneo atomic principle preservation)
 *   - engram feedback/red-regex-discipline (mirror precedent EXACT convenciones
 *     ^...m anchor + \?? optional + \b boundaries + ["'] flexible quotes)
 *   - engram feedback/invariant_collision_elevation (CR1-CR8 sequence applied
 *     este turno: 1ra collision divergence MATERIAL → Sub-opción 2 split,
 *     2da collision precedent contradiction → Sub-opción C role separation,
 *     3ra collision sub-issue B import path → B2 PaymentNotFound class hex)
 *   - feedback_sub_phase_start_coherence_gate (Step 0 cycle-start cold
 *     completed — bookmark f93dbd4 ↔ repo verified, src/ path correction
 *     surfaced honest)
 *   - feedback_red_acceptance_failure_mode (failure mode declared per test
 *     above)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C4-α scope target paths ───────────────────────────────────────────────────

const READER_PORT_FILE = path.join(
  REPO_ROOT,
  "modules/payment/domain/ports/payment-with-relations-reader.port.ts",
);
const READER_ADAPTER_FILE = path.join(
  REPO_ROOT,
  "modules/payment/infrastructure/adapters/payment-with-relations.reader.adapter.ts",
);
const PRESENTATION_ADAPTER_FILE = path.join(
  REPO_ROOT,
  "modules/payment/presentation/payment-service.adapter.ts",
);
const MAPPER_INFRA_NEW_FILE = path.join(
  REPO_ROOT,
  "modules/payment/infrastructure/mappers/payment-with-relations.mapper.ts",
);
const MAPPER_PRESENTATION_OLD_FILE = path.join(
  REPO_ROOT,
  "modules/payment/presentation/mappers/payment-with-relations.mapper.ts",
);
const PAYMENT_ERRORS_FILE = path.join(
  REPO_ROOT,
  "modules/payment/domain/errors/payment-errors.ts",
);
const COMPOSITION_ROOT_FILE = path.join(
  REPO_ROOT,
  "modules/payment/presentation/composition-root.ts",
);
const SERVER_TS_FILE = path.join(
  REPO_ROOT,
  "modules/payment/presentation/server.ts",
);
const UNAPPLIED_PAYMENTS_ROUTE_FILE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/contacts/[contactId]/unapplied-payments/route.ts",
);

const PAYMENT_SERVICE_CALLSITES = [
  "app/(dashboard)/[orgSlug]/payments/page.tsx",
  "app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx",
  "app/api/organizations/[orgSlug]/payments/route.ts",
  "app/api/organizations/[orgSlug]/payments/[paymentId]/route.ts",
  "app/api/organizations/[orgSlug]/payments/[paymentId]/status/route.ts",
  "app/api/organizations/[orgSlug]/payments/[paymentId]/allocations/route.ts",
  "app/api/organizations/[orgSlug]/payments/apply-credits/route.ts",
] as const;

// ── Regex patterns (mirror precedent EXACT — feedback/red-regex-discipline) ──

// Test 6 — PaymentNotFound class hex domain
const PAYMENT_NOT_FOUND_CLASS_RE =
  /^export\s+class\s+PaymentNotFound\s+extends\s+NotFoundError\b/m;
const NOT_FOUND_ERROR_IMPORT_RE =
  /^import\s+\{[^}]*\bNotFoundError\b[^}]*\}\s+from\s+["']@\/features\/shared\/errors["']/m;

// Test 7 — Reader port interface shape (Path C resolution Collision #1 — Snapshot
// LOCAL inline definition mirror iva-books sale-reader.port.ts:17-28 precedent
// EXACT cumulative cross-module). R1 banDomainCrossLayer honored estricto —
// port file MUST NOT cross-layer import presentation/dto/PaymentWithRelations.
const READER_PORT_INTERFACE_RE =
  /^export\s+interface\s+PaymentWithRelationsReaderPort\b/m;
const READER_PORT_SNAPSHOT_INTERFACE_RE =
  /^export\s+interface\s+PaymentWithRelationsSnapshot\b/m;
const READER_PORT_NO_CROSS_LAYER_DTO_IMPORT_RE =
  /^import\s+type\s+\{[^}]*\bPaymentWithRelations\b[^}]*\}\s+from\s+["']@\/modules\/payment\/presentation\/dto\/payment-with-relations["']/m;
const READER_PORT_FIND_ALL_RE =
  /findAllWithRelations\s*\([^)]*organizationId\s*:\s*string[^)]*\)\s*:\s*Promise<\s*PaymentWithRelationsSnapshot\[\]\s*>/;
const READER_PORT_FIND_BY_ID_RE =
  /findByIdWithRelations\s*\([^)]*organizationId\s*:\s*string[^)]*id\s*:\s*string[^)]*\)\s*:\s*Promise<\s*PaymentWithRelationsSnapshot\s*\|\s*null\s*>/;

// Test 8 — Reader adapter implements port + Prisma queries
const READER_ADAPTER_IMPLEMENTS_RE =
  /^export\s+class\s+PrismaPaymentWithRelationsReaderAdapter\s+implements\s+PaymentWithRelationsReaderPort\b/m;
const READER_ADAPTER_PRISMA_VALUE_IMPORT_RE =
  /^import\s+\{[^}]*\bprisma\b[^}]*\}\s+from\s+["']@\/lib\/prisma["']/m;
const READER_ADAPTER_MAPPER_IMPORT_RE =
  /^import\s+\{[^}]*\b(paymentInclude|toPaymentWithRelations)\b[^}]*\}\s+from\s+["']\.\.\/mappers\/payment-with-relations\.mapper["']/m;

// Test 9 — Presentation Adapter class delegate + R5 honored (NO Prisma value)
const PRESENTATION_ADAPTER_CLASS_RE =
  /^export\s+class\s+PaymentService\b/m;
const PRESENTATION_ADAPTER_NO_PRISMA_VALUE_RE =
  /^import\s+\{[^}]*\bprisma\b[^}]*\}\s+from\s+["']@\/lib\/prisma["']/m;
const PRESENTATION_ADAPTER_INNER_DELEGATE_RE =
  /import\s+\{[^}]*\bmakePaymentsService\b[^}]*\}\s+from\s+["']\.\/composition-root["']|import\s+\{[^}]*\bmakePaymentsService\b[^}]*\}\s+from\s+["']\.\/server["']/;
const PRESENTATION_ADAPTER_READER_PORT_IMPORT_RE =
  /import\s+type\s+\{[^}]*\bPaymentWithRelationsReaderPort\b[^}]*\}\s+from\s+["']\.\.\/domain\/ports\/payment-with-relations-reader\.port["']/;
const PRESENTATION_ADAPTER_PAYMENT_NOT_FOUND_IMPORT_RE =
  /import\s+\{[^}]*\bPaymentNotFound\b[^}]*\}\s+from\s+["']\.\.\/domain\/errors\/payment-errors["']/;

// Test 10 — composition-root wire NEW makePaymentService factory + reader
const COMPOSITION_MAKE_PAYMENT_SERVICE_RE =
  /^export\s+function\s+makePaymentServiceAdapter\s*\(\s*\)\s*:\s*PaymentService\b/m;
const COMPOSITION_PAYMENT_SERVICE_RE_EXPORT_RE =
  /^export\s+\{[^}]*\bPaymentService\b[^}]*\}\s+from\s+["']\.\/payment-service\.adapter["']/m;
const COMPOSITION_READER_ADAPTER_IMPORT_RE =
  /^import\s+\{[^}]*\bPrismaPaymentWithRelationsReaderAdapter\b[^}]*\}\s+from\s+["']\.\.\/infrastructure\/adapters\/payment-with-relations\.reader\.adapter["']/m;

// Test 11 — server.ts re-export chain (DROP línea 86 + ADD chain)
const SERVER_LEGACY_REEXPORT_RE =
  /^export\s+\{[^}]*\bPaymentService\b[^}]*\}\s+from\s+["']@\/features\/payment\/server["']/m;
const SERVER_COMPOSITION_REEXPORT_RE =
  /^export\s+\{[^}]*\bPaymentService\b[^}]*\}\s+from\s+["']\.\/composition-root["']/m;

// Test 12 — unapplied-payments PaymentRepository cutover trivial
const UNAPPLIED_LEGACY_IMPORT_RE =
  /^import\s+\{[^}]*\bPaymentRepository\b[^}]*\}\s+from\s+["']@\/modules\/payment\/presentation\/server["']/m;
const UNAPPLIED_LEGACY_NEW_RE = /\bnew\s+PaymentRepository\s*\(\s*\)/;
const UNAPPLIED_HEX_IMPORT_RE =
  /^import\s+\{[^}]*\bPrismaPaymentsRepository\b[^}]*\}\s+from\s+["']@\/modules\/payment\/presentation\/server["']/m;
const UNAPPLIED_HEX_NEW_RE = /\bnew\s+PrismaPaymentsRepository\s*\(\s*\)/;

// Test 13 — 7 PaymentService production callsites preservation positive
const CALLSITE_PAYMENT_SERVICE_IMPORT_RE =
  /^import\s+\{[^}]*\bPaymentService\b[^}]*\}\s+from\s+["']@\/modules\/payment\/presentation\/server["']/m;

describe("POC nuevo payment C4-α — Adapter Layer presentation/ delegate via reader port + composition-root chain canonical R4 exception path EXACT mirror α-A3.B (Sub-opción 2 split + Sub-opción C role separation + Sub-opción B2 PaymentNotFound class hex domain)", () => {
  // ── A: NEW files existence (Tests 1-3) ────────────────────────────────────

  it("Test 1 — NEW reader port file exists at modules/payment/domain/ports/", () => {
    expect(fs.existsSync(READER_PORT_FILE)).toBe(true);
  });

  it("Test 2 — NEW reader adapter file exists at modules/payment/infrastructure/adapters/", () => {
    expect(fs.existsSync(READER_ADAPTER_FILE)).toBe(true);
  });

  it("Test 3 — NEW presentation Adapter file exists at modules/payment/presentation/", () => {
    expect(fs.existsSync(PRESENTATION_ADAPTER_FILE)).toBe(true);
  });

  // ── B: MOVE mapper location (Tests 4-5) ───────────────────────────────────
  // Sub-issue A resolution: paymentInclude + toPaymentWithRelations conceptual
  // data-access concern, infrastructure layer canonical home post-move.

  it("Test 4 — MOVE mapper.ts NEW location at infrastructure/mappers/", () => {
    expect(fs.existsSync(MAPPER_INFRA_NEW_FILE)).toBe(true);
  });

  it("Test 5 — MOVE mapper.ts OLD location at presentation/mappers/ removed", () => {
    expect(fs.existsSync(MAPPER_PRESENTATION_OLD_FILE)).toBe(false);
  });

  // ── C: PaymentNotFound class hex domain (Test 6) ──────────────────────────
  // Sub-opción B2: mirror IvaBookNotFound + ContactNotFound canonical pattern.
  // Convention canonical hex actual preserved — NotFoundError parent imported
  // from @/features/shared/errors at domain layer (R5 NO aplica features/,
  // permitido cross-feature import desde modules/{X}/domain/errors/ extends
  // pattern).

  it("Test 6 — PaymentNotFound class extends NotFoundError mirror IvaBookNotFound canonical", () => {
    const exists = fs.existsSync(PAYMENT_ERRORS_FILE);
    expect(exists).toBe(true);
    if (!exists) return;
    const content = fs.readFileSync(PAYMENT_ERRORS_FILE, "utf8");
    expect(content).toMatch(NOT_FOUND_ERROR_IMPORT_RE);
    expect(content).toMatch(PAYMENT_NOT_FOUND_CLASS_RE);
  });

  // ── D: Reader port interface shape (Test 7) ───────────────────────────────

  it("Test 7 — reader port interface shape + Snapshot LOCAL inline def + R1 honor (Path C resolution Collision #1 mirror iva-books precedent EXACT)", () => {
    const exists = fs.existsSync(READER_PORT_FILE);
    expect(exists).toBe(true);
    if (!exists) return;
    const content = fs.readFileSync(READER_PORT_FILE, "utf8");
    expect(content).toMatch(READER_PORT_INTERFACE_RE);
    expect(content).toMatch(READER_PORT_SNAPSHOT_INTERFACE_RE);
    expect(content).not.toMatch(READER_PORT_NO_CROSS_LAYER_DTO_IMPORT_RE);
    expect(content).toMatch(READER_PORT_FIND_ALL_RE);
    expect(content).toMatch(READER_PORT_FIND_BY_ID_RE);
  });

  // ── E: Reader adapter implements port + Prisma queries (Test 8) ───────────

  it("Test 8 — reader adapter implements port + Prisma value imports + mapper invocation", () => {
    const exists = fs.existsSync(READER_ADAPTER_FILE);
    expect(exists).toBe(true);
    if (!exists) return;
    const content = fs.readFileSync(READER_ADAPTER_FILE, "utf8");
    expect(content).toMatch(READER_ADAPTER_IMPLEMENTS_RE);
    expect(content).toMatch(READER_ADAPTER_PRISMA_VALUE_IMPORT_RE);
    expect(content).toMatch(READER_ADAPTER_MAPPER_IMPORT_RE);
  });

  // ── F: Presentation Adapter class delegate + R5 honored (Test 9) ──────────
  // R5 estricto: NO Prisma value imports. Delegate hex inner via composition-root
  // + reader port DI + PaymentNotFound hex domain error.

  it("Test 9 — presentation Adapter class delegate + reader port DI + R5 honored (NO Prisma value)", () => {
    const exists = fs.existsSync(PRESENTATION_ADAPTER_FILE);
    expect(exists).toBe(true);
    if (!exists) return;
    const content = fs.readFileSync(PRESENTATION_ADAPTER_FILE, "utf8");
    expect(content).toMatch(PRESENTATION_ADAPTER_CLASS_RE);
    expect(content).not.toMatch(PRESENTATION_ADAPTER_NO_PRISMA_VALUE_RE);
    expect(content).toMatch(PRESENTATION_ADAPTER_INNER_DELEGATE_RE);
    expect(content).toMatch(PRESENTATION_ADAPTER_READER_PORT_IMPORT_RE);
    expect(content).toMatch(PRESENTATION_ADAPTER_PAYMENT_NOT_FOUND_IMPORT_RE);
  });

  // ── G: composition-root wire (Test 10) ────────────────────────────────────
  // Canonical R4 exception path EXACT mirror α-A3.B — composition-root re-exports
  // PaymentService class from Adapter file + wires reader Adapter into
  // makePaymentService factory.

  it("Test 10 — composition-root wires reader Adapter + makePaymentServiceAdapter factory + PaymentService re-export chain", () => {
    const content = fs.readFileSync(COMPOSITION_ROOT_FILE, "utf8");
    expect(content).toMatch(COMPOSITION_READER_ADAPTER_IMPORT_RE);
    expect(content).toMatch(COMPOSITION_MAKE_PAYMENT_SERVICE_RE);
    expect(content).toMatch(COMPOSITION_PAYMENT_SERVICE_RE_EXPORT_RE);
  });

  // ── H: server.ts re-export chain (Test 11) ────────────────────────────────
  // DROP línea 86 legacy from "@/features/payment/server" + ADD chain via
  // composition-root canonical R4 exception.

  it("Test 11 — server.ts drops legacy línea 86 + adds re-export chain from composition-root", () => {
    const content = fs.readFileSync(SERVER_TS_FILE, "utf8");
    expect(content).not.toMatch(SERVER_LEGACY_REEXPORT_RE);
    expect(content).toMatch(SERVER_COMPOSITION_REEXPORT_RE);
  });

  // ── I: unapplied-payments PaymentRepository cutover trivial (Test 12) ─────
  // PrismaPaymentsRepository hex direct, method invocation findUnappliedByContact
  // idéntica (PaymentRepository legacy class era extends PrismaPaymentsRepository
  // + alias findUnappliedPayments — callsite ya invoca findUnappliedByContact
  // hex root method, NO el alias legacy).

  it("Test 12 — unapplied-payments swaps PaymentRepository legacy → PrismaPaymentsRepository hex direct", () => {
    const content = fs.readFileSync(UNAPPLIED_PAYMENTS_ROUTE_FILE, "utf8");
    expect(content).not.toMatch(UNAPPLIED_LEGACY_IMPORT_RE);
    expect(content).not.toMatch(UNAPPLIED_LEGACY_NEW_RE);
    expect(content).toMatch(UNAPPLIED_HEX_IMPORT_RE);
    expect(content).toMatch(UNAPPLIED_HEX_NEW_RE);
  });

  // ── J: 7 PaymentService production callsites preservation (Test 13) ──────
  // Adapter target underneath swapped via composition-root chain transparent
  // a callsites — imports from "@/modules/payment/presentation/server" NO
  // cambian post-GREEN. PASS preservation honest declared pre-GREEN AND
  // post-GREEN (mirror feedback_red_acceptance_failure_mode precedent C0-pre +
  // C1 + C2 + C3 cumulative).

  it("Test 13 — 7 PaymentService production callsites preservation imports from hex barrel (PASS preservation pre+post-GREEN)", () => {
    for (const callsite of PAYMENT_SERVICE_CALLSITES) {
      const filePath = path.join(REPO_ROOT, callsite);
      const exists = fs.existsSync(filePath);
      expect(exists, `callsite missing: ${callsite}`).toBe(true);
      if (!exists) continue;
      const content = fs.readFileSync(filePath, "utf8");
      expect(content, `callsite import missing: ${callsite}`).toMatch(
        CALLSITE_PAYMENT_SERVICE_IMPORT_RE,
      );
    }
  });
});
