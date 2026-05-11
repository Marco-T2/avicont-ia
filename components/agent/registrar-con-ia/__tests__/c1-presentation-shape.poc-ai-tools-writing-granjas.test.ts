/**
 * C1 presentation shape — Registrar con IA modal wire-up handlers + state mgmt (existence-only regex Opt A).
 *
 * Paired sister precedent STRUCTURAL EXACT mirror: c0-presentation-shape.poc-ai-tools-writing-granjas.test.ts.
 * UX SHAPE axis-distinct vs journal-entry-ai-modal form-complex (chat-like simple
 * conversational granjos mobile-friendly mayor — useState simple, NO FSM 6 phases,
 * append-only messages list immutable history vs replace-single-form).
 *
 * Verifica shape EDIT C1 archivos cementados greenfield modal scoped POC #2 AI tools writing granjas:
 *   - index.tsx defines async handleSend with await query call
 *   - index.tsx defines async handleConfirm with await confirm call
 *   - index.tsx defines handleCancel mutating messages (re-prompt chat continuation)
 *   - index.tsx destructures query + confirm from useAgentQuery (NOT only isLoading)
 *   - index.tsx mutates messages via setMessages useState append pattern
 *
 * RED-α C1: regex FAIL existing impl C0 stub — handleSend empty NO async/await,
 * NO handleConfirm, NO handleCancel, only isLoading destructured from useAgentQuery,
 * NO setMessages setter en useState messages tuple. Paired sister C0 precedent EXACT
 * mirror cumulative cross-POC matures.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MODAL_ROOT = resolve(__dirname, "..");

function readModalFile(rel: string): string {
  return readFileSync(resolve(MODAL_ROOT, rel), "utf-8");
}

describe("C1 presentation shape — Registrar con IA modal wire-up handlers + state mgmt (existence-only regex)", () => {
  // α11
  it("index.tsx defines async handleSend with await query call", () => {
    const src = readModalFile("index.tsx");
    expect(src).toMatch(/\bconst\s+handleSend\s*=\s*async\b[\s\S]*?\bawait\s+query\s*\(/);
  });

  // α12
  it("index.tsx defines async handleConfirm with await confirm call", () => {
    const src = readModalFile("index.tsx");
    expect(src).toMatch(/\bconst\s+handleConfirm\s*=\s*async\b[\s\S]*?\bawait\s+confirm\s*\(/);
  });

  // α13
  it("index.tsx defines handleCancel mutating messages (re-prompt chat continuation)", () => {
    const src = readModalFile("index.tsx");
    expect(src).toMatch(/\bconst\s+handleCancel\s*=[\s\S]*?\bsetMessages\b/);
  });

  // α14
  it("index.tsx destructures query + confirm from useAgentQuery (NOT only isLoading)", () => {
    const src = readModalFile("index.tsx");
    expect(src).toMatch(/const\s*\{[^}]*\bquery\b[^}]*\bconfirm\b[^}]*\}\s*=\s*useAgentQuery/);
  });

  // α15
  it("index.tsx mutates messages via setMessages useState append pattern", () => {
    const src = readModalFile("index.tsx");
    expect(src).toMatch(/const\s*\[\s*messages\s*,\s*setMessages\s*\]\s*=\s*useState/);
  });
});
