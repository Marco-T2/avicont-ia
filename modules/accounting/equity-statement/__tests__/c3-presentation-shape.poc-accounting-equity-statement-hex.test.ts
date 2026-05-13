import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C3 RED — Presentation layer shape tests for POC accounting-equity-statement-hex.
 * Paired sister: modules/accounting/trial-balance/__tests__/c3-presentation-shape.poc-accounting-trial-balance-hex.test.ts
 *                (GREEN `2a50c2ca` — D5 INVERSE: server.ts + index.ts, NO client.ts)
 *
 * AXIS-DISTINCT from TB sister:
 * - composition-root.ts wires 2 adapters (PrismaEquityStatementRepo + PrismaIncomeStatementSourceAdapter)
 * - vs TB single-adapter (PrismaTrialBalanceRepo only)
 * - server.ts ADDS `import "server-only"` (features/accounting/equity-statement/server.ts
 *   did NOT have it — features/ had server-only in service.ts, not server.ts). MUST ADD per R3.
 *
 * D5 INVERSE locked (mirror of sister):
 * - NO client.ts — equity-statement has ZERO React hooks; consumers use direct API fetch
 * - NO "use client" directive anywhere in the module
 * - dispatch-hex pattern: server.ts (`import "server-only"`) + index.ts (client-safe TYPE barrel)
 *
 * PRE-C3 Next.js doc-read lock (server-only pattern):
 * - `import "server-only"` = NPM runtime import → build-time error if client-bundled
 * - DISTINCT from `"use server"` directive (Server Functions/actions)
 * - index.ts TYPE-only = client-safe (no directive needed)
 *
 * Expected failure mode: ENOENT — presentation/ files absent pre-GREEN per
 * [[red_acceptance_failure_mode]]. C0+C1+C2 52α stable; this RED adds α53..α70 (18 new).
 * CONDITIONAL-PASS pre-GREEN:
 *   α69: client.ts absent → existsSync(false) → PASS
 *   α70: walkSources returns empty (no presentation/ files yet) → no "use client" → PASS
 *
 * REQ mapping:
 * - Block 1 (α53-α56): composition-root.ts — makeEquityStatementService factory +
 *   EquityStatementService ref + BOTH adapters (PrismaEquityStatementRepo + PrismaIncomeStatementSourceAdapter)
 * - Block 2 (α57-α64): server.ts — `import "server-only"` line 1 POSITIONAL (REQ-002) +
 *   key re-exports (service, factory, schema, pdf, xlsx, no circular)
 * - Block 3 (α65-α68): index.ts — client-safe TYPE barrel (domain types + no server-only)
 * - Block 4 (α69-α70): REQ-002 NEGATIVE — NO client.ts (D5 INVERSE) + NO "use client"
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel does NOT reference any app/api/** or components/** consumer paths (C4 targets).
 * C0..C2 sentinels confirmed to NOT assert on presentation/ content (domains DISJOINT).
 */

const ROOT = path.resolve(__dirname, "../../../..");
const PRESENTATION = path.join(
  ROOT,
  "modules/accounting/equity-statement/presentation",
);
const MODULE_ROOT = path.join(ROOT, "modules/accounting/equity-statement");

function presentationFile(relative: string): string {
  return path.join(PRESENTATION, relative);
}

function readPresentationFile(relative: string): string {
  const filePath = presentationFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/equity-statement/presentation/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

/**
 * Walk a directory recursively and return source file contents joined.
 * Used for REQ-002 NEGATIVE "use client" scan.
 * Excludes __tests__ and node_modules.
 */
function walkSources(dir: string): string {
  if (!fs.existsSync(dir)) return "";
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const parts: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__tests__" || e.name === "node_modules") continue;
      parts.push(walkSources(full));
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
      parts.push(fs.readFileSync(full, "utf8"));
    }
  }
  return parts.join("\n");
}

