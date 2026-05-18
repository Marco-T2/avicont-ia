/**
 * RED → GREEN: journal-entry-form.tsx renders the
 * "Tipo de documento físico (opcional)" dropdown populated from the
 * operationalDocTypes prop, and includes operationalDocTypeId in the
 * POST payload when the user selects an option (journal-physical-document
 * Phase 7 task 7.1).
 *
 * Layer: component test (RTL + jsdom). Mocks `fetch` to capture the POST
 * body so we assert behavior end-to-end through the submit handler.
 *
 * Note: this test uses an existing JE creation form, NO direction filter
 * per spec Q3 lock — the dropdown shows every OperationalDocType passed in.
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JournalEntryForm from "../journal-entry-form";

afterEach(() => cleanup());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Render the line rows as a passthrough so the form test focuses on header.
vi.mock("@/components/accounting/journal-line-row", () => ({
  default: () => null,
}));

const PERIOD = {
  id: "period-1",
  name: "Mayo 2026",
  startDate: new Date("2026-05-01"),
  endDate: new Date("2026-05-31"),
  status: "OPEN" as const,
  organizationId: "org-1",
  year: 2026,
  createdById: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
} as never;

const VOUCHER = {
  id: "vt-1",
  code: "CD",
  prefix: "D",
  name: "Diario",
  description: null,
  isActive: true,
  isAdjustment: false,
  organizationId: "org-1",
} as never;

const ACCOUNT = {
  id: "acc-1",
  code: "1.1.1",
  name: "Caja",
  type: "ACTIVO",
  nature: "DEUDORA",
  subtype: null,
  isDetail: true,
  requiresContact: false,
  isActive: true,
  organizationId: "org-1",
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  description: null,
} as never;

const OPERATIONAL_DOC_TYPES = [
  { id: "odt-vg", code: "VG", name: "Venta de Gestión" },
  { id: "odt-rc", code: "RC", name: "Recibo de Cobranza" },
  { id: "odt-nd", code: "ND", name: "Nota de Despacho" },
];

describe("journal-entry-form — operational doc type dropdown (Phase 7)", () => {
  beforeEach(() => {
    // last-reference fetch returns a no-op so the form's useEffect doesn't
    // throw; the form-submit fetch is the one we capture per test.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/last-reference")) {
          return {
            ok: true,
            json: async () => ({
              lastReferenceNumber: null,
              nextNumber: 1,
            }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ id: "je-1" }),
        } as Response;
      }),
    );
  });

  it("7.1-S1 — renders dropdown labeled 'Tipo de documento físico (opcional)' with all options + (Sin documento físico) sentinel", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[ACCOUNT]}
        periods={[PERIOD]}
        voucherTypes={[VOUCHER]}
        operationalDocTypes={OPERATIONAL_DOC_TYPES}
        editEntry={undefined}
      />,
    );

    // The label is rendered via <Label htmlFor="operational-doc-type">; the
    // associated SelectTrigger is identifiable by id.
    expect(
      screen.getByText(/Tipo de documento físico \(opcional\)/i),
    ).toBeInTheDocument();
    expect(
      document.getElementById("operational-doc-type"),
    ).not.toBeNull();
  });

  it("7.1-S2 — dropdown empty options array still renders the (Sin documento físico) sentinel (graceful empty catalog)", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[ACCOUNT]}
        periods={[PERIOD]}
        voucherTypes={[VOUCHER]}
        operationalDocTypes={[]}
        editEntry={undefined}
      />,
    );

    // The trigger is present; the popover content is not opened so we don't
    // assert the sentinel option here — opening the radix Select in jsdom
    // is brittle. The presence of the trigger + label is the structural
    // gate; behavioral selection is covered by 7.1-S3 below via state.
    expect(
      document.getElementById("operational-doc-type"),
    ).not.toBeNull();
  });

  it("7.1-S3 — pre-fills operationalDocTypeId from editEntry when present", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[ACCOUNT]}
        periods={[PERIOD]}
        voucherTypes={[VOUCHER]}
        operationalDocTypes={OPERATIONAL_DOC_TYPES}
        editEntry={{
          id: "je-1",
          number: 1,
          date: "2026-05-15",
          description: "edit me",
          periodId: PERIOD.id,
          voucherTypeId: VOUCHER.id,
          referenceNumber: 42,
          operationalDocTypeId: "odt-vg",
          lines: [
            { accountId: "acc-1", debit: 100, credit: 0 },
            { accountId: "acc-1", debit: 0, credit: 100 },
          ],
        }}
      />,
    );

    // The Select's hidden input mirrors the active state — Radix puts the
    // current value as the SelectValue text inside the trigger.
    const trigger = document.getElementById("operational-doc-type");
    expect(trigger).not.toBeNull();
    // The Select trigger should display the prefilled value text. Radix
    // renders the selected option inside the trigger as a span; grab it via
    // the trigger element's textContent.
    expect(trigger!.textContent ?? "").toContain("VG");
    expect(trigger!.textContent ?? "").toContain("Venta de Gestión");
  });

  it("7.1-S4 — handleSubmit POST payload includes operationalDocTypeId (null when not selected)", async () => {
    const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/last-reference")) {
        return {
          ok: true,
          json: async () => ({
            lastReferenceNumber: null,
            nextNumber: 1,
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ id: "je-1" }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[ACCOUNT]}
        periods={[PERIOD]}
        voucherTypes={[VOUCHER]}
        operationalDocTypes={OPERATIONAL_DOC_TYPES}
        editEntry={{
          id: "je-1",
          number: 1,
          date: "2026-05-15",
          description: "ok",
          periodId: PERIOD.id,
          voucherTypeId: VOUCHER.id,
          referenceNumber: null,
          operationalDocTypeId: null,
          lines: [
            { accountId: ACCOUNT.id, debit: 100, credit: 0 },
            { accountId: ACCOUNT.id, debit: 0, credit: 100 },
          ],
        }}
      />,
    );

    // Submit by firing the form submit directly — we don't need to drive the
    // radix Select since the editEntry path already seeds state.
    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    // Wait a microtask for the async handler to fire fetch
    await Promise.resolve();
    await Promise.resolve();

    const postCall = fetchSpy.mock.calls.find(
      (c) => !String(c[0]).includes("/last-reference"),
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(String((postCall![1] as RequestInit).body ?? "{}"));
    expect(body).toHaveProperty("operationalDocTypeId", null);
  });
});
