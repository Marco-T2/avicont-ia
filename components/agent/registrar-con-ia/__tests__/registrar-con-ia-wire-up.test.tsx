/**
 * Behavioral wire-up tests — Registrar con IA modal C1 jsdom backend integration state transitions.
 *
 * Paired sister precedent STRUCTURAL EXACT mirror: registrar-con-ia.test.tsx (C0 mount/render).
 * UX SHAPE axis-distinct chat-like simple conversational — state transitions IDLE → THINKING →
 * suggestion presence in messages signals naturally READY → CONFIRMING → DONE | ERROR + retry:
 *   - handleSend dispatches query call con prompt + mode chat + contextHints prop drilling
 *   - query resolves createExpense → confirm-card bubble rendered con Bs. amount + category
 *     Spanish enum nativo + description? + date DD/MM/YYYY formatDateBO + lotName from contextHints
 *   - query resolves logMortality → confirm-card bubble rendered subset count + cause? + date + lotName
 *   - query resolves null suggestion → bot message rendered + back to idle input restored
 *   - query rejects → bot error bubble + retry chip rendered
 *   - confirm-card "Confirmar" click → confirm called with suggestion payload
 *   - confirm resolves → bot success message appended + status reset idle (chat continues per D-C1-POST-CONFIRM)
 *   - confirm rejects → bot error bubble + retry chip appended
 *   - confirm-card "Cancelar" click → bot continuation bubble appended (re-prompt chat per D-C1-CANCEL-FLOW)
 *   - retry chip click after reject → re-dispatches last query con prompt preserved
 *
 * RED-α C1: behavioral assertion mismatch — modal C0 cementado handleSend stub empty NO query call,
 * NO confirm-card render, NO confirm/cancel/retry handlers. Mock values driver-anchored schema
 * textual verified prisma/schema.prisma:182 ExpenseCategory enum Spanish nativo Bolivia regional
 * (ALIMENTO/AGUA/MEDICAMENTOS) lección heredada matures cumulative cross-POC (evidence-supersedes-
 * assumption-lock 38ma + textual-rule-verification 23ma + arch/§13/test-mock-values-driver-anchored).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

afterEach(() => cleanup());

const { mockQuery, mockConfirm, mockReportEvent } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockConfirm: vi.fn(),
  mockReportEvent: vi.fn(),
}));

vi.mock("@/modules/ai-agent/presentation/client", () => ({
  useAgentQuery: vi.fn(() => ({
    query: mockQuery,
    confirm: mockConfirm,
    reportEvent: mockReportEvent,
    isLoading: false,
    error: null,
  })),
}));

import RegistrarConIAModal from "../index";

// Helper: render con contextHints extended (lotName + farmName resolved from page Server Component).
// Variable-typed param bypass TS excess property check on object literal at JSX prop (structural
// assignability: source extra fields silently ignored at type level for non-literal sources).
function renderModal(
  contextHints: {
    lotId?: string;
    farmId?: string;
    lotName?: string;
    farmName?: string;
  } = {
    lotId: "lot-1",
    lotName: "Lote 1 - Galpón 3",
    farmName: "Granja A",
  },
) {
  return render(
    <RegistrarConIAModal
      orgSlug="acme"
      open={true}
      onOpenChange={() => {}}
      contextHints={contextHints}
    />,
  );
}

describe("RegistrarConIAModal — C1 wire-up backend integration state transitions chat-like", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockConfirm.mockReset();
    mockReportEvent.mockReset();
  });

  // α16
  it("clicking Enviar with input dispatches query con prompt + mode chat + contextHints", async () => {
    mockQuery.mockResolvedValueOnce({
      message: "OK",
      suggestion: {
        action: "createExpense",
        data: { amount: 200, category: "ALIMENTO", description: "balanceado", lotId: "lot-1", date: "2026-05-10" },
      },
      requiresConfirmation: true,
    });
    renderModal();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "200 bs alimento" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "200 bs alimento",
          mode: "chat",
          contextHints: expect.objectContaining({ lotId: "lot-1" }),
        }),
      );
    });
  });

  // α17
  it("query resolves createExpense → confirm-card bubble rendered con Bs. amount + ALIMENTO + description + DD/MM/YYYY + lotName", async () => {
    mockQuery.mockResolvedValueOnce({
      message: "He interpretado",
      suggestion: {
        action: "createExpense",
        data: { amount: 200, category: "ALIMENTO", description: "balanceado", lotId: "lot-1", date: "2026-05-10" },
      },
      requiresConfirmation: true,
    });
    renderModal();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "200 bs alimento" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    expect(await screen.findByText(/Bs\.\s*200/)).toBeTruthy();
    expect(screen.getByText(/ALIMENTO/)).toBeTruthy();
    expect(screen.getByText(/balanceado/i)).toBeTruthy();
    expect(screen.getByText(/10\/05\/2026/)).toBeTruthy();
    expect(screen.getByText(/Lote 1 - Galpón 3/)).toBeTruthy();
  });

  // α18
  it("query resolves logMortality → confirm-card bubble rendered con count + cause + DD/MM/YYYY + lotName", async () => {
    mockQuery.mockResolvedValueOnce({
      message: "OK",
      suggestion: {
        action: "logMortality",
        data: { count: 15, cause: "enfermedad", lotId: "lot-1", date: "2026-05-10" },
      },
      requiresConfirmation: true,
    });
    renderModal();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "15 muertes pollos" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    expect(await screen.findByText(/\b15\b/)).toBeTruthy();
    expect(screen.getByText(/enfermedad/i)).toBeTruthy();
    expect(screen.getByText(/10\/05\/2026/)).toBeTruthy();
    expect(screen.getByText(/Lote 1 - Galpón 3/)).toBeTruthy();
  });

  // α19
  it("query resolves null suggestion → bot message bubble rendered + input restored idle", async () => {
    mockQuery.mockResolvedValueOnce({
      message: "¿Podés aclarar?",
      suggestion: null,
      requiresConfirmation: false,
    });
    renderModal();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ambiguo" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    expect(await screen.findByText(/¿Podés aclarar\?/)).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(false);
  });

  // α20
  it("query rejects → bot error bubble + retry chip rendered", async () => {
    mockQuery.mockRejectedValueOnce(new Error("LLM failed"));
    renderModal();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "200 bs" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    expect(await screen.findByRole("button", { name: /reintentar/i })).toBeTruthy();
  });

  // α21
  it("confirm-card Confirmar click → confirm called con suggestion payload", async () => {
    const suggestion = {
      action: "createExpense" as const,
      data: { amount: 200, category: "ALIMENTO" as const, description: "balanceado", lotId: "lot-1", date: "2026-05-10" },
    };
    mockQuery.mockResolvedValueOnce({ message: "OK", suggestion, requiresConfirmation: true });
    mockConfirm.mockResolvedValueOnce({ message: "Creado", data: {} });
    renderModal();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    const confirmBtn = await screen.findByRole("button", { name: /^confirmar$/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ action: "createExpense" }));
    });
  });

  // α22
  it("confirm resolves → bot success message appended + status reset idle (chat continues)", async () => {
    const suggestion = {
      action: "createExpense" as const,
      data: { amount: 200, category: "ALIMENTO" as const, description: "balanceado", lotId: "lot-1", date: "2026-05-10" },
    };
    mockQuery.mockResolvedValueOnce({ message: "OK", suggestion, requiresConfirmation: true });
    mockConfirm.mockResolvedValueOnce({ message: "Gasto registrado", data: { id: "exp-1" } });
    renderModal();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    const confirmBtn = await screen.findByRole("button", { name: /^confirmar$/i });
    fireEvent.click(confirmBtn);
    expect(await screen.findByText(/Gasto registrado/)).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(false);
  });

  // α23
  it("confirm rejects → bot error bubble + retry chip appended", async () => {
    const suggestion = {
      action: "createExpense" as const,
      data: { amount: 200, category: "ALIMENTO" as const, description: "balanceado", lotId: "lot-1", date: "2026-05-10" },
    };
    mockQuery.mockResolvedValueOnce({ message: "OK", suggestion, requiresConfirmation: true });
    mockConfirm.mockRejectedValueOnce(new Error("DB write failed"));
    renderModal();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    const confirmBtn = await screen.findByRole("button", { name: /^confirmar$/i });
    fireEvent.click(confirmBtn);
    expect(await screen.findByRole("button", { name: /reintentar/i })).toBeTruthy();
  });

  // α24
  it("confirm-card Cancelar click → bot continuation bubble appended (re-prompt chat)", async () => {
    const suggestion = {
      action: "createExpense" as const,
      data: { amount: 200, category: "ALIMENTO" as const, description: "balanceado", lotId: "lot-1", date: "2026-05-10" },
    };
    mockQuery.mockResolvedValueOnce({ message: "OK", suggestion, requiresConfirmation: true });
    renderModal();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    const cancelBtn = await screen.findByRole("button", { name: /^cancelar$/i });
    fireEvent.click(cancelBtn);
    expect(await screen.findByText(/reformular|registrar otra cosa|algo más/i)).toBeTruthy();
  });

  // α25
  it("retry chip click after query reject → re-dispatches last query con prompt preserved", async () => {
    mockQuery
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ message: "OK", suggestion: null, requiresConfirmation: false });
    renderModal();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "200 bs" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    const retryBtn = await screen.findByRole("button", { name: /reintentar/i });
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });
});
