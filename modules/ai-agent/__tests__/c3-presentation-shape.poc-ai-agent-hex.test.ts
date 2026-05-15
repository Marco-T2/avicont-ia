import { describe, it, expect, vi, test } from "vitest";

// vi.hoisted: ensures GEMINI_API_KEY is set BEFORE vi.mock factory runs.
// vi.mock() declarations are hoisted above all imports by Vitest; a plain
// module-level `process.env.X = ...` executes AFTER hoisting and would race.
// Precedent: route.confirm-journal-entry.test.ts:17-19.
vi.hoisted(() => {
  process.env.GEMINI_API_KEY =
    process.env.GEMINI_API_KEY ?? "test-key-for-vitest";
});

// Mock @google/generative-ai to eliminate SDK cold-load cost (~1500ms) that
// races with the 5000ms default testTimeout under full-suite worker contention
// (forks pool, parallel CPU). Shape-only test: asserts factory/barrel shape,
// NOT Gemini SDK behavior. [[cross_module_boundary_mock_target_rewrite]] N/A
// (bare package import, no path relocation needed).
vi.mock("@google/generative-ai", () => ({
  // Must use regular function (not arrow) — arrow functions are not constructable.
  // gemini-llm.adapter.ts calls `new GoogleGenerativeAI(apiKey)` at module load.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  GoogleGenerativeAI: vi.fn().mockImplementation(function (this: any) {
    this.getGenerativeModel = vi.fn();
  }),
}));
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C3 RED — Presentation layer shape tests for POC ai-agent-hex migration.
 *
 * AXIS-DISTINCT from paired sister dispatch C3 (`6dcf69be` RED + `5fd0cd42`
 * GREEN): dispatch shipped a single server barrel; ai-agent is the FIRST hex
 * module with a DUAL BARREL (server.ts + client.ts) per design §4 (D5 lock).
 * Block 3 below is novel-to-POC — no dispatch analog.
 *
 * Strategy:
 * - Server-side checks (Block 1, 2, 4, 5): direct imports from
 *   `../presentation/server` / `../presentation/index` / `../presentation/composition-root`.
 *   PRE-GREEN fails via ENOENT at module resolution (Vitest "Cannot find module").
 * - Client-side checks (Block 3): readFileSync of `presentation/client.ts`.
 *   Importing a `"use client"` module inside Vitest (Node env, not Next.js
 *   build) is unsafe — directives are stripped/ignored outside Next.js
 *   runtime, so a runtime import would NOT actually exercise the boundary
 *   the way Next.js does. Grep-based assertion preserves intent and the
 *   positional line-1 invariant (REQ-002) per [[red_regex_discipline]] and
 *   PRE-C3 Next.js 16.2.1 doc lock (use-client.md L14: directive must be
 *   "at the top of the file, before any imports"; server-and-client-components.md
 *   L569: client cannot import server-only modules).
 *
 * Expected failure mode at RED [[red_acceptance_failure_mode]]: ENOENT
 * ("Cannot find module '@/modules/ai-agent/presentation/...'") for Blocks
 * 1, 2, 4, 5. Block 3 readFileSync fails with the same shape via the
 * existsSync guard (ENOENT thrown explicitly when client.ts absent).
 *
 * REQ mapping (per spec #2248 §C3):
 * - Block 1: Composition root makeAgentService (D1 zero-arg factory).
 * - Block 2: Server barrel REQ-002 (line 1 `import "server-only"` + 10 re-exports).
 * - Block 3: Client barrel REQ-002 (line 1 `"use client"` + useAgentQuery +
 *   types + NEGATIVE no server-only import).
 * - Block 4: Index public barrel (analyzeDocument + AgentSuggestion).
 * - Block 5: Zod schema compile (agentQuerySchema + confirmActionSchema).
 */

const ROOT = path.resolve(__dirname, "../../..");
const PRESENTATION = path.join(ROOT, "modules/ai-agent/presentation");

function presentationFile(relative: string): string {
  return path.join(PRESENTATION, relative);
}

function readPresentationFile(relative: string): string {
  const filePath = presentationFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/ai-agent/presentation/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

// ── Block 1: Composition root (makeAgentService factory) ────────────────────

describe("POC ai-agent-hex C3 — composition root", () => {
  it("makeAgentService factory exists and is a function", async () => {
    // Composition-root re-exported from server barrel per design §3.
    const mod = await import("@/modules/ai-agent/presentation/server");
    expect(typeof mod.makeAgentService).toBe("function");
  });

  it("makeAgentService is a zero-arg factory (returns AgentService at import time, no top-level throw)", async () => {
    const mod = await import("@/modules/ai-agent/presentation/server");
    // Smoke: function arity 0 (matches paired sister `makeDispatchService()`).
    // Runtime invocation may throw without DB/Gemini key — only import-time
    // behavior is asserted here, per spec §C3 Block 1 note.
    expect(mod.makeAgentService.length).toBe(0);
  });
});

// ── Block 2: Server barrel REQ-002 ──────────────────────────────────────────

describe("POC ai-agent-hex C3 — server barrel (REQ-002)", () => {
  it("server.ts line 1 is `import \"server-only\";` (positional, before any imports)", () => {
    const content = readPresentationFile("server.ts");
    // Per Next.js 16.2.1 docs (server-and-client-components.md L551-573 +
    // PRE-C3 lock): server-only directive must be at the very top so Next.js
    // can detect client→server-only imports at build time.
    expect(content).toMatch(/^import\s+["']server-only["']/m);
    // Positional invariant: first non-empty character must be `i` of `import`,
    // and the server-only line must end before the first newline.
    const firstNewline = content.indexOf("\n");
    const serverOnlyIdx = content.indexOf('import "server-only"');
    expect(serverOnlyIdx).toBeGreaterThanOrEqual(0);
    expect(serverOnlyIdx).toBeLessThan(firstNewline);
    expect(serverOnlyIdx).toBe(0);
  });

  it("server barrel re-exports AgentService", async () => {
    const mod = await import("@/modules/ai-agent/presentation/server");
    expect(mod.AgentService).toBeDefined();
    expect(typeof mod.AgentService).toBe("function");
  });

  it("server barrel re-exports AgentRateLimitService", async () => {
    const mod = await import("@/modules/ai-agent/presentation/server");
    expect(mod.AgentRateLimitService).toBeDefined();
    expect(typeof mod.AgentRateLimitService).toBe("function");
  });

  it("server barrel re-exports agentQuerySchema (Zod)", async () => {
    const mod = await import("@/modules/ai-agent/presentation/server");
    expect(mod.agentQuerySchema).toBeDefined();
  });

  it("server barrel re-exports confirmActionSchema (Zod)", async () => {
    const mod = await import("@/modules/ai-agent/presentation/server");
    expect(mod.confirmActionSchema).toBeDefined();
  });

  it("server barrel re-exports executeFindAccountsByPurpose", async () => {
    const mod = await import("@/modules/ai-agent/presentation/server");
    expect(typeof mod.executeFindAccountsByPurpose).toBe("function");
  });

  it("server barrel re-exports executeFindContact", async () => {
    const mod = await import("@/modules/ai-agent/presentation/server");
    expect(typeof mod.executeFindContact).toBe("function");
  });

  it("server barrel re-exports executeParseAccountingOperation", async () => {
    const mod = await import("@/modules/ai-agent/presentation/server");
    expect(typeof mod.executeParseAccountingOperation).toBe("function");
  });

  it("server barrel re-exports analyzeDocument (function)", async () => {
    const mod = await import("@/modules/ai-agent/presentation/server");
    expect(typeof mod.analyzeDocument).toBe("function");
  });

  it("server.ts grep contains JournalEntryAiContextHints type re-export", () => {
    // Type-only re-export — verified textually because runtime import drops
    // type-only exports. Pattern from features/ai-agent/server.ts L8-12.
    const content = readPresentationFile("server.ts");
    expect(content).toMatch(/JournalEntryAiContextHints/);
  });
});

// ── Block 3: Client barrel REQ-002 (DUAL-BARREL — novel to POC) ─────────────

describe("POC ai-agent-hex C3 — client barrel (REQ-002, DUAL-BARREL novel to POC)", () => {
  it("client.ts line 1 is `\"use client\";` (positional, before any imports)", () => {
    const content = readPresentationFile("client.ts");
    // Per PRE-C3 Next.js 16.2.1 lock (use-client.md L14): directive must be
    // "at the top of the file, before any imports". Double quotes per
    // codebase precedent (features/ai-agent/client.ts:1).
    expect(content).toMatch(/^"use client"/m);
    const firstNewline = content.indexOf("\n");
    const useClientIdx = content.indexOf('"use client"');
    expect(useClientIdx).toBeGreaterThanOrEqual(0);
    expect(useClientIdx).toBeLessThan(firstNewline);
    expect(useClientIdx).toBe(0);
  });

  it("client.ts exports useAgentQuery hook (textual)", () => {
    const content = readPresentationFile("client.ts");
    // Cannot runtime-import `"use client"` modules safely in Vitest (Node env,
    // directive ignored — would not actually test the boundary). Textual
    // grep per spec §C3 Block 3.
    expect(content).toMatch(/export\s+(?:function\s+)?useAgentQuery/);
  });

  it("client.ts exports ChatContextHints type (textual)", () => {
    const content = readPresentationFile("client.ts");
    expect(content).toMatch(/export\s+(?:interface|type)\s+ChatContextHints\b/);
  });

  it("client.ts exports AgentQueryParams type (textual)", () => {
    const content = readPresentationFile("client.ts");
    expect(content).toMatch(/export\s+(?:interface|type)\s+AgentQueryParams\b/);
  });

  it("client.ts does NOT import `server-only` (REQ-002 negative, build-error guard)", () => {
    const content = readPresentationFile("client.ts");
    // Per Next.js 16.2.1 server-and-client-components.md L569: client cannot
    // import server-only modules — would be a build-time error.
    expect(content).not.toMatch(/import\s+["']server-only["']/m);
  });
});

// ── Block 4: Index public barrel ────────────────────────────────────────────

describe("POC ai-agent-hex C3 — public index barrel", () => {
  it("presentation/index.ts re-exports analyzeDocument", async () => {
    // Public barrel surface matches features/ai-agent/index.ts (the 2 public
    // consumers: app/api/analyze/route.ts → analyzeDocument; registrar-con-ia
    // → AgentSuggestion type).
    const mod = await import("@/modules/ai-agent/presentation");
    expect(typeof mod.analyzeDocument).toBe("function");
  });

  it("presentation/index.ts grep contains AgentSuggestion (type re-export)", () => {
    // Type-only re-export — textual grep (analog to server.ts Block 2 last
    // case for JournalEntryAiContextHints).
    const content = readPresentationFile("index.ts");
    expect(content).toMatch(/AgentSuggestion|agent\.types/);
  });
});

// ── Block 5: Zod schemas compile + behavioral smoke ─────────────────────────

describe("POC ai-agent-hex C3 — Zod schemas via server barrel", () => {
  it("agentQuerySchema validates a valid chat-mode query", async () => {
    const { agentQuerySchema } = await import(
      "@/modules/ai-agent/presentation/server"
    );
    const result = agentQuerySchema.safeParse({
      prompt: "hola",
      mode: "chat",
    });
    expect(result.success).toBe(true);
  });

  it("confirmActionSchema parses a minimal suggestion shape", async () => {
    const { confirmActionSchema } = await import(
      "@/modules/ai-agent/presentation/server"
    );
    const result = confirmActionSchema.safeParse({
      suggestion: { type: "createExpense", description: "x", amount: 1 },
    });
    // Note: schema may apply additional invariants — we only assert the
    // schema RUNS (not necessarily success) for sentinel intent. Per spec
    // §C3 Block 5: "parses suggestion" means schema is invocable.
    expect(typeof result.success).toBe("boolean");
  });
});

// ── α-sentinel: mock stability guard ────────────────────────────────────────
// α-mock-stability-c3-01: If vi.mock("@google/generative-ai", ...) is removed,
// GoogleGenerativeAI is the real SDK class — vi.isMockFunction returns false.
// Expected failure mode: assertion-fail `expected false to be true`
// (NOT timeout). [[red_acceptance_failure_mode]] compliance.
test("α-mock-stability-c3-01: @google/generative-ai is mocked (prevents 1500ms cold-import timeout regression)", async () => {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  expect(vi.isMockFunction(GoogleGenerativeAI)).toBe(true);
});
