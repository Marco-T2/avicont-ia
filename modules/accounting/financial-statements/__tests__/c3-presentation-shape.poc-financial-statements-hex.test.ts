import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C3 RED — Presentation layer shape tests for POC financial-statements-hex.
 * Paired sister: modules/ai-agent/__tests__/c3-presentation-shape.poc-ai-agent-hex.test.ts
 *                (GREEN `c16510ac` — DUAL-barrel: server.ts + client.ts)
 *                + dispatch-hex (server.ts + index.ts, NO client.ts — ALIGNMENT)
 *
 * AXIS-DISTINCT from ai-agent C3 — D5 INVERSE:
 * - NO client.ts (financial-statements has ZERO React hooks; no useFinancialStatementsQuery)
 * - NO "use client" directive anywhere in the module
 * - dispatch-hex pattern: server.ts (`import "server-only"`) + index.ts (client-safe)
 * - Consumers: RSC pages + API routes (server.ts) + "use client" components that
 *   import TYPES only (index.ts). All verified by pre-RED hook scan (0 hooks found).
 *
 * PRE-C3 Next.js doc-read lock (engram pre-c3-nextjs-lock):
 * - `import "server-only"` (runtime import from NPM package) = build-time client error
 * - DISTINCT from `"use server"` string directive (Server Functions)
 * - `"use client"` only needed for: state, event handlers, lifecycle, browser APIs
 * - index.ts TYPE-only + serializeStatement = client-safe (no directive needed)
 *
 * Expected failure mode: ENOENT — files absent pre-GREEN per
 * [[red_acceptance_failure_mode]]. C0+C1+C2 187α stable; this RED adds α68..α85 (18 new).
 *
 * REQ mapping:
 * - Block 1 (α68-α69): composition-root.ts — makeFinancialStatementsService is function
 *   + returns FinancialStatementsService
 * - Block 2 (α70-α77): server.ts — `import "server-only"` line 1 POSITIONAL + key
 *   re-exports (FinancialStatementsService, makeFinancialStatementsService, Zod schemas,
 *   RUNTIME exports formatBolivianAmount + roundHalfUp + sumDecimals + eq)
 * - Block 3 (α78-α83): index.ts — client-safe barrel (serializeStatement + TYPE re-exports)
 * - Block 4 (α84-α85): REQ-002 NEGATIVE — NO client.ts (D5 INVERSE) + NO "use client"
 *   directive anywhere in modules/accounting/financial-statements/
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel does NOT reference any app/api/** or components/** paths — C4 consumer
 * file paths excluded from C3 assertions.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const PRESENTATION = path.join(
  ROOT,
  "modules/accounting/financial-statements/presentation",
);
const MODULE_ROOT = path.join(ROOT, "modules/accounting/financial-statements");

function presentationFile(relative: string): string {
  return path.join(PRESENTATION, relative);
}

function readPresentationFile(relative: string): string {
  const filePath = presentationFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/financial-statements/presentation/${relative}'`,
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

describe("POC financial-statements-hex C3 — presentation layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — composition-root.ts (makeFinancialStatementsService factory)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — composition-root.ts (makeFinancialStatementsService zero-arg)", () => {
    it("α68: makeFinancialStatementsService is exported as a function from presentation/composition-root.ts", () => {
      const content = readPresentationFile("composition-root.ts");
      // Accept function declaration or arrow function export.
      expect(content).toMatch(
        /export\s+(?:function\s+makeFinancialStatementsService|const\s+makeFinancialStatementsService\s*=)/m,
      );
    });

    it("α69: makeFinancialStatementsService returns FinancialStatementsService (declared or inferred)", () => {
      const content = readPresentationFile("composition-root.ts");
      // Either an explicit return-type annotation or a `new FinancialStatementsService(...)` call
      // whose inferred return satisfies the type. Either way, the class must be referenced.
      expect(content).toMatch(/FinancialStatementsService/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — server.ts (REQ-002 + composition-root + key re-exports)
  // `import "server-only"` must be LINE 1 (positional check per PRE-C3 lock).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 2 — server.ts (REQ-002: `import \"server-only\"` line 1 + re-exports)", () => {
    it("α70: presentation/server.ts exists", () => {
      const filePath = presentationFile("server.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/financial-statements/presentation/server.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α71: server.ts line 1 is `import \"server-only\"` (positional — REQ-002)", () => {
      const content = readPresentationFile("server.ts");
      const firstLine = content.split("\n")[0]!.trim();
      // Must be exactly: import "server-only"; (with or without semicolon)
      expect(firstLine).toMatch(/^import\s+["']server-only["'];?$/);
    });

    it("α72: server.ts re-exports FinancialStatementsService", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/FinancialStatementsService/m);
    });

    it("α73: server.ts re-exports makeFinancialStatementsService from composition-root", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/makeFinancialStatementsService/m);
    });

    it("α74: server.ts re-exports Zod validation schemas (balanceSheetQuerySchema + incomeStatementQuerySchema)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/balanceSheetQuerySchema/m);
      expect(content).toMatch(/incomeStatementQuerySchema/m);
    });

    it("α75: server.ts re-exports formatBolivianAmount RUNTIME (consumed by ai-agent prompts + sibling features)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/formatBolivianAmount/m);
    });

    it("α76: server.ts re-exports roundHalfUp, sumDecimals, eq RUNTIME (consumed by 5 sibling features)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/roundHalfUp/m);
      expect(content).toMatch(/sumDecimals/m);
      expect(content).toMatch(/eq\b/m);
    });

    it("α77: server.ts does NOT import index.ts (no circular barrel dependency)", () => {
      const content = readPresentationFile("server.ts");
      // server.ts must not re-import from index.ts (would create circular ref)
      expect(content).not.toMatch(/from\s+["']\.\/index["']/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — index.ts (client-safe barrel: pure table-row builders + TYPE re-exports)
  // D5 INVERSE: no "use client" directive, no runtime server-only imports.
  // serializeStatement is NOT here — it is server-only (instanceof Prisma.Decimal).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — index.ts (client-safe barrel per D5 INVERSE)", () => {
    it("α78: presentation/index.ts exists", () => {
      const filePath = presentationFile("index.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/financial-statements/presentation/index.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α79: index.ts does NOT re-export serializeStatement (server-only — needs Prisma.Decimal runtime)", () => {
      // CORRECTED at client/server boundary-leak fix: serializeStatement does
      // `instanceof Prisma.Decimal` at runtime, so it transitively imports
      // `@/generated/prisma/client` (→ `node:module`). Re-exporting it from this
      // client-safe barrel poisoned every Client Component that did `import type`
      // from here (a barrel is ONE module — runtime exports drag in regardless).
      // It now lives ONLY in presentation/server.ts. See client-safe-barrel-shape
      // sentinel for the full transitive-reachability guard.
      const content = readPresentationFile("index.ts");
      expect(content).not.toMatch(/export\s*\{[^}]*serializeStatement/m);
    });

    it("α80: index.ts re-exports core domain types (BalanceSheet, IncomeStatement, StatementColumn)", () => {
      const content = readPresentationFile("index.ts");
      expect(content).toMatch(/BalanceSheet/m);
      expect(content).toMatch(/IncomeStatement/m);
      expect(content).toMatch(/StatementColumn/m);
    });

    it("α81: index.ts re-exports DatePresetId, BreakdownBy, CompareWith types", () => {
      const content = readPresentationFile("index.ts");
      expect(content).toMatch(/DatePresetId/m);
      expect(content).toMatch(/BreakdownBy/m);
      expect(content).toMatch(/CompareWith/m);
    });

    it("α82: index.ts re-exports StatementTableRow, SerializedColumn types (used by 5 client components)", () => {
      const content = readPresentationFile("index.ts");
      expect(content).toMatch(/StatementTableRow/m);
      expect(content).toMatch(/SerializedColumn/m);
    });

    it("α83: index.ts does NOT import server-only (client-safe — no server boundary)", () => {
      const content = readPresentationFile("index.ts");
      expect(content).not.toMatch(/import\s+["']server-only["']/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — REQ-002 NEGATIVE (D5 INVERSE assertions)
  // NO client.ts (dispatch-hex pattern, NOT ai-agent dual-barrel).
  // NO "use client" directive anywhere in the module (zero React hooks).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — REQ-002 NEGATIVE: D5 INVERSE (no client.ts, no use client)", () => {
    it("α84: NO presentation/client.ts file exists (D5 INVERSE — zero React hooks in consumers)", () => {
      const clientTs = presentationFile("client.ts");
      // This file must NOT exist — financial-statements has no client-side hook.
      // If it exists, D5 INVERSE is violated and Marco-lock required.
      expect(fs.existsSync(clientTs)).toBe(false);
    });

    it('α85: NO "use client" directive exists anywhere in modules/accounting/financial-statements/**', () => {
      const blob = walkSources(MODULE_ROOT);
      // "use client" directive marks a client bundle entry point — should be zero
      // in this server-only module. Any hit is a D5 INVERSE violation.
      expect(blob).not.toMatch(/["']use client["']/m);
    });
  });
});
