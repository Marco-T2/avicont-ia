import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C2 RED — Infrastructure layer shape tests for POC ai-agent-hex migration.
 * Paired sister: modules/dispatch/__tests__/c2-infrastructure-shape.poc-dispatch-hex.test.ts
 *
 * Strategy: existsSync guards inside each it() block — infrastructure files do
 * NOT exist pre-GREEN (ENOENT at top-level import would crash the file).
 * See [[red_acceptance_failure_mode]] — expected failure mode: ENOENT /
 * "Cannot find module '@/modules/ai-agent/infrastructure/...'" (file absent).
 *
 * REQ mapping:
 * - Block 1: LLM adapter (REQ-005 — GeminiLLMAdapter implements LLMProviderPort)
 * - Block 2: Prisma repository adapters (REQ-004)
 * - Block 3: Legacy adapters (REQ-004 — narrow port surface)
 * - Block 4: REQ-004 NEGATIVE (cross-module boundary insulation)
 * - Block 5: analyzeDocument co-located in adapter (Gemini-bound, REQ-005 exception)
 */

const ROOT = path.resolve(__dirname, "../../..");
const INFRASTRUCTURE = path.join(ROOT, "modules/ai-agent/infrastructure");
const APPLICATION = path.join(ROOT, "modules/ai-agent/application");

function infraFile(relative: string): string {
  return path.join(INFRASTRUCTURE, relative);
}

/**
 * Require an infrastructure module and assert the given named export exists.
 * Throws if the file does not exist (ENOENT) — expected RED failure mode.
 */
function requireInfraExport(relative: string, exportName: string): unknown {
  const filePath = infraFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(`ENOENT: cannot find module '@/modules/ai-agent/infrastructure/${relative}'`);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(path.resolve(filePath));
  return mod[exportName];
}

function readInfraFile(relative: string): string {
  const filePath = infraFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(`ENOENT: cannot read '@/modules/ai-agent/infrastructure/${relative}'`);
  }
  return fs.readFileSync(filePath, "utf8");
}

/**
 * Walk a directory recursively and return source file contents joined.
 * Used for REQ-004 NEGATIVE cross-module-boundary grep.
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

// ─────────────────────────────────────────────────────────────────────────────
// Block 1 — LLM adapter (REQ-005)
// ─────────────────────────────────────────────────────────────────────────────

describe("POC ai-agent-hex C2 — infrastructure layer shape", () => {
  describe("Block 1 — LLM adapter (REQ-005: GeminiLLMAdapter implements LLMProviderPort)", () => {
    it("α61: GeminiLLMAdapter class is exported from infrastructure/llm/gemini-llm.adapter", () => {
      const GeminiLLMAdapter = requireInfraExport(
        "llm/gemini-llm.adapter.ts",
        "GeminiLLMAdapter",
      );
      expect(GeminiLLMAdapter).toBeDefined();
      expect(typeof GeminiLLMAdapter).toBe("function");
    });

    it("α62: GeminiLLMAdapter content references LLMProviderPort implements clause", () => {
      const content = readInfraFile("llm/gemini-llm.adapter.ts");
      // Structural check — adapter must declare it implements the port.
      expect(content).toMatch(/implements\s+LLMProviderPort/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — Prisma repository adapters (REQ-004)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 2 — Prisma repository adapters (REQ-004)", () => {
    it("α63: PrismaChatMemoryRepository class is exported from infrastructure/prisma/prisma-chat-memory.repo", () => {
      const Cls = requireInfraExport(
        "prisma/prisma-chat-memory.repo.ts",
        "PrismaChatMemoryRepository",
      );
      expect(Cls).toBeDefined();
      expect(typeof Cls).toBe("function");
    });

    it("α64: PrismaAgentContextRepository class is exported from infrastructure/prisma/prisma-agent-context.repo", () => {
      const Cls = requireInfraExport(
        "prisma/prisma-agent-context.repo.ts",
        "PrismaAgentContextRepository",
      );
      expect(Cls).toBeDefined();
      expect(typeof Cls).toBe("function");
    });

    it("α65: PrismaRateLimitRepository class is exported from infrastructure/prisma/prisma-agent-rate-limit.repo", () => {
      const Cls = requireInfraExport(
        "prisma/prisma-agent-rate-limit.repo.ts",
        "PrismaRateLimitRepository",
      );
      expect(Cls).toBeDefined();
      expect(typeof Cls).toBe("function");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — Legacy adapters (REQ-004 — narrow port surface)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — Legacy adapters (REQ-004: insulation via narrow port surface)", () => {
    it("α66: LegacyAccountsAdapter class is exported from infrastructure/legacy-accounts.adapter", () => {
      const Cls = requireInfraExport(
        "legacy-accounts.adapter.ts",
        "LegacyAccountsAdapter",
      );
      expect(Cls).toBeDefined();
      expect(typeof Cls).toBe("function");
    });

    it("α67: LegacyRagAdapter class is exported from infrastructure/legacy-rag.adapter", () => {
      const Cls = requireInfraExport(
        "legacy-rag.adapter.ts",
        "LegacyRagAdapter",
      );
      expect(Cls).toBeDefined();
      expect(typeof Cls).toBe("function");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — REQ-004 NEGATIVE (cross-module boundary)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — REQ-004 NEGATIVE (cross-module-boundary insulation)", () => {
    it("α68: legacy-accounts.adapter wraps PrismaAccountsRepo at ONE location (single import)", () => {
      const content = readInfraFile("legacy-accounts.adapter.ts");
      // Match the canonical import of PrismaAccountsRepo from accounting infra.
      const importRe = /from\s+["']@\/modules\/accounting\/infrastructure\/prisma-accounts\.repo["']/gm;
      const hits = content.match(importRe) ?? [];
      expect(hits.length).toBe(1);
    });

    it("α69: NO file in modules/ai-agent/application/** imports @/modules/accounting/infrastructure/**", () => {
      const blob = walkSources(APPLICATION);
      expect(blob).not.toMatch(/from\s+["']@\/modules\/accounting\/infrastructure/m);
    });

    it("α70: NO file in modules/ai-agent/application/** imports @/features/documents/rag/", () => {
      const blob = walkSources(APPLICATION);
      expect(blob).not.toMatch(/from\s+["']@\/features\/documents\/rag/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 5 — analyzeDocument co-located in adapter (Gemini-bound)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 5 — analyzeDocument co-located in gemini-llm.adapter", () => {
    it("α71: analyzeDocument function is exported from infrastructure/llm/gemini-llm.adapter", () => {
      const analyzeDocument = requireInfraExport(
        "llm/gemini-llm.adapter.ts",
        "analyzeDocument",
      );
      expect(typeof analyzeDocument).toBe("function");
    });
  });
});
