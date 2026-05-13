import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C3 RED — Presentation layer shape tests for POC accounting-trial-balance-hex.
 * Paired sister: modules/accounting/financial-statements/__tests__/c3-presentation-shape.poc-financial-statements-hex.test.ts
 *                (GREEN `b8b9dcf5` — dispatch-hex pattern: server.ts + index.ts, NO client.ts)
 *
 * D5 INVERSE locked (EXACT mirror of sister):
 * - NO client.ts — trial-balance has ZERO React hooks; consumers (trial-balance-page-client.tsx)
 *   use useSWR + direct API fetch but import TYPES only from barrel
 * - NO "use client" directive anywhere in the module
 * - dispatch-hex pattern: server.ts (`import "server-only"`) + index.ts (client-safe TYPE barrel)
 *
 * PRE-C3 Next.js doc-read lock (use-client.md + server-and-client-components.md):
 * - `import "server-only"` = NPM runtime import → build-time error if client-bundled
 * - DISTINCT from `"use server"` directive (Server Functions/actions)
 * - `"use client"` only needed for: state, event handlers, lifecycle, browser APIs
 * - index.ts TYPE-only = client-safe (no directive needed)
 * - Trial-balance: ZERO React hooks confirmed → D5 INVERSE correct (no client.ts)
 *
 * Expected failure mode: ENOENT — presentation/ files absent pre-GREEN per
 * [[red_acceptance_failure_mode]]. C0+C1+C2 48α stable; this RED adds α49..α66 (18 new).
 * CONDITIONAL-PASS pre-GREEN: α64 (client.ts absent → existsSync false → PASS),
 * α65 (walkSources returns empty or no "use client" → PASS).
 *
 * REQ mapping:
 * - Block 1 (α49-α50): composition-root.ts — makeTrialBalanceService factory + TrialBalanceService ref
 * - Block 2 (α51-α58): server.ts — `import "server-only"` line 1 POSITIONAL (REQ-002) +
 *   key re-exports (service, factory, schema, exporters, no circular)
 * - Block 3 (α59-α63): index.ts — client-safe TYPE barrel (domain types + no server-only)
 * - Block 4 (α64-α66): REQ-002 NEGATIVE — NO client.ts (D5 INVERSE) + NO "use client" +
 *   NO legacy TrialBalanceRepository class name in server barrel
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel does NOT reference any app/api/** or components/** consumer paths (C4 targets).
 */

const ROOT = path.resolve(__dirname, "../../../..");
const PRESENTATION = path.join(
  ROOT,
  "modules/accounting/trial-balance/presentation",
);
const MODULE_ROOT = path.join(ROOT, "modules/accounting/trial-balance");

function presentationFile(relative: string): string {
  return path.join(PRESENTATION, relative);
}

