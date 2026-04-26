/**
 * Tests del FSM puro del modal de captura asistida.
 *
 * El FSM es el corazón del modal — si una transición se rompe, el modal
 * se vuelve impredecible. Estos tests cubren transiciones válidas, transiciones
 * inválidas (que deben ser no-op para evitar estado inconsistente), y el caso
 * degenerado donde una corrección NL puede pisar campos no mencionados (no
 * hay merge en el reducer; la mitigación vive en el system prompt).
 */

import { describe, it, expect } from "vitest";
import {
  journalEntryAiReducer,
  initialState,
  type FsmAction,
} from "../fsm";
import type { ModalState, SuggestionData } from "../types";

// ── Fixtures ──────────────────────────────────────────────────────────

function makeData(overrides: Partial<SuggestionData> = {}): SuggestionData {
  return {
    template: "expense_bank_payment",
    voucherTypeCode: "CE",
    date: "2026-04-26",
    description: "Compra de alimento",
    amount: 5000,
    contactId: undefined,
    lines: [
      { accountId: "acc-exp", debit: 5000, credit: 0 },
      { accountId: "acc-bank", debit: 0, credit: 5000 },
    ],
    originalText: "compra de alimento por 5000 al banco",
    resolvedAccounts: {
      "acc-exp": { code: "5.1.2", name: "Alimento", requiresContact: false },
      "acc-bank": { code: "1.1.3.1", name: "Banco BCP", requiresContact: false },
    },
    ...overrides,
  };
}

function reduce(state: ModalState, action: FsmAction): ModalState {
  return journalEntryAiReducer(state, action);
}

// ── Transiciones felices del flujo principal ─────────────────────────

describe("journalEntryAiReducer — transiciones del flujo feliz", () => {
  it("(1) IDLE + INTERPRET_START → PARSING", () => {
    const next = reduce(initialState, { type: "INTERPRET_START" });
    expect(next).toEqual({ phase: "parsing" });
  });

  it("(2) PARSING + INTERPRET_SUCCESS → READY con data + message", () => {
    const data = makeData();
    const next = reduce(
      { phase: "parsing" },
      { type: "INTERPRET_SUCCESS", data, message: "Asumí fecha 2026-04-26" },
    );
    expect(next).toEqual({
      phase: "ready",
      data,
      message: "Asumí fecha 2026-04-26",
    });
  });

  it("(3) PARSING + INTERPRET_NO_SUGGESTION → IDLE (LLM pidió aclaración)", () => {
    const next = reduce({ phase: "parsing" }, { type: "INTERPRET_NO_SUGGESTION" });
    expect(next).toEqual({ phase: "idle" });
  });

  it("(4) PARSING + INTERPRET_ERROR → ERROR sin previous (no había data)", () => {
    const next = reduce(
      { phase: "parsing" },
      { type: "INTERPRET_ERROR", message: "Network failed" },
    );
    expect(next).toEqual({ phase: "error", message: "Network failed" });
  });

  it("(5) READY + CONFIRM_START → CONFIRMING", () => {
    const data = makeData();
    const next = reduce(
      { phase: "ready", data, message: "" },
      { type: "CONFIRM_START", data },
    );
    expect(next).toEqual({ phase: "confirming", data });
  });

  it("(6) CONFIRMING + CONFIRM_ERROR → ERROR con previous (recovery)", () => {
    const data = makeData();
    const next = reduce(
      { phase: "confirming", data },
      { type: "CONFIRM_ERROR", message: "JOURNAL_NOT_BALANCED", previous: data },
    );
    expect(next).toEqual({
      phase: "error",
      message: "JOURNAL_NOT_BALANCED",
      previous: data,
    });
  });
});

// ── Corrección NL ───────────────────────────────────────────────────

