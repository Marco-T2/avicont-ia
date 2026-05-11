/**
 * Hotfix retroactivo POC #2 — chat mode contextHints injection + brevity + tool selection
 * write-vs-read + frontend discriminator requiresConfirmation flag (combined shape regex Opt A
 * + behavioral backend integration).
 *
 * Paired sister precedent STRUCTURAL EXACT mirror:
 *   - c0/c1/c2-presentation-shape.poc-ai-tools-writing-granjas.test.ts (shape regex Opt A +
 *     REPO_ROOT pattern cross-dir resolve features/ai-agent/__tests__ → multi-file targets)
 *   - agent.service.journal-entry-ai.test.ts (AgentService.query integration test + vi.hoisted
 *     env + vi.mock llm + mockLLMQuery.calls[0] system prompt assertions)
 *
 * Verifica shape + behavioral integration hotfix retroactivo POC #2 archivos:
 *   - chat.ts ChatModeArgs interface adds contextHints?: unknown field
 *   - chat.ts buildSystemPrompt signature accepts + body renders contextHints inline
 *   - chat.ts REGLAS section adds 3 directives: tool selection write-vs-read explicit guide +
 *     brevity 1-2 oraciones + date default HOY no preguntar
 *   - agent.service.ts executeChatMode call propagates contextHints arg (NOT dropped)
 *   - modal index.tsx handleSend discriminates requiresConfirmation flag
 *   - modal index.tsx removes fallback render "Acción: {suggestion.action}" line
 *   - AgentService.query(mode='chat', contextHints={lotId,lotName,farmId,farmName}) → mockLLMQuery
 *     receives system prompt containing contextHints values (NOT dropped silently)
 *
 * RED-α hotfix: behavioral assertion mismatch combined mode — chat.ts + agent.service.ts +
 * index.tsx EXIST post-C2 cementado pero NO incluyen contextHints injection ni brevity
 * directives ni discriminator post-smoke runtime Marco-side findings hotfix retroactivo. Failure
 * path REAL behavioral assertion mismatch (NOT ENOENT — files exist), regex patterns ausentes +
 * mockLLMQuery system prompt NO contiene contextHints rendered pre-GREEN. Paired sister C5 pages
 * cutover shape + hotfix-correctivo-contacts + c0-hotfix-allocations-payment + lot-rsc-boundary
 * precedent EXACT mirror cumulative cross-POC matures (behavioral assertion mismatch sobre
 * archivos existing). evidence-supersedes-assumption-lock 43ma matures cumulative (Discovery #1
 * VACUOUS-CLOSED initial superseded por smoke runtime findings hotfix retroactivo necessary).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../..");

const CHAT_MODE = resolve(REPO_ROOT, "features/ai-agent/modes/chat.ts");
const AGENT_SERVICE = resolve(REPO_ROOT, "features/ai-agent/agent.service.ts");
const MODAL_INDEX = resolve(
  REPO_ROOT,
  "components/agent/registrar-con-ia/index.tsx",
);

// ── Shape file regex Opt A ─────────────────────────────────────────────────

describe("Hotfix retroactivo POC #2 shape — chat mode contextHints injection + brevity + tool selection + frontend discriminator (existence-only regex)", () => {
  // α36
  it("chat.ts ChatModeArgs interface adds contextHints?: unknown field", () => {
    const src = readFileSync(CHAT_MODE, "utf-8");
    expect(src).toMatch(
      /interface\s+ChatModeArgs[\s\S]*?\bcontextHints\?\s*:\s*unknown\b[\s\S]*?\}/,
    );
  });

  // α37
  it("chat.ts buildSystemPrompt signature accepts contextHints param + body renders inline", () => {
    const src = readFileSync(CHAT_MODE, "utf-8");
    expect(src).toMatch(/function\s+buildSystemPrompt[^)]*\bcontextHints\b/);
    expect(src).toMatch(/contextHints[\s\S]{0,500}?(?:lotName|lotId|farmName)/);
  });

  // α38
  it("chat.ts REGLAS section includes tool selection write-vs-read explicit guide (NO verify-first defensive)", () => {
    const src = readFileSync(CHAT_MODE, "utf-8");
    expect(src).toMatch(
      /(?:invoc[áa]|us[áa])\s+DIRECTAMENTE|directly\s+invoke|NO\s+(?:uses|llames|usar)\s+(?:getLotSummary|listLots|listFarms)/i,
    );
  });

  // α39
  it("chat.ts REGLAS section includes brevity directive (máximo 1-2 oraciones)", () => {
    const src = readFileSync(CHAT_MODE, "utf-8");
    expect(src).toMatch(
      /(?:M[ÁA]XIMO|m[áa]ximo)\s+1[\s-]?[a²2]?\s*oraciones?|1[\s-]?[a²2]?\s*oraciones?\s+(?:cortas|breves)/i,
    );
  });

  // α40
  it("chat.ts REGLAS section includes date default HOY (no preguntar fecha)", () => {
    const src = readFileSync(CHAT_MODE, "utf-8");
    expect(src).toMatch(
      /asumir\s+HOY|si\s+(?:el\s+usuario\s+)?no\s+(?:se\s+)?(?:especifica|indica)\s+(?:la\s+)?fecha/i,
    );
  });

  // α41
  it("agent.service.ts executeChatMode call propagates contextHints arg (NO drop in chat path)", () => {
    const src = readFileSync(AGENT_SERVICE, "utf-8");
    expect(src).toMatch(/executeChatMode\s*\([\s\S]*?\bcontextHints\b[\s\S]*?\)/);
  });

  // α42
  it("modal index.tsx handleSend discriminates requiresConfirmation flag (NO render read tool as confirm-card)", () => {
    const src = readFileSync(MODAL_INDEX, "utf-8");
    expect(src).toMatch(/\brequiresConfirmation\b/);
  });

  // α43
  it("modal index.tsx removes fallback render '<div>Acción: {suggestion.action}</div>' line", () => {
    const src = readFileSync(MODAL_INDEX, "utf-8");
    expect(src).not.toMatch(/<div>Acción:\s*\{suggestion\.action\}<\/div>/);
  });
});

// ── Behavioral backend integration ──────────────────────────────────────────

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-for-vitest";
});

const { mockLLMQuery, mockBuildAgentContext, mockBuildRagContext } = vi.hoisted(
  () => ({
    mockLLMQuery: vi.fn(),
    mockBuildAgentContext: vi.fn(),
    mockBuildRagContext: vi.fn(),
  }),
);

vi.mock("../llm", async () => {
  const actual = await vi.importActual<typeof import("../llm")>("../llm");
  return { ...actual, llmClient: { query: mockLLMQuery } };
});

vi.mock("../agent.context", () => ({
  buildAgentContext: mockBuildAgentContext,
  buildRagContext: mockBuildRagContext,
}));

vi.mock("@/lib/logging/structured", () => ({
  logStructured: vi.fn(),
}));

vi.mock("../memory.repository", () => ({
  ChatMemoryRepository: class {
    getRecentMessages = vi.fn().mockResolvedValue([]);
    saveMessage = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("@/modules/farm/presentation/server", () => ({
  makeFarmService: vi.fn(() => ({})),
  LocalFarmInquiryAdapter: class {},
}));

vi.mock("@/modules/lot/presentation/server", () => ({
  makeLotService: vi.fn(() => ({})),
  LocalLotInquiryAdapter: class {},
}));

vi.mock("@/features/pricing/server", () => ({
  PricingService: class {
    calculateLotCost = vi.fn();
  },
}));

import { AgentService } from "../agent.service";

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildAgentContext.mockResolvedValue(
    "## Datos del Socio\n\nGranjas: 0\nLotes: 0",
  );
  mockBuildRagContext.mockResolvedValue("");
});

describe("Hotfix retroactivo POC #2 behavioral integration — chat mode contextHints injection runtime", () => {
  // α44
  it("AgentService.query(mode='chat', contextHints={lotId,lotName,farmId,farmName}) propagates contextHints → mockLLMQuery system prompt contains lotName + lotId values", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "ok",
      toolCalls: [],
      usage: undefined,
    });
    const service = new AgentService();

    await service.query(
      "org-1",
      "user-1",
      "member",
      "200 bs alimento",
      undefined,
      "chat",
      {
        lotId: "lot-cuid-xyz",
        lotName: "Lote 1 - Galpón 5",
        farmId: "farm-cuid-abc",
        farmName: "Granja Capinota",
      },
    );

    expect(mockLLMQuery).toHaveBeenCalledTimes(1);
    const args = mockLLMQuery.mock.calls[0][0] as { systemPrompt: string };
    expect(args.systemPrompt).toContain("Lote 1 - Galpón 5");
    expect(args.systemPrompt).toContain("lot-cuid-xyz");
  });

  // α47
  it("AgentService.query(mode='chat') → mockLLMQuery system prompt contains today's date Spanish format (año + mes Spanish + día)", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "ok",
      toolCalls: [],
      usage: undefined,
    });
    const service = new AgentService();

    await service.query(
      "org-1",
      "user-1",
      "member",
      "200 bs alimento",
      undefined,
      "chat",
      { lotId: "lot-1" },
    );

    expect(mockLLMQuery).toHaveBeenCalledTimes(1);
    const args = mockLLMQuery.mock.calls[0][0] as { systemPrompt: string };
    // Today's date Spanish format — Intl.DateTimeFormat es-BO renders meses Spanish nativo
    // (enero/febrero/marzo/abril/mayo/junio/julio/agosto/septiembre/octubre/noviembre/diciembre)
    // + año YYYY + día numeric DD. Regex captures presence dynamic date context render.
    expect(args.systemPrompt).toMatch(
      /(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)[\s\S]{0,100}?20[2-9]\d|20[2-9]\d[\s\S]{0,100}?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i,
    );
    expect(args.systemPrompt).toMatch(
      /(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/i,
    );
  });
});

// ── Shape file regex Opt A extend — temporal context + fechas relativas + ambiguous clarification ──

describe("Hotfix retroactivo POC #2 shape extend — temporal context + fechas relativas resolución + ambiguous date clarification (existence-only regex)", () => {
  // α45
  it("chat.ts buildSystemPrompt renders current date context dynamic (Intl.DateTimeFormat es-BO + Hoy es [día semana])", () => {
    const src = readFileSync(CHAT_MODE, "utf-8");
    expect(src).toMatch(
      /Intl\.DateTimeFormat\s*\(\s*["']es-BO["']|new\s+Intl\.DateTimeFormat\s*\(\s*["']es/,
    );
    expect(src).toMatch(/Hoy\s+es\s+\$\{|Hoy\s+es\s+\$\{[\s\S]{0,200}\}/);
  });

  // α46
  it("chat.ts REGLAS section includes fechas relativas resolución directive enumerated (hoy + ayer + antier examples)", () => {
    const src = readFileSync(CHAT_MODE, "utf-8");
    expect(src).toMatch(/fechas?\s+relativas?/i);
    expect(src).toMatch(/\bayer\b[\s\S]{0,500}?\b(?:antier|anteayer)\b|\b(?:antier|anteayer)\b[\s\S]{0,500}?\bayer\b/i);
  });

  // α48
  it("chat.ts REGLAS section includes ambiguous date phrases clarification directive (la semana pasada / hace tiempo → pedir clarification)", () => {
    const src = readFileSync(CHAT_MODE, "utf-8");
    expect(src).toMatch(
      /(?:semana\s+pasada|hace\s+tiempo|ambig[uü]o|ambig[uü]a)[\s\S]{0,300}?(?:clarif|aclarar|pregunt[áa]r?)|(?:clarif|aclarar|pregunt[áa]r?)[\s\S]{0,300}?(?:semana\s+pasada|hace\s+tiempo|ambig[uü]o|ambig[uü]a)/i,
    );
  });
});
