/**
 * T4.3 RED → T4.9 GREEN (partial: dispatch-list)
 *
 * REQ-C.2 — dispatch-list.tsx (DispatchList) date cell must use formatDateBO()
 * and render "DD/MM/YYYY" format.
 *
 * The DispatchList accepts HubItem[] where item.date is a Date object.
 * formatDateBO handles Date instances by taking .toISOString().slice(0,10).
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import DispatchList from "../dispatch-list";
import type { HubItem } from "@/modules/dispatch/presentation";

afterEach(() => cleanup());

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── jsdom shims ──
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
window.Element.prototype.releasePointerCapture = vi.fn();
window.Element.prototype.setPointerCapture = vi.fn();

// ── Fixtures ──

const DISPATCH_ITEM: HubItem = {
  source: "dispatch",
  type: "NOTA_DESPACHO",
  id: "dispatch-1",
  displayCode: "ND-001",
  referenceNumber: 1,
  date: new Date("2026-04-17T12:00:00.000Z"), // UTC-noon (new format)
  contactId: "contact-1",
  contactName: "Cliente SA",
  periodId: "period-1",
  description: "Despacho test",
  totalAmount: "500.00",
  status: "POSTED",
};

// ── Tests ──

describe("DispatchList — date cell format (REQ-C.2)", () => {
  it("C.2.1 — date cell renders DD/MM/YYYY format", () => {
    render(
      <DispatchList
        orgSlug="test-org"
        items={[DISPATCH_ITEM]}
        periods={[]}
        filters={{}}
      />,
    );
    expect(screen.getByText("17/04/2026")).toBeInTheDocument();
  });

  it("C.2.2 — date cell does NOT render old locale short-month format", () => {
    render(
      <DispatchList
        orgSlug="test-org"
        items={[DISPATCH_ITEM]}
        periods={[]}
        filters={{}}
      />,
    );
    // Old format was "17 abr. 2026" or "17 abr 2026"
    expect(screen.queryByText(/abr/i)).not.toBeInTheDocument();
  });
});
