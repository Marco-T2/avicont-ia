/**
 * C0 presentation shape — Registrar con IA modal (existence-only regex Opt A).
 *
 * Paired sister precedent STRUCTURAL EXACT mirror: c3-presentation-shape.poc-paired-farms-lots.test.ts.
 * UX SHAPE axis-distinct vs journal-entry-ai-modal form-complex (chat-like simple
 * conversational granjos mobile-friendly mayor — useState simple, NO FSM 6 phases).
 *
 * Verifica shape archivos NEW greenfield modal scoped POC #2 AI tools writing granjas:
 *   - index.tsx default-exports RegistrarConIAModal + imports useAgentQuery + Dialog
 *   - types.ts exports Message discriminated union (role: user|bot|confirm-card)
 *     + re-exports AgentSuggestion
 *
 * RED-α C0: DEFERRED expected mode — readFileSync sobre archivos NEW no existentes
 * (greenfield) tira ENOENT → cada α FAIL pre-GREEN. Paired sister C0+C1+C2 POC paired
 * farms+lots precedent EXACT mirror cumulative cross-POC matures.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MODAL_ROOT = resolve(__dirname, "..");

function readModalFile(rel: string): string {
  return readFileSync(resolve(MODAL_ROOT, rel), "utf-8");
}

describe("C0 presentation shape — Registrar con IA modal (existence-only regex)", () => {
  // α1
  it("index.tsx default-exports RegistrarConIAModal component", () => {
    const src = readModalFile("index.tsx");
    expect(src).toMatch(/^export\s+default\s+function\s+RegistrarConIAModal\b/m);
  });

  // α2
  it("index.tsx imports useAgentQuery from features/ai-agent/client", () => {
    const src = readModalFile("index.tsx");
    expect(src).toMatch(/import\s*\{[^}]*\buseAgentQuery\b[^}]*\}\s*from\s*["']@\/features\/ai-agent\/client["']/);
  });

  // α3
  it("index.tsx imports Dialog from components/ui/dialog (paired sister structural EXACT)", () => {
    const src = readModalFile("index.tsx");
    expect(src).toMatch(/import\s*\{[^}]*\bDialog\b[^}]*\}\s*from\s*["']@\/components\/ui\/dialog["']/);
  });

  // α4
  it("types.ts exports Message discriminated union (role: user|bot|confirm-card)", () => {
    const src = readModalFile("types.ts");
    expect(src).toMatch(/^export\s+type\s+Message\b/m);
    expect(src).toMatch(/["']user["']/);
    expect(src).toMatch(/["']bot["']/);
    expect(src).toMatch(/["']confirm-card["']/);
  });

  // α5
  it("types.ts re-exports AgentSuggestion type from features/ai-agent/server", () => {
    const src = readModalFile("types.ts");
    expect(src).toMatch(/^export\s+type\s*\{[^}]*\bAgentSuggestion\b[^}]*\}\s*from\s*["']@\/features\/ai-agent\/server["']/m);
  });
});
