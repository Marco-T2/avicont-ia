/**
 * T19 [RED → GREEN] — create-lot-dialog farmName + datalist autocomplete
 * (REQ-200, REQ-205).
 *
 * Dialog drops `farmId` prop, adds `farmName` text input with
 * `<datalist>` suggestions. Suggestions are derived client-side
 * from the same GET /api/organizations/{slug}/lots used by the lots
 * page (REQ-205 — no new endpoint, scale max ~4 lots/org). Body
 * sends `farmName` (NO memberId — server-resolved per D-2 already
 * landed in T15). NO farmId in body.
 *
 * Expected failure mode (RED): current dialog signature still
 * requires `farmId`. The new test (a) renders dialog WITHOUT
 * farmId — production code errors `Property 'farmId' is required`
 * at runtime when handleSubmit reads it; (b) submitted body has
 * `farmId` instead of `farmName`. Both assertions fail until T19
 * GREEN lands the new prop surface + autocomplete + payload shape.
 */
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import CreateLotDialog from "../create-lot-dialog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /nuevo lote/i }));
}

describe("CreateLotDialog — farmName + datalist autocomplete (REQ-200, REQ-205)", () => {
  beforeEach(() => {
    // Mock GET /lots for autocomplete suggestion source.
    vi.spyOn(global, "fetch").mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (
          url === "/api/organizations/test-org/lots" &&
          (!init || (init.method ?? "GET") === "GET")
        ) {
          return new Response(
            JSON.stringify([
              { farmName: "Pocona" },
              { farmName: "Capinota" },
              { farmName: "Capinota" }, // duplicate, must de-duplicate
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ id: "l-new" }), { status: 201 });
      },
    );
  });

  it("renders a datalist of unique farmName suggestions sorted alphabetically", async () => {
    render(<CreateLotDialog orgSlug="test-org" />);
    openDialog();

    await waitFor(() => {
      const datalist = document.querySelector("datalist");
      expect(datalist).not.toBeNull();
      const options = Array.from(
        datalist!.querySelectorAll("option"),
      ).map((o) => o.getAttribute("value"));
      // Unique + alphabetical (REQ-205.1)
      expect(options).toEqual(["Capinota", "Pocona"]);
    });
  });

  it("submits body with farmName (NO farmId, NO memberId — D-2 server-resolved)", async () => {
    render(<CreateLotDialog orgSlug="test-org" />);
    openDialog();

    // Wait for suggestions fetch to settle before the submit fetch
    await waitFor(() =>
      expect(document.querySelector("datalist")).not.toBeNull(),
    );

    fireEvent.change(screen.getByPlaceholderText(/Ej: Lote Enero/i), {
      target: { value: "Lote Junio" },
    });
    const inputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="number"]',
    );
    fireEvent.change(inputs[0], { target: { value: "1" } }); // barnNumber
    fireEvent.change(inputs[1], { target: { value: "5000" } }); // initialCount
    fireEvent.change(screen.getByPlaceholderText(/Ej: Capinota/i), {
      target: { value: "Mi Granja Nueva" },
    });

    fireEvent.click(screen.getByRole("button", { name: /crear lote/i }));

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const postCall = calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "POST",
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse(
        ((postCall![1] as RequestInit).body as string) ?? "{}",
      );
      expect(body).toEqual({
        name: "Lote Junio",
        barnNumber: 1,
        initialCount: 5000,
        startDate: expect.any(String),
        farmName: "Mi Granja Nueva",
      });
      // explicit absence assertions — INV-04 / D-2
      expect("farmId" in body).toBe(false);
      expect("memberId" in body).toBe(false);
    });
  });
});