describe("journalEntryAiReducer — corrección NL (round-trip)", () => {
  it("(7) READY + CORRECTION_START → PARSING (preservación de previous via action)", () => {
    const previous = makeData();
    const next = reduce(
      { phase: "ready", data: previous, message: "" },
      { type: "CORRECTION_START", previous },
    );
    expect(next).toEqual({ phase: "parsing" });
  });

  it("(8) PARSING + CORRECTION_SUCCESS → READY con NUEVA data (replace, NO merge)", () => {
    // Caso CRÍTICO. Documentado en el header de fsm.ts.
    // El usuario corrigió "el monto era 4500". El LLM (idealmente) devuelve
    // todo el shape con amount=4500 y el resto idéntico. Si el LLM "olvida"
    // un campo o cambia un ID por interpretación creativa (caso degenerado),
    // el reducer reemplaza sin warning. La mitigación vive en el prompt.
    const previous = makeData({ amount: 5000 });
    const newData = makeData({
      amount: 4500,
      // El LLM por error pone una expense account distinta (caso degenerado)
      lines: [
        { accountId: "acc-exp-different", debit: 4500, credit: 0 },
        { accountId: "acc-bank", debit: 0, credit: 4500 },
      ],
    });
    const next = reduce(
      { phase: "parsing" },
      { type: "CORRECTION_SUCCESS", data: newData, message: "" },
    );
    expect(next.phase).toBe("ready");
    if (next.phase === "ready") {
      // El reducer NO merge — el data nuevo reemplaza completo, incluso el ID
      // que el usuario no pidió cambiar. Test confirma que el comportamiento
      // documentado se mantiene (la mitigación es responsabilidad del prompt).
      expect(next.data).toEqual(newData);
      expect(next.data.lines[0].accountId).toBe("acc-exp-different"); // pisó silenciosamente
      expect(next.data.lines[0].accountId).not.toBe(previous.lines[0].accountId);
    }
  });

  it("(9) PARSING + CORRECTION_ERROR → ERROR con previous para recovery", () => {
    const previous = makeData();
    const next = reduce(
      { phase: "parsing" },
      { type: "CORRECTION_ERROR", message: "Cuenta inexistente", previous },
    );
    expect(next).toEqual({
      phase: "error",
      message: "Cuenta inexistente",
      previous,
    });
  });
});

// ── PATCH_FORM (mutación local sin pasar por LLM) ───────────────────

describe("journalEntryAiReducer — PATCH_FORM", () => {
  it("(10) READY + PATCH_FORM → READY con data nueva, mantiene message anterior", () => {
    const data = makeData({ amount: 5000 });
    const patched = makeData({ amount: 5500 });
    const next = reduce(
      { phase: "ready", data, message: "msg previo" },
      { type: "PATCH_FORM", data: patched },
    );
    expect(next).toEqual({
      phase: "ready",
      data: patched,
      message: "msg previo",
    });
  });

  it("(11) PATCH_FORM en estado != READY → no-op (state se preserva)", () => {
    const patched = makeData();
    const states: ModalState[] = [
      { phase: "idle" },
      { phase: "parsing" },
      { phase: "confirming", data: patched },
      { phase: "error", message: "x" },
    ];
    for (const state of states) {
      const next = reduce(state, { type: "PATCH_FORM", data: patched });
      expect(next).toEqual(state);
    }
  });
});

// ── Recovery desde ERROR ─────────────────────────────────────────────

describe("journalEntryAiReducer — recovery desde ERROR", () => {
  it("(12) ERROR con previous + BACK_TO_FORM → READY con data preservada", () => {
    const previous = makeData();
    const next = reduce(
      { phase: "error", message: "x", previous },
      { type: "BACK_TO_FORM" },
    );
    expect(next).toEqual({ phase: "ready", data: previous, message: "" });
  });

  it("(13) ERROR sin previous + BACK_TO_FORM → IDLE", () => {
    const next = reduce(
      { phase: "error", message: "x" },
      { type: "BACK_TO_FORM" },
    );
    expect(next).toEqual({ phase: "idle" });
  });
});

// ── RESET (cierre del modal o "Limpiar y reescribir") ───────────────

describe("journalEntryAiReducer — RESET", () => {
  it("(14) RESET desde cualquier estado → IDLE", () => {
    const data = makeData();
    const states: ModalState[] = [
      { phase: "idle" },
      { phase: "parsing" },
      { phase: "ready", data, message: "msg" },
      { phase: "confirming", data },
      { phase: "error", message: "x" },
      { phase: "error", message: "x", previous: data },
    ];
    for (const state of states) {
      const next = reduce(state, { type: "RESET" });
      expect(next).toEqual(initialState);
      expect(next).toEqual({ phase: "idle" });
    }
  });
});

// ── Transiciones inválidas — no-op ──────────────────────────────────

describe("journalEntryAiReducer — transiciones inválidas (no-op)", () => {
  it("(15) INTERPRET_START en phases distintas a IDLE → no-op", () => {
    const data = makeData();
    const states: ModalState[] = [
      { phase: "parsing" },
      { phase: "ready", data, message: "" },
      { phase: "confirming", data },
      { phase: "error", message: "x" },
    ];
    for (const state of states) {
      const next = reduce(state, { type: "INTERPRET_START" });
      expect(next).toEqual(state);
    }
  });

  it("(16) CONFIRM_START en phases distintas a READY → no-op", () => {
    const data = makeData();
    const next = reduce(
      { phase: "idle" },
      { type: "CONFIRM_START", data },
    );
    expect(next).toEqual({ phase: "idle" });
  });

  it("(17) BACK_TO_FORM en phases distintas a ERROR → no-op", () => {
    const data = makeData();
    const next = reduce(
      { phase: "ready", data, message: "" },
      { type: "BACK_TO_FORM" },
    );
    expect(next).toEqual({ phase: "ready", data, message: "" });
  });
});
