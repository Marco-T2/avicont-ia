/**
 * T54 — RED: PeriodCloseDialog should call POST /monthly-close
 *
 * Fails because current dialog targets PATCH /periods/${period.id} with { status: 'CLOSED' }.
 * GREEN: T55 migrates the component to the canonical endpoint.
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PeriodCloseDialog from "../period-close-dialog";

afterEach(() => cleanup());

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const period = { id: "p1", name: "Apr 2026" } as Parameters<typeof PeriodCloseDialog>[0]["period"];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PeriodCloseDialog — canonical endpoint", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    global.fetch = fetchMock;
  });

  it("close button calls POST /monthly-close with periodId", async () => {
    render(
      <PeriodCloseDialog
        period={period}
        orgSlug="acme"
        onOpenChange={vi.fn()}
        onClosed={vi.fn()}
      />,
    );

    const closeBtn = screen.getByRole("button", { name: /cerrar período/i });
    fireEvent.click(closeBtn);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;

    expect(url).toBe("/api/organizations/acme/monthly-close");
    expect(opts.method).toBe("POST");
    expect(body).toMatchObject({ periodId: "p1" });
  });
});
