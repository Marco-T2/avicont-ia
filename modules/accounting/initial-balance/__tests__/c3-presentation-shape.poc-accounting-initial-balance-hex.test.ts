import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C3 RED — Presentation layer shape tests for POC accounting-initial-balance-hex.
 * Paired sister: modules/accounting/worksheet/__tests__/c3-presentation-shape.poc-accounting-worksheet-hex.test.ts
 *                (EXACT mirror — dispatch-hex pattern: server.ts + index.ts, NO client.ts)
 *
 * D5 INVERSE locked (axis-distinct POSITIVE — same as WS, cleanest D5 in OLEADA 6):
 * - features/accounting/initial-balance/server.ts ALREADY has `import "server-only"` on line 1.
 *   C3 MIGRATES (not adds) — zero new guard required.
 * - NO client.ts — initial-balance has ZERO React hooks; pure data module.
 * - NO "use client" directive anywhere in the module.
 * - dispatch-hex pattern: server.ts (`import "server-only"`) + index.ts (client-safe TYPE barrel)
 *
 * PRE-C3 Next.js doc-read lock (server-and-client-components.md — §AGENTS.md):
 * - `import "server-only"` = NPM runtime guard → build-time error if client-bundled.
 * - DISTINCT from `"use server"` directive (Server Functions/actions).
 * - `"use client"` only needed for: state, event handlers, lifecycle, browser APIs.
 * - index.ts TYPE-only = client-safe (no directive needed).
 * - Initial-balance: ZERO React hooks confirmed → D5 INVERSE correct (no client.ts).
 *
 * Expected failure mode: ENOENT — presentation/ files absent pre-GREEN per
 * [[red_acceptance_failure_mode]]. C0+C1+C2 48α stable; this RED adds α49..α66 (18 new).
 * CONDITIONAL-PASS pre-GREEN: α58 (server.ts absent → readPresentationFile throws → but
 *   the no-circular check runs ON THE CONTENT so it ENOENT-throws), α63 (index.ts absent),
 *   α64 (client.ts absent → existsSync false → PASS), α65 (walkSources returns empty string
 *   for absent MODULE_ROOT files → no "use client" → PASS).
 *
 * REQ mapping (4 blocks / 18α):
 * - Block 1 (α49-α50): composition-root.ts — makeInitialBalanceService factory + InitialBalanceService ref
 * - Block 2 (α51-α58): server.ts — `import "server-only"` line 1 POSITIONAL (REQ-002) +
 *   key re-exports (service, factory, schema, exporters, no circular)
 * - Block 3 (α59-α63): index.ts — client-safe TYPE barrel (domain types + no server-only)
 * - Block 4 (α64-α66): REQ-002 NEGATIVE — NO client.ts (D5 INVERSE) + NO "use client" +
 *   NO legacy InitialBalanceRepository class name in server barrel
 *
 * IB-D3 invariant: 1-adapter composition root (PrismaInitialBalanceRepo → InitialBalanceService).
 * WS/TB mirror (1 adapter, zero-arg factory) — NOT ES 2-adapter shape.
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel does NOT reference any app/api/** or features/** consumer paths (C4/C5 targets).
 * C0+C1+C2 sentinels verified — none reference presentation/ runtime paths (only comment mentions).
 */

const ROOT = path.resolve(__dirname, "../../../..");
const PRESENTATION = path.join(
  ROOT,
  "modules/accounting/initial-balance/presentation",
);
const MODULE_ROOT = path.join(ROOT, "modules/accounting/initial-balance");

function presentationFile(relative: string): string {
  return path.join(PRESENTATION, relative);
}

