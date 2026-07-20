/**
 * T2.3 — REQ-DISPLAY-2 + Q6: journal-entry-form preview block ELIMINADO.
 *
 * Q6 decision: correlativo NO está reservado pre-save (always could be
 * wrong); preview simplifies the form by removing it entirely. The
 * `formatCorrelativeNumber(...)` call from features/accounting/correlative.utils
 * is dropped as part of REQ-DISPLAY-2 helper retirement.
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   - card title MUST NOT contain `/D\d{4}-\d{6}|[A-Z]{1,3}-\d{3,4}/`
 *     pattern; today render at L375-379 inserts
 *     `— ${previewDisplayNumber}` from line 343-355 computation.
 *   - source-text grep MUST NOT contain `previewDisplayNumber` or
 *     `formatCorrelativeNumber`.
 *
 * GREEN: delete previewDisplayNumber block (L343-355) + render JSX
 *   conditional (L375-379) + import (L25) from journal-entry-form.tsx.
 */
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

afterEach(cleanup);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/components/accounting/journal-line-row", () => ({
  default: () => null,
}));

describe("T2.3 — JournalEntryForm preview retirement (Q6, REQ-DISPLAY-2)", () => {
  it("source: previewDisplayNumber + formatCorrelativeNumber + helper import removed", () => {
    const src = readFileSync(
      resolve(__dirname, "..", "journal-entry-form.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/previewDisplayNumber/);
    expect(src).not.toMatch(/formatCorrelativeNumber/);
    expect(src).not.toMatch(/from\s+["']@\/features\/accounting\/correlative\.utils["']/);
  });

  it("source: card title block does NOT inject formatted display number prefix", () => {
    const src = readFileSync(
      resolve(__dirname, "..", "journal-entry-form.tsx"),
      "utf8",
    );
    // Locate "Nuevo Asiento Contable" / "Editar Asiento Contable" section
    // and confirm no `${previewDisplayNumber}` / format-prefix template is
    // appended.
    expect(src).not.toMatch(/—\s*\$\{previewDisplayNumber\}/);
    expect(src).not.toMatch(/font-bold text-primary[\s\S]{0,200}previewDisplayNumber/);
  });
});
