/**
 * Assistant messages SHALL render markdown (bold, lists) — user messages stay plain text.
 *
 * Smoke test reveló que el LLM formatea respuestas con markdown (`**bold**`, `* item`)
 * pero el sidebar renderizaba el contenido raw, mostrando los asteriscos literales.
 * Fix: usar react-markdown + remark-gfm para assistant; user queda como plain text
 * (lo que el user typed, no se renderiza markdown del usuario).
 */

import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/acme/accounting",
}));

import { AgentChat } from "../agent-chat";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  if (!globalThis.crypto?.randomUUID) {
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function submitAndWait(message: string, userInput = "hola") {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ message }),
  });

  render(<AgentChat isOpen={true} onClose={() => {}} orgSlug="acme" />);

  const input = screen.getByPlaceholderText("Escribe un mensaje...");
  fireEvent.change(input, { target: { value: userInput } });
  fireEvent.submit(input.closest("form")!);

  await vi.waitFor(() => {
    expect(fetchMock).toHaveBeenCalled();
  });
}

describe("AgentChat markdown rendering", () => {
  it("renders **bold** in assistant messages as <strong>", async () => {
    await submitAndWait("Esto es **importante** ahora");

    const strong = await screen.findByText("importante");
    expect(strong.tagName).toBe("STRONG");
  });

  it("renders markdown bullet lists as <ul><li>", async () => {
    await submitAndWait("Items:\n\n- primero\n- segundo");

    const firstItem = await screen.findByText("primero");
    expect(firstItem.closest("li")).not.toBeNull();
    const ul = firstItem.closest("ul");
    expect(ul).not.toBeNull();
  });

  it("user messages stay plain text (no markdown render)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "respuesta" }),
    });

    render(<AgentChat isOpen={true} onClose={() => {}} orgSlug="acme" />);

    const input = screen.getByPlaceholderText("Escribe un mensaje...");
    fireEvent.change(input, { target: { value: "**no debe ser bold**" } });
    fireEvent.submit(input.closest("form")!);

    // user message text appears verbatim including the asterisks
    const userMsg = await screen.findByText("**no debe ser bold**");
    expect(userMsg.tagName).not.toBe("STRONG");
    // no <strong> child either
    expect(userMsg.querySelector("strong")).toBeNull();
  });
});
