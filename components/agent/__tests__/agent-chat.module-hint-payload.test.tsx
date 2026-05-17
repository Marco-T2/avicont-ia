/**
 * SCN-3 — agent-chat.tsx raw-fetch body must contain module_hint derived
 * from the current pathname via usePathname() + deriveModuleHint().
 *
 * Mirrors sister agent-chat.surface-payload.surface-separation.test.tsx
 * (surface: "sidebar-qa" lock) and the sidebar precedent at
 * components/sidebar/__tests__/active-module-nav.test.tsx:32 for the
 * vi.mock("next/navigation", { usePathname }) pattern.
 *
 * Per-test pathname switching: we use a mutable closure variable that
 * the vi.mock factory reads each call, then we override per-describe by
 * mutating `currentPathname` before render.
 */

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mutable closure pathname — set in beforeEach of each describe.
let currentPathname = "/test-org/accounting";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
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
  if (!globalThis.crypto?.randomUUID) {
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function submitPrompt(prompt: string) {
  const input = screen.getByPlaceholderText("Escribe un mensaje...");
  fireEvent.change(input, { target: { value: prompt } });
  const form = input.closest("form");
  expect(form).toBeTruthy();
  fireEvent.submit(form!);
  await vi.waitFor(() => {
    expect(fetchMock).toHaveBeenCalled();
  });
}

function bodyJSON(): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse((init as RequestInit).body as string);
}

describe("SCN-3.1: pathname /<org>/accounting/* yields module_hint='accounting'", () => {
  beforeEach(() => {
    currentPathname = "/test-org/accounting/journals";
  });
  it("fetch body contains module_hint: 'accounting'", async () => {
    render(<AgentChat isOpen={true} onClose={() => {}} orgSlug="test-org" />);
    await submitPrompt("hola");
    const body = bodyJSON();
    expect(body.module_hint).toBe("accounting");
  });
});

describe("SCN-3.2: pathname /<org>/farms/* yields module_hint='farm'", () => {
  beforeEach(() => {
    currentPathname = "/test-org/farms/farm-1";
  });
  it("fetch body contains module_hint: 'farm'", async () => {
    render(<AgentChat isOpen={true} onClose={() => {}} orgSlug="test-org" />);
    await submitPrompt("hola");
    const body = bodyJSON();
    expect(body.module_hint).toBe("farm");
  });
});

describe("SCN-3.3: pathname /<org>/lots/* yields module_hint='farm'", () => {
  beforeEach(() => {
    currentPathname = "/test-org/lots/lot-1";
  });
  it("fetch body contains module_hint: 'farm'", async () => {
    render(<AgentChat isOpen={true} onClose={() => {}} orgSlug="test-org" />);
    await submitPrompt("hola");
    const body = bodyJSON();
    expect(body.module_hint).toBe("farm");
  });
});

describe("SCN-3.4: non-mapped pathname yields explicit module_hint=null", () => {
  beforeEach(() => {
    currentPathname = "/test-org/documents";
  });
  it("fetch body contains module_hint key with value null (NOT undefined)", async () => {
    render(<AgentChat isOpen={true} onClose={() => {}} orgSlug="test-org" />);
    await submitPrompt("hola");
    const body = bodyJSON();
    expect("module_hint" in body).toBe(true);
    expect(body.module_hint).toBeNull();
  });
});