function readPresentationFile(relative: string): string {
  const filePath = presentationFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/initial-balance/presentation/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

/**
 * Walk a directory recursively and return source file contents joined.
 * Used for REQ-002 NEGATIVE "use client" scan across the entire module.
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

describe("POC accounting-initial-balance-hex C3 — presentation layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — composition-root.ts (makeInitialBalanceService zero-arg factory)
  // IB-D3: 1-adapter, zero-arg factory — EXACT WS/TB mirror (not ES 2-adapter).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — composition-root.ts (makeInitialBalanceService zero-arg, IB-D3)", () => {
    it("α49: makeInitialBalanceService is exported as a function from presentation/composition-root.ts", () => {
      const content = readPresentationFile("composition-root.ts");
      expect(content).toMatch(
        /export\s+(?:function\s+makeInitialBalanceService|const\s+makeInitialBalanceService\s*=)/m,
      );
    });

    it("α50: makeInitialBalanceService returns InitialBalanceService (class must be referenced)", () => {
      const content = readPresentationFile("composition-root.ts");
      expect(content).toMatch(/InitialBalanceService/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — server.ts (REQ-002 + composition-root + key re-exports)
  // `import "server-only"` must be LINE 1 (positional check per PRE-C3 lock).
  // D5 axis-distinct POSITIVE: features/ server.ts ALREADY had server-only line 1
  // → C3 MIGRATES, not adds. Cleanest D5 OLEADA 6 (same as WS).
  // ───────────────────────────────────────────────────────────────────────────

  describe('Block 2 — server.ts (REQ-002: `import "server-only"` line 1 + re-exports)', () => {
    it("α51: presentation/server.ts exists", () => {
      const filePath = presentationFile("server.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/initial-balance/presentation/server.ts'",
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

    it("α53: server.ts re-exports InitialBalanceService", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/InitialBalanceService/m);
    });

    it("α54: server.ts re-exports makeInitialBalanceService from composition-root", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/makeInitialBalanceService/m);
    });

    it("α55: server.ts re-exports initialBalanceQuerySchema (Zod schema)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/initialBalanceQuerySchema/m);
    });

    it("α56: server.ts re-exports exportInitialBalancePdf (PDF exporter)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/exportInitialBalancePdf/m);
    });

    it("α57: server.ts re-exports exportInitialBalanceXlsx (XLSX exporter)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).toMatch(/exportInitialBalanceXlsx/m);
    });

    it("α58: server.ts does NOT import index.ts (no circular barrel dependency)", () => {
      const content = readPresentationFile("server.ts");
      expect(content).not.toMatch(/from\s+["']\.\/index["']/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — index.ts (client-safe barrel: TYPE re-exports only)
  // D5 INVERSE: no "use client" directive, no runtime server-only imports.
  // IB types: InitialBalanceRow, InitialBalanceStatement, InitialBalanceGroup,
  //           InitialBalanceSection, InitialBalanceOrgHeader.
  // NO Serialized* types (IB does not have serialization helpers — axis-distinct from TB).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — index.ts (client-safe barrel per D5 INVERSE)", () => {
    it("α59: presentation/index.ts exists", () => {
      const filePath = presentationFile("index.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/initial-balance/presentation/index.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α60: index.ts re-exports core domain types (InitialBalanceRow, InitialBalanceStatement)", () => {
      const content = readPresentationFile("index.ts");
      expect(content).toMatch(/InitialBalanceRow/m);
      expect(content).toMatch(/InitialBalanceStatement/m);
    });

    it("α61: index.ts re-exports InitialBalanceGroup type", () => {
      const content = readPresentationFile("index.ts");
      expect(content).toMatch(/InitialBalanceGroup/m);
    });

    it("α62: index.ts re-exports InitialBalanceSection type", () => {
      const content = readPresentationFile("index.ts");
      expect(content).toMatch(/InitialBalanceSection/m);
    });

    it("α63: index.ts does NOT import server-only (client-safe — no server boundary)", () => {
      const content = readPresentationFile("index.ts");
      expect(content).not.toMatch(/import\s+["']server-only["']/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — REQ-002 NEGATIVE (D5 INVERSE assertions)
  // NO client.ts — initial-balance is a pure data module, ZERO React hooks anywhere.
  // NO "use client" directive anywhere in modules/accounting/initial-balance/.
  // NO legacy InitialBalanceRepository class name in server barrel (old features/ class;
  // new canonical class is PrismaInitialBalanceRepo — encapsulated behind composition-root).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — REQ-002 NEGATIVE: D5 INVERSE (no client.ts, no use client, no legacy class)", () => {
    it("α64: NO presentation/client.ts file exists (D5 INVERSE — zero React hooks in initial-balance)", () => {
      const clientTs = presentationFile("client.ts");
      // This file must NOT exist — initial-balance has no client-side hook.
      // Consumers import TYPES only from barrel — no client.ts needed.
      expect(fs.existsSync(clientTs)).toBe(false);
    });

    it('α65: NO "use client" directive exists anywhere in modules/accounting/initial-balance/**', () => {
      const blob = walkSources(MODULE_ROOT);
      // "use client" marks a client bundle entry point — should be zero in this module.
      // Note: this comment deliberately avoids the literal string to prevent false positive.
      // The regex below matches the actual directive string form.
      expect(blob).not.toMatch(/["']use client["']/m);
    });

    it("α66: server.ts does NOT export InitialBalanceRepository (legacy class name banned — encapsulated behind port)", () => {
      // InitialBalanceRepository was the old features/ class name (before PrismaInitialBalanceRepo rename).
      // server barrel must NOT re-export it — composition-root handles wiring,
      // route.ts post-C4 uses makeInitialBalanceService() factory instead of direct class.
      const content = readPresentationFile("server.ts");
      expect(content).not.toMatch(/InitialBalanceRepository\b/m);
    });
  });
});
