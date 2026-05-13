import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C2 RED — Infrastructure layer shape tests for POC ai-agent-hex migration.
 * Paired sister: modules/dispatch/__tests__/c2-infrastructure-shape.poc-dispatch-hex.test.ts
 *
 * Strategy: existsSync guard + readFileSync grep for class/function exports.
 * Infrastructure adapters have top-level @/* value imports (PrismaAccountsRepo,
 * RagService, BaseRepository, logStructured) which Node strip-types via
 * require() in test bodies cannot resolve. Grep-based assertion preserves
 * sentinel intent without forcing runtime module load (Vitest 4 DEFAULT_EXTENSIONS
 * gotcha — see C1 ledger #2254).
 *
 * Expected failure mode: ENOENT — "Cannot find module
 * '@/modules/ai-agent/infrastructure/...'" (file absent pre-GREEN).
 *
 * REQ mapping:
 * - Block 1: LLM adapter (REQ-005 — GeminiLLMAdapter implements LLMProviderPort)
 * - Block 2: Prisma repository adapters (REQ-004)
 * - Block 3: Legacy adapters (REQ-004 — narrow port surface)
 * - Block 4: REQ-004 NEGATIVE (cross-module boundary insulation)
 * - Block 5: analyzeDocument co-located in adapter (REQ-005 exception, D8 arch debt)
 */

const ROOT = path.resolve(__dirname, "../../..");
const INFRASTRUCTURE = path.join(ROOT, "modules/ai-agent/infrastructure");
const APPLICATION = path.join(ROOT, "modules/ai-agent/application");

function infraFile(relative: string): string {
  return path.join(INFRASTRUCTURE, relative);
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
      const content = readInfraFile("llm/gemini-llm.adapter.ts");
      expect(content).toMatch(/export\s+class\s+GeminiLLMAdapter\b/m);
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
      const content = readInfraFile("prisma/prisma-chat-memory.repo.ts");
      expect(content).toMatch(/export\s+class\s+PrismaChatMemoryRepository\b/m);
    });

    it("α64: PrismaAgentContextRepository class is exported from infrastructure/prisma/prisma-agent-context.repo", () => {
      const content = readInfraFile("prisma/prisma-agent-context.repo.ts");
      expect(content).toMatch(/export\s+class\s+PrismaAgentContextRepository\b/m);
    });

    it("α65: PrismaRateLimitRepository class is exported from infrastructure/prisma/prisma-agent-rate-limit.repo", () => {
      const content = readInfraFile("prisma/prisma-agent-rate-limit.repo.ts");
      expect(content).toMatch(/export\s+class\s+PrismaRateLimitRepository\b/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — Legacy adapters (REQ-004 — narrow port surface)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — Legacy adapters (REQ-004: insulation via narrow port surface)", () => {
    it("α66: LegacyAccountsAdapter class is exported from infrastructure/legacy-accounts.adapter", () => {
      const content = readInfraFile("legacy-accounts.adapter.ts");
      expect(content).toMatch(/export\s+class\s+LegacyAccountsAdapter\b/m);
    });

    it("α67: LegacyRagAdapter class is exported from infrastructure/legacy-rag.adapter", () => {
      const content = readInfraFile("legacy-rag.adapter.ts");
      expect(content).toMatch(/export\s+class\s+LegacyRagAdapter\b/m);
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
      const content = readInfraFile("llm/gemini-llm.adapter.ts");
      expect(content).toMatch(/export\s+(?:async\s+)?function\s+analyzeDocument\b/m);
    });
  });
});
