/**
 * SCN-5.1 — agent-chat.tsx raw-fetch body must contain surface: "sidebar-qa".
 *
 * agent-chat does NOT use useAgentQuery — it calls fetch directly (lines
 * 49-53 of components/agent/agent-chat.tsx). TS does NOT enforce the
 * surface field on raw fetch; this test is the enforcement.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// MOCK HYGIENE [[mock_hygiene_commit_scope]]: agent-chat now calls
// usePathname(); outside a Next router context this throws. Mock with a
// stable test pathname (agent-sidebar-module-hint SDD).
vi.mock("next/navigation", () => ({
  usePathname: () => "/acme/accounting",
}));

import { AgentChat } from "../agent-chat";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ message: "ok" }),
  });
  vi.stubGlobal("fetch", fetchMock);
  // crypto.randomUUID stubbed for SSR-safe session id
  if (!globalThis.crypto?.randomUUID) {
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SCN-5.1: agent-chat fetch body contains surface: 'sidebar-qa'", () => {
  it("submitting a message sends surface in the JSON body", async () => {
    render(
      <AgentChat isOpen={true} onClose={() => {}} orgSlug="acme" />,
    );

    const input = screen.getByPlaceholderText("Escribe un mensaje...");
    fireEvent.change(input, { target: { value: "hola" } });

    // Submit the form (Enter in the input also submits)
    const form = input.closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    // Wait for the fetch call
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.surface).toBe("sidebar-qa");
    expect(body.prompt).toBe("hola");
  });
});
