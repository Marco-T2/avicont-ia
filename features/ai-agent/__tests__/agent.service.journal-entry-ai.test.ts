/**
 * Tests del modo journal-entry-ai en AgentService.query.
 *
 * Cubre:
 * - Dispatch por mode → tools restringidas a journalEntryAiTools (1 tool).
 * - Catálogo precargado se inyecta en el system prompt vía contextHints.
 * - Tool call esperada (parseAccountingOperationToSuggestion) → suggestion + requiresConfirmation.
 * - Tool call inesperada → outcome unexpected_tool, mensaje genérico.
 * - Sin tool call → outcome no_tool_call, mensaje del LLM.
 * - ValidationError del builder → mensaje del error al usuario, sin suggestion.
 * - formState en hints → log journal_ai_correction.
 * - Telemetría agent_invocation con mode "journal-entry-ai".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-for-vitest";
});

// Mocks de los módulos pesados (LLM + executor del builder)
const { mockLLMQuery, mockExecuteParse } = vi.hoisted(() => ({
  mockLLMQuery: vi.fn(),
  mockExecuteParse: vi.fn(),
}));

vi.mock("../llm", async () => {
  const actual = await vi.importActual<typeof import("../llm")>("../llm");
  return { ...actual, llmClient: { query: mockLLMQuery } };
});

vi.mock("../tools", async () => {
  const actual = await vi.importActual<typeof import("../tools")>("../tools");
  return { ...actual, executeParseAccountingOperation: mockExecuteParse };
});

// El logger no debe escribir a stdout en tests
const mockLogStructured = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logging/structured", () => ({
  logStructured: mockLogStructured,
}));

import { AgentService } from "../agent.service";
import { journalEntryAiTools } from "../agent.tools";
import { ValidationError, ACCOUNT_NOT_POSTABLE } from "@/features/shared/errors";
import type { CreateJournalEntrySuggestion } from "../agent.types";

// ── Fixtures ──

const ACC_EXPENSE = "clxx00000000000000000001";
const ACC_BANK = "clxx00000000000000000002";

function makeSuggestion(): CreateJournalEntrySuggestion {
  return {
    action: "createJournalEntry",
    data: {
      template: "expense_bank_payment",
      voucherTypeCode: "CE",
      date: "2026-04-26",
      description: "Compra de alimento",
      amount: 5000,
      lines: [
        { accountId: ACC_EXPENSE, debit: 5000, credit: 0 },
        { accountId: ACC_BANK, debit: 0, credit: 5000 },
      ],
      originalText: "compra de alimento por 5000 al banco",
      resolvedAccounts: {
        [ACC_EXPENSE]: { code: "5.1.2", name: "Alimento", requiresContact: false },
        [ACC_BANK]: { code: "1.1.3.1", name: "Banco", requiresContact: false },
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Dispatch + tools restringidas ──

describe("AgentService.query — mode='journal-entry-ai' dispatch", () => {
  it("pasa exactamente journalEntryAiTools al LLM (1 tool, parseAccountingOperationToSuggestion)", async () => {
    mockLLMQuery.mockResolvedValueOnce({ text: "ok", toolCalls: [], usage: undefined });
    const service = new AgentService();

    await service.query("org-1", "user-1", "contador", "compra de alimento", undefined, "journal-entry-ai");

    expect(mockLLMQuery).toHaveBeenCalledTimes(1);
    const args = mockLLMQuery.mock.calls[0][0];
    expect(args.tools).toEqual(journalEntryAiTools);
    expect(args.tools).toHaveLength(1);
    expect(args.tools[0].name).toBe("parseAccountingOperationToSuggestion");
  });

  it("NO incluye RAG, context de granjas ni history en el system prompt", async () => {
    mockLLMQuery.mockResolvedValueOnce({ text: "ok", toolCalls: [], usage: undefined });
    const service = new AgentService();

    await service.query("org-1", "user-1", "contador", "compra", undefined, "journal-entry-ai");

    const args = mockLLMQuery.mock.calls[0][0];
    expect(args.systemPrompt).not.toContain("Contexto de Documentos (RAG)");
    expect(args.systemPrompt).not.toContain("CONTEXTO DE DATOS DISPONIBLES");
    expect(args.systemPrompt).not.toContain("Historial de Conversación");
  });

  it("ignora session_id en este modo (no persiste history)", async () => {
    mockLLMQuery.mockResolvedValueOnce({ text: "ok", toolCalls: [], usage: undefined });
    const service = new AgentService();

    // session_id presente pero el modo lo descarta
    await service.query("org-1", "user-1", "contador", "compra", "sess-123", "journal-entry-ai");

    // El system prompt no incluye historial (mock de memoryRepo no se invoca tampoco)
    const args = mockLLMQuery.mock.calls[0][0];
    expect(args.systemPrompt).not.toContain("Historial");
  });
});

// ── Inyección de catálogo ──

describe("AgentService.query — catálogo desde contextHints", () => {
  it("inyecta el catálogo de cuentas en el system prompt cuando viene en contextHints", async () => {
    mockLLMQuery.mockResolvedValueOnce({ text: "", toolCalls: [], usage: undefined });
    const service = new AgentService();

    await service.query(
      "org-1",
      "user-1",
      "contador",
      "compra",
      undefined,
      "journal-entry-ai",
      {
        catalog: {
          bank: [{ id: "b-1", code: "1.1.3.1", name: "Banco BCP" }],
          cash: [{ id: "c-1", code: "1.1.1.1", name: "Caja" }],
          expense: [
            { id: "e-1", code: "5.1.2", name: "Alimento", requiresContact: true },
          ],
        },
      },
    );

    const args = mockLLMQuery.mock.calls[0][0];
    expect(args.systemPrompt).toContain("## Catálogo precargado de cuentas");
    expect(args.systemPrompt).toContain('id: "b-1"');
    expect(args.systemPrompt).toContain('id: "c-1"');
    expect(args.systemPrompt).toContain('id: "e-1"');
    expect(args.systemPrompt).toContain("requiresContact: true");
  });

  it("inyecta proveedores cuando vienen en contextHints", async () => {
    mockLLMQuery.mockResolvedValueOnce({ text: "", toolCalls: [], usage: undefined });
    const service = new AgentService();

    await service.query(
      "org-1",
      "user-1",
      "contador",
      "pagué a Granos del Sur",
      undefined,
      "journal-entry-ai",
      { contacts: [{ id: "ct-1", name: "Granos del Sur", nit: "1234567" }] },
    );

    const args = mockLLMQuery.mock.calls[0][0];
    expect(args.systemPrompt).toContain("## Proveedores precargados");
    expect(args.systemPrompt).toContain('name: "Granos del Sur"');
  });

  it("emite journal_ai_correction cuando contextHints incluye formState", async () => {
    mockLLMQuery.mockResolvedValueOnce({ text: "", toolCalls: [], usage: undefined });
    const service = new AgentService();

    await service.query(
      "org-1",
      "user-1",
      "contador",
      "el monto era 4500",
      undefined,
      "journal-entry-ai",
      { formState: { template: "expense_bank_payment", amount: 5000 } },
    );

    const correctionEvents = mockLogStructured.mock.calls
      .map((c) => c[0])
      .filter((e: { event: string }) => e.event === "journal_ai_correction");
    expect(correctionEvents).toHaveLength(1);
    expect(correctionEvents[0]).toMatchObject({ orgId: "org-1", userId: "user-1" });
  });

  it("inyecta el bloque de formState renderizado en el system prompt durante una corrección", async () => {
    // Caso: el modal hace round-trip de corrección NL. El frontend manda el
    // estado actual del form en contextHints.formState. El system prompt debe
    // incluir el bloque "## Estado actual del formulario — el usuario está
    // corrigiendo" con el JSON del formState anterior (no solo el flag de
    // corrección — el LLM necesita ver los valores para modificar solo los
    // campos mencionados).
    mockLLMQuery.mockResolvedValueOnce({ text: "", toolCalls: [], usage: undefined });
    const service = new AgentService();

    const formState = {
      template: "expense_bank_payment",
      amount: 5000,
      date: "2026-04-26",
      description: "Compra de alimento balanceado",
      expenseAccountId: "clxx00000000000000000005",
      bankAccountId: "clxx00000000000000000001",
    };

    await service.query(
      "org-1",
      "user-1",
      "contador",
      "el monto era 4500",
      undefined,
      "journal-entry-ai",
      { formState },
    );

    const args = mockLLMQuery.mock.calls[0][0];
    expect(args.systemPrompt).toContain(
      "## Estado actual del formulario — el usuario está corrigiendo",
    );
    expect(args.systemPrompt).toContain("Modificá SOLO los campos que el usuario menciona");
    expect(args.systemPrompt).toContain("volvé a llamar parseAccountingOperationToSuggestion");
    expect(args.systemPrompt).toContain('"amount": 5000');
    expect(args.systemPrompt).toContain('"template": "expense_bank_payment"');
    expect(args.systemPrompt).toContain('"expenseAccountId": "clxx00000000000000000005"');
    expect(args.systemPrompt).toContain('"date": "2026-04-26"');
  });

  it("NO emite journal_ai_correction cuando formState está ausente", async () => {
    mockLLMQuery.mockResolvedValueOnce({ text: "", toolCalls: [], usage: undefined });
    const service = new AgentService();

    await service.query("org-1", "user-1", "contador", "compra", undefined, "journal-entry-ai");

    const correctionEvents = mockLogStructured.mock.calls
      .map((c) => c[0])
      .filter((e: { event: string }) => e.event === "journal_ai_correction");
    expect(correctionEvents).toHaveLength(0);
  });
});

// ── Tool call exitosa ──

describe("AgentService.query — tool call parseAccountingOperationToSuggestion exitosa", () => {
  it("invoca executeParseAccountingOperation y devuelve suggestion con requiresConfirmation=true", async () => {
    const toolCall = {
      id: "call-1",
      name: "parseAccountingOperationToSuggestion",
      input: { template: "expense_bank_payment" },
    };
    mockLLMQuery.mockResolvedValueOnce({
      text: "Listo, revisá el asiento.",
      toolCalls: [toolCall],
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });
    const suggestion = makeSuggestion();
    mockExecuteParse.mockResolvedValueOnce(suggestion);

    const service = new AgentService();
    const response = await service.query(
      "org-1",
      "user-1",
      "contador",
      "compra de alimento",
      undefined,
      "journal-entry-ai",
    );

    // Server inyecta originalText desde el prompt (el LLM no lo manda).
    expect(mockExecuteParse).toHaveBeenCalledWith("org-1", {
      ...toolCall.input,
      originalText: "compra de alimento",
    });
    expect(response.requiresConfirmation).toBe(true);
    expect(response.suggestion).toEqual(suggestion);
    expect(response.message).toBe("Listo, revisá el asiento.");
  });

  it("inyecta originalText desde prompt cuando no hay formState (primer call)", async () => {
    // Reproduce el bug del 2026-04-26: el LLM omitía originalText (no tiene
    // contexto sobre por qué debería copiarlo) → ValidationError "expected
    // string, received undefined". El servidor lo inyecta explícitamente.
    mockLLMQuery.mockResolvedValueOnce({
      text: "",
      toolCalls: [
        {
          id: "c",
          name: "parseAccountingOperationToSuggestion",
          input: { template: "bank_deposit", amount: 500 },
        },
      ],
      usage: undefined,
    });
    mockExecuteParse.mockResolvedValueOnce(makeSuggestion());

    const service = new AgentService();
    await service.query(
      "org-1",
      "user-1",
      "contador",
      "Deposito Bs500 al Banco desde Caja",
      undefined,
      "journal-entry-ai",
    );

    expect(mockExecuteParse).toHaveBeenCalledWith("org-1", {
      template: "bank_deposit",
      amount: 500,
      originalText: "Deposito Bs500 al Banco desde Caja",
    });
  });

  it("inyecta originalText desde formState en correcciones (preserva el original)", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "",
      toolCalls: [
        {
          id: "c",
          name: "parseAccountingOperationToSuggestion",
          input: { template: "bank_deposit", amount: 500 },
        },
      ],
      usage: undefined,
    });
    mockExecuteParse.mockResolvedValueOnce(makeSuggestion());

    const service = new AgentService();
    await service.query(
      "org-1",
      "user-1",
      "contador",
      "el monto era 5000",
      undefined,
      "journal-entry-ai",
      {
        formState: {
          template: "bank_deposit",
          originalText: "Deposito Bs500 al Banco desde Caja",
        },
      },
    );

    // El prompt actual ("el monto era 5000") es la corrección — NO debe
    // pisar el originalText. El audit trail preserva el primer pedido.
    expect(mockExecuteParse).toHaveBeenCalledWith("org-1", {
      template: "bank_deposit",
      amount: 500,
      originalText: "Deposito Bs500 al Banco desde Caja",
    });
  });

  it("override: lo que el LLM mande en originalText se ignora (server es source of truth)", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "",
      toolCalls: [
        {
          id: "c",
          name: "parseAccountingOperationToSuggestion",
          input: {
            template: "bank_deposit",
            originalText: "el LLM resumió esto a su gusto",
          },
        },
      ],
      usage: undefined,
    });
    mockExecuteParse.mockResolvedValueOnce(makeSuggestion());

    const service = new AgentService();
    await service.query(
      "org-1",
      "user-1",
      "contador",
      "Deposito Bs500 al Banco desde Caja",
      undefined,
      "journal-entry-ai",
    );

    expect(mockExecuteParse).toHaveBeenCalledWith("org-1", {
      template: "bank_deposit",
      originalText: "Deposito Bs500 al Banco desde Caja",
    });
  });

  it("emite journal_ai_parsed con el template detectado", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "",
      toolCalls: [{ id: "c", name: "parseAccountingOperationToSuggestion", input: {} }],
      usage: undefined,
    });
    mockExecuteParse.mockResolvedValueOnce(makeSuggestion());

    const service = new AgentService();
    await service.query(
      "org-1",
      "user-1",
      "contador",
      "x",
      undefined,
      "journal-entry-ai",
      { formState: { template: "expense_bank_payment" } },
    );

    const parsedEvents = mockLogStructured.mock.calls
      .map((c) => c[0])
      .filter((e: { event: string }) => e.event === "journal_ai_parsed");
    expect(parsedEvents).toHaveLength(1);
    expect(parsedEvents[0]).toMatchObject({
      template: "expense_bank_payment",
      isCorrection: true,
    });
  });

  it("usa mensaje fallback cuando el LLM devuelve text vacío", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "",
      toolCalls: [{ id: "c", name: "parseAccountingOperationToSuggestion", input: {} }],
      usage: undefined,
    });
    mockExecuteParse.mockResolvedValueOnce(makeSuggestion());

    const service = new AgentService();
    const response = await service.query(
      "org-1", "user-1", "contador", "x", undefined, "journal-entry-ai",
    );

    expect(response.message).toContain("Revisá los datos");
    expect(response.requiresConfirmation).toBe(true);
  });
});

// ── Errores y edge cases ──

describe("AgentService.query — error handling en modo journal-entry-ai", () => {
  it("ValidationError del builder → mensaje al usuario, sin suggestion", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "",
      toolCalls: [{ id: "c", name: "parseAccountingOperationToSuggestion", input: {} }],
      usage: undefined,
    });
    mockExecuteParse.mockRejectedValueOnce(
      new ValidationError("Cuentas no usables: 5.1.2 Alimento", ACCOUNT_NOT_POSTABLE),
    );

    const service = new AgentService();
    const response = await service.query(
      "org-1", "user-1", "contador", "compra", undefined, "journal-entry-ai",
    );

    expect(response.suggestion).toBeNull();
    expect(response.requiresConfirmation).toBe(false);
    expect(response.message).toContain("Cuentas no usables");
  });

  it("Tool call inesperada → outcome unexpected_tool, mensaje genérico", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "",
      toolCalls: [{ id: "c", name: "createExpense", input: {} }],
      usage: undefined,
    });

    const service = new AgentService();
    const response = await service.query(
      "org-1", "user-1", "contador", "x", undefined, "journal-entry-ai",
    );

    expect(response.suggestion).toBeNull();
    expect(response.requiresConfirmation).toBe(false);
    expect(response.message).toContain("error");

    const unexpectedEvents = mockLogStructured.mock.calls
      .map((c) => c[0])
      .filter((e: { event: string }) => e.event === "journal_ai_unexpected_tool");
    expect(unexpectedEvents).toHaveLength(1);
    expect(unexpectedEvents[0]).toMatchObject({ tool: "createExpense" });
  });

  it("Sin tool call → mensaje del LLM, outcome no_tool_call", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "¿Pagaste por banco o en efectivo?",
      toolCalls: [],
      usage: undefined,
    });

    const service = new AgentService();
    const response = await service.query(
      "org-1", "user-1", "contador", "compra de alimento", undefined, "journal-entry-ai",
    );

    expect(response.suggestion).toBeNull();
    expect(response.requiresConfirmation).toBe(false);
    expect(response.message).toBe("¿Pagaste por banco o en efectivo?");
  });

  it("Excepción no-AppError del builder → mensaje canned + outcome error", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "",
      toolCalls: [{ id: "c", name: "parseAccountingOperationToSuggestion", input: {} }],
      usage: undefined,
    });
    mockExecuteParse.mockRejectedValueOnce(new Error("DB conn lost"));

    const service = new AgentService();
    const response = await service.query(
      "org-1", "user-1", "contador", "x", undefined, "journal-entry-ai",
    );

    expect(response.suggestion).toBeNull();
    expect(response.message).toContain("error");
    expect(response.message).not.toContain("DB conn lost"); // no leak de mensaje interno
  });
});

// ── Telemetría ──

describe("AgentService.query — telemetría agent_invocation con mode journal-entry-ai", () => {
  it("emite agent_invocation con mode='journal-entry-ai' y outcome correcto", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "",
      toolCalls: [{ id: "c", name: "parseAccountingOperationToSuggestion", input: {} }],
      usage: { inputTokens: 200, outputTokens: 30, totalTokens: 230 },
    });
    mockExecuteParse.mockResolvedValueOnce(makeSuggestion());

    const service = new AgentService();
    await service.query("org-1", "user-1", "contador", "x", undefined, "journal-entry-ai");

    const invocations = mockLogStructured.mock.calls
      .map((c) => c[0])
      .filter((e: { event: string }) => e.event === "agent_invocation");
    expect(invocations).toHaveLength(1);
    expect(invocations[0]).toMatchObject({
      mode: "journal-entry-ai",
      outcome: "ok",
      orgId: "org-1",
      userId: "user-1",
      role: "contador",
      inputTokens: 200,
      outputTokens: 30,
      totalTokens: 230,
      toolCallsCount: 1,
      isCorrection: false,
    });
  });

  it("agent_invocation con outcome=parse_failed cuando ValidationError", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "",
      toolCalls: [{ id: "c", name: "parseAccountingOperationToSuggestion", input: {} }],
      usage: undefined,
    });
    mockExecuteParse.mockRejectedValueOnce(
      new ValidationError("oops", "JOURNAL_AI_ACCOUNT_NOT_FOUND"),
    );

    const service = new AgentService();
    await service.query("org-1", "user-1", "contador", "x", undefined, "journal-entry-ai");

    const invocations = mockLogStructured.mock.calls
      .map((c) => c[0])
      .filter((e: { event: string }) => e.event === "agent_invocation");
    expect(invocations[0].outcome).toBe("parse_failed");
    expect(invocations[0].errorMessage).toBe("JOURNAL_AI_ACCOUNT_NOT_FOUND");
  });
});

// ── Backward compat: mode='chat' (default) no se ve afectado ──

describe("AgentService.query — backward compat con mode='chat'", () => {
  it("mode default sigue funcionando (no rompe el flow existente)", async () => {
    mockLLMQuery.mockResolvedValueOnce({ text: "respuesta", toolCalls: [], usage: undefined });

    const service = new AgentService();
    // Call signature original (sin mode) — debería seguir funcionando
    const response = await service.query("org-1", "user-1", "contador", "hola");

    expect(response).toBeDefined();
    // queryJournalEntryAi NO debería haber sido ejecutado (no inyecta system prompt nuevo)
    const args = mockLLMQuery.mock.calls[0][0];
    expect(args.systemPrompt).not.toContain("captura de asientos contables");
  });
});
