/**
 * PR7.2 RED — Dynamic role picker in members admin
 *
 * REQ: U.4mod-S1, U.4mod-S2
 * - picker fetches /api/organizations/[orgSlug]/roles on mount
 * - picker contains exactly 6 options (5 system + 1 custom)
 * - owner NOT in options (not assignable by admin)
 * - custom role 'facturador' IS in options
 */

import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RolePicker from "../role-picker";

afterEach(() => cleanup());

beforeEach(() => {
  // Radix Select jsdom shims
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false);
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

// 4 system roles (owner excluded) + 1 custom role
const MOCK_ROLES = [
  { slug: "owner", name: "Owner", isSystem: true },
  { slug: "admin", name: "Admin", isSystem: true },
  { slug: "contador", name: "Contador", isSystem: true },
  { slug: "cobrador", name: "Cobrador", isSystem: true },
  { slug: "member", name: "Member", isSystem: true },
  { slug: "facturador", name: "Facturador", isSystem: false },
];

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function setup() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ roles: MOCK_ROLES }),
  }) as unknown as typeof fetch;
}

async function openSelect() {
  const trigger = screen.getByRole("combobox");
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
}

describe("RolePicker — dynamic fetch (PR7.2)", () => {
  it("T7.2-1 — contains exactly 5 options after fetch (owner excluded)", async () => {
    setup();
    render(<RolePicker orgSlug="test-org" value="member" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/organizations/test-org/roles",
      );
    });

    await openSelect();

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(5); // 4 system (no owner) + 1 custom
  });

  it("T7.2-2 — owner is NOT in the options", async () => {
    setup();
    render(<RolePicker orgSlug="test-org" value="member" onChange={vi.fn()} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await openSelect();
    await screen.findAllByRole("option");

    expect(screen.queryByRole("option", { name: /^owner$/i })).not.toBeInTheDocument();
  });

  it("T7.2-3 — custom role facturador IS in the options", async () => {
    setup();
    render(<RolePicker orgSlug="test-org" value="member" onChange={vi.fn()} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await openSelect();

    expect(await screen.findByRole("option", { name: /facturador/i })).toBeInTheDocument();
  });
});