describe("POC accounting-equity-statement-hex C3 — presentation layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — composition-root.ts (makeEquityStatementService zero-arg factory)
  // AXIS-DISTINCT: wires 2 adapters vs TB's 1 adapter.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — composition-root.ts (makeEquityStatementService zero-arg, 2-adapter wiring)", () => {
    it("α53: makeEquityStatementService is exported as a function from presentation/composition-root.ts", () => {
      const content = readPresentationFile("composition-root.ts");
      expect(content).toMatch(
        /export\s+(?:function\s+makeEquityStatementService|const\s+makeEquityStatementService\s*=)/m,
      );
    });

    it("α54: makeEquityStatementService references EquityStatementService (class must be wired)", () => {
      const content = readPresentationFile("composition-root.ts");
      expect(content).toMatch(/EquityStatementService/m);
    });

    it("α55: composition-root.ts wires PrismaEquityStatementRepo (first adapter — EquityStatementQueryPort)", () => {
      const content = readPresentationFile("composition-root.ts");
      expect(content).toMatch(/PrismaEquityStatementRepo/m);
    });

    it("α56: composition-root.ts wires PrismaIncomeStatementSourceAdapter (second adapter — axis-distinct, IncomeStatementSourcePort)", () => {
      const content = readPresentationFile("composition-root.ts");
      expect(content).toMatch(/PrismaIncomeStatementSourceAdapter/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — server.ts (REQ-002 + composition-root + key re-exports)
  // `import "server-only"` must be LINE 1 (positional check per PRE-C3 lock).
  // NOTE: features/accounting/equity-statement/server.ts did NOT have server-only;
  // this new hex barrel ADDS it (not migrated — fresh ADD per R3).
  // ───────────────────────────────────────────────────────────────────────────

  describe('Block 2 — server.ts (REQ-002: `import "server-only"` line 1 + re-exports)', () => {
    it("α57: presentation/server.ts exists", () => {
      const filePath = presentationFile("server.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/equity-statement/presentation/server.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('α58: server.ts line 1 is `import "server-only"` (positional — REQ-002)', () => {
      const content = readPresentationFile("server.ts");
      const firstLine = content.split("\n")[0]!.trim();
      expect(firstLine).toMatch(/^import\s+["']server-only["'];?$/);
    });

    it("α59: server.ts re-exports EquityStatementService", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/EquityStatementService/m);
    });

    it("α60: server.ts re-exports makeEquityStatementService from composition-root", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/makeEquityStatementService/m);
    });

    it("α61: server.ts re-exports equityStatementQuerySchema (Zod schema)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/equityStatementQuerySchema/m);
    });

    it("α62: server.ts re-exports exportEquityStatementPdf (PDF exporter)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/exportEquityStatementPdf/m);
    });

    it("α63: server.ts re-exports exportEquityStatementXlsx (XLSX exporter)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/exportEquityStatementXlsx/m);
    });

    it("α64: server.ts does NOT import index.ts (no circular barrel dependency)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).not.toMatch(/from\s+["']\.\/index["']/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — index.ts (client-safe barrel: TYPE re-exports)
  // D5 INVERSE: no server-only import, no client directive.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — index.ts (client-safe barrel per D5 INVERSE)", () => {
    it("α65: presentation/index.ts exists", () => {
      const filePath = presentationFile("index.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/equity-statement/presentation/index.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α66: index.ts re-exports core domain types (EquityStatement, ColumnKey, RowKey)", () => {
      const content = readPresentationFile("index.ts");
      expect(content).toMatch(/EquityStatement/m);
      expect(content).toMatch(/ColumnKey/m);
      expect(content).toMatch(/RowKey/m);
    });

    it("α67: index.ts re-exports SerializedEquityStatement type", () => {
      const content = readPresentationFile("index.ts");
      expect(content).toMatch(/SerializedEquityStatement/m);
    });

    it("α68: index.ts does NOT import server-only (client-safe — no server boundary)", () => {
      const content = readPresentationFile("index.ts");
      expect(content).not.toMatch(/import\s+["']server-only["']/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — REQ-002 NEGATIVE (D5 INVERSE assertions)
  // NO client.ts — equity-statement has ZERO React hooks.
  // NO "use client" directive anywhere in the module.
  // Note: literal client-directive strings must be paraphrased in JSDoc/comments per
  // [[engram_textual_rule_verification]] gotcha (TB C3 lesson — GREEN 2a50c2ca).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — REQ-002 NEGATIVE: D5 INVERSE (no client.ts, no use-client directive)", () => {
    it("α69: NO presentation/client.ts file exists (D5 INVERSE — zero React hooks in consumers)", () => {
      const clientTs = presentationFile("client.ts");
      // CONDITIONAL-PASS pre-GREEN: client.ts absent pre-GREEN → existsSync(false) → PASS.
      // Must remain false post-GREEN: equity-statement consumers use direct API fetch,
      // importing TYPES only from barrel — no client.ts needed.
      expect(fs.existsSync(clientTs)).toBe(false);
    });

    it('α70: NO client-bundle directive exists anywhere in modules/accounting/equity-statement/**', () => {
      // CONDITIONAL-PASS pre-GREEN: presentation/ absent → walkSources returns empty → PASS.
      // Note: JSDoc comments must paraphrase the client-directive string (not quote literally)
      // per [[engram_textual_rule_verification]] gotcha to avoid false positives here.
      const blob = walkSources(MODULE_ROOT);
      expect(blob).not.toMatch(/["']use client["']/m);
    });
  });
});