function readPresentationFile(relative: string): string {
  const filePath = presentationFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/trial-balance/presentation/${relative}'`,
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

describe("POC accounting-trial-balance-hex C3 — presentation layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — composition-root.ts (makeTrialBalanceService zero-arg factory)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — composition-root.ts (makeTrialBalanceService zero-arg)", () => {
    it("α49: makeTrialBalanceService is exported as a function from presentation/composition-root.ts", () => {
      const content = readPresentationFile("composition-root.ts");
      expect(content).toMatch(
        /export\s+(?:function\s+makeTrialBalanceService|const\s+makeTrialBalanceService\s*=)/m,
      );
    });

    it("α50: makeTrialBalanceService returns TrialBalanceService (class must be referenced)", () => {
      const content = readPresentationFile("composition-root.ts");
      expect(content).toMatch(/TrialBalanceService/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — server.ts (REQ-002 + composition-root + key re-exports)
  // `import "server-only"` must be LINE 1 (positional check per PRE-C3 lock).
  // ───────────────────────────────────────────────────────────────────────────

  describe('Block 2 — server.ts (REQ-002: `import "server-only"` line 1 + re-exports)', () => {
    it("α51: presentation/server.ts exists", () => {
      const filePath = presentationFile("server.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/trial-balance/presentation/server.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('α52: server.ts line 1 is `import "server-only"` (positional — REQ-002)', () => {
      const content = readPresentationFile("server.ts");
      const firstLine = content.split("\n")[0]!.trim();
      // Must be exactly: import "server-only"; (with or without semicolon)
      expect(firstLine).toMatch(/^import\s+["']server-only["'];?$/);
    });

    it("α53: server.ts re-exports TrialBalanceService", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/TrialBalanceService/m);
    });

    it("α54: server.ts re-exports makeTrialBalanceService from composition-root", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/makeTrialBalanceService/m);
    });

    it("α55: server.ts re-exports trialBalanceQuerySchema (Zod schema)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/trialBalanceQuerySchema/m);
    });

    it("α56: server.ts re-exports exportTrialBalancePdf (PDF exporter)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/exportTrialBalancePdf/m);
    });

    it("α57: server.ts re-exports exportTrialBalanceXlsx (XLSX exporter)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/exportTrialBalanceXlsx/m);
    });

    it("α58: server.ts does NOT import index.ts (no circular barrel dependency)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).not.toMatch(/from\s+["']\.\/index["']/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — index.ts (client-safe barrel: TYPE re-exports)
  // D5 INVERSE: no "use client" directive, no runtime server-only imports.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — index.ts (client-safe barrel per D5 INVERSE)", () => {
    it("α59: presentation/index.ts exists", () => {
      const filePath = presentationFile("index.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/trial-balance/presentation/index.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α60: index.ts re-exports core domain types (TrialBalanceRow, TrialBalanceTotals, TrialBalanceReport)", () => {
      const content = readPresentationFile("index.ts");
      expect(content).toMatch(/TrialBalanceRow/m);
      expect(content).toMatch(/TrialBalanceTotals/m);
      expect(content).toMatch(/TrialBalanceReport/m);
    });

    it("α61: index.ts re-exports serialized types (SerializedTrialBalanceReport, SerializedTrialBalanceRow)", () => {
      const content = readPresentationFile("index.ts");
      expect(content).toMatch(/SerializedTrialBalanceReport/m);
      expect(content).toMatch(/SerializedTrialBalanceRow/m);
    });

    it("α62: index.ts re-exports TrialBalanceFilters type", () => {
      const content = readPresentationFile("index.ts");
      expect(content).toMatch(/TrialBalanceFilters/m);
    });

    it("α63: index.ts does NOT import server-only (client-safe — no server boundary)", () => {
      const content = readPresentationFile("index.ts");
      expect(content).not.toMatch(/import\s+["']server-only["']/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — REQ-002 NEGATIVE (D5 INVERSE assertions)
  // NO client.ts (dispatch-hex pattern — trial-balance has ZERO React hooks).
  // NO "use client" directive anywhere in the module.
  // NO legacy TrialBalanceRepository class name in server barrel.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — REQ-002 NEGATIVE: D5 INVERSE (no client.ts, no use client, no legacy class)", () => {
    it("α64: NO presentation/client.ts file exists (D5 INVERSE — zero React hooks in consumers)", () => {
      const clientTs = presentationFile("client.ts");
      // This file must NOT exist — trial-balance has no client-side hook.
      // consumers (trial-balance-page-client.tsx) use useSWR + direct API fetch,
      // importing TYPES only from barrel — no client.ts needed.
      expect(fs.existsSync(clientTs)).toBe(false);
    });

    it('α65: NO "use client" directive exists anywhere in modules/accounting/trial-balance/**', () => {
      const blob = walkSources(MODULE_ROOT);
      // "use client" marks a client bundle entry point — should be zero in this module.
      // Note: this test checks for the string literal; JSDoc paraphrases must avoid
      // literal "use client" string per [[engram_textual_rule_verification]] gotcha.
      expect(blob).not.toMatch(/["']use client["']/m);
    });

    it("α66: server.ts does NOT export TrialBalanceRepository (legacy class name banned — encapsulated behind port)", () => {
      // TrialBalanceRepository was the old features/ class name (before PrismaTrialBalanceRepo rename).
      // server barrel must NOT re-export it — composition-root handles wiring,
      // route.ts post-C4 uses makeTrialBalanceService() factory instead of direct class.
      const content = readPresentationFile("server.ts");
      expect(content).not.toMatch(/TrialBalanceRepository\b/m);
    });
  });
});
