/**
 * Post simplify-lot-identifier: dialog is a 3-field form (Granja
 * autocomplete + initialCount + startDate). POST body excludes the
 * dropped `name` + `barnNumber` fields (Marco-locked). Autocomplete
 * datalist behavior (REQ-205) preserved.
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

describe("CreateLotDialog — farmName + datalist autocomplete (REQ-205, post simplify-lot-identifier)", () => {
  beforeEach(() => {
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

  it("submits body with { farmName, initialCount, startDate } — NO name/barnNumber/farmId/memberId", async () => {
    render(<CreateLotDialog orgSlug="test-org" />);
    openDialog();

    // Wait for suggestions fetch to settle before the submit fetch
    await waitFor(() =>
      expect(document.querySelector("datalist")).not.toBeNull(),
    );

    // Fill the 3 inputs: farmName, initialCount (number), startDate (date)
    fireEvent.change(screen.getByPlaceholderText(/Ej: Capinota/i), {
      target: { value: "Mi Granja Nueva" },
    });
    const numberInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="number"]',
    );
    fireEvent.change(numberInputs[0], { target: { value: "5000" } });

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
        initialCount: 5000,
        startDate: expect.any(String),
        farmName: "Mi Granja Nueva",
      });
      // Explicit absence assertions — post simplify-lot-identifier
      expect("name" in body).toBe(false);
      expect("barnNumber" in body).toBe(false);
      expect("farmId" in body).toBe(false);
      expect("memberId" in body).toBe(false);
    });
  });
});
