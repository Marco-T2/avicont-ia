/**
 * F6 C6.5 RED → GREEN — DocumentCard "Re-indexar" button + ConfirmDialog (REQ-49).
 *
 * Locks:
 *   - Button renders only when doc.aiSummary is set (proxy for "has content"
 *     per orchestrator brief — same heuristic the existing "Re-analizar"
 *     copy uses).
 *   - Clicking opens a ConfirmDialog with the prescribed Spanish copy.
 *   - Confirming POSTs to /api/documents/{id}/reindex.
 *   - Success toast on 200; conflict toast (specific copy) on 409;
 *     generic error toast on 5xx.
 *
 * Server is authoritative for RBAC (per orchestrator brief: omit client RBAC,
 * rely on server 403 → handled here as a generic error toast).
 *
 * Expected RED failure (pre-GREEN): no "Re-indexar" button exists in
 * DocumentCard; `getByRole('button', { name: /Re-indexar/i })` throws
 * "Unable to find an accessible element" for the first scenario, and the
 * fetch-capture scenarios never see a request. That IS the right reason
 * (UI feature not built yet).
 */
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DocumentCard from "../document-card";

afterEach(() => cleanup());

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";

type FetchInit = Parameters<typeof fetch>[1];
type FetchCall = { url: string; init?: FetchInit };

function setupFetch(
  captured: FetchCall[],
  handler: (call: FetchCall) => Response,
) {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: FetchInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const call = { url, init };
    captured.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
}

const BASE_DOC = {
  id: "doc_card_1",
  name: "Plan de cuentas.pdf",
  fileUrl: "https://blob/foo",
  fileSize: 1024,
  fileType: "application/pdf",
  scope: "ORGANIZATION" as const,
  organizationId: "org_1",
  userId: "user_1",
  aiSummary: "Este documento contiene...",
  createdAt: new Date("2026-05-17T00:00:00Z"),
  updatedAt: new Date("2026-05-17T00:00:00Z"),
  user: { name: "Tester", email: "t@example.com" },
};

const noop = () => {};

function renderCard(docOverrides: Partial<typeof BASE_DOC> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = { ...BASE_DOC, ...docOverrides } as any;
  return render(
    <DocumentCard
      document={doc}
      isAnalyzing={false}
      onAnalyze={noop}
      onDelete={noop}
      onToggleSummary={noop}
      expandedSummaries={new Set()}
      formatFileSize={() => "1 KB"}
    />,
  );
}

describe("DocumentCard — Re-indexar button (REQ-49)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) renders the Re-indexar button when the document has aiSummary", () => {
    renderCard();
    expect(
      screen.getByRole("button", { name: /Re-indexar/i }),
    ).toBeInTheDocument();
  });

  it("(b) does NOT render the Re-indexar button when aiSummary is absent", () => {
    renderCard({ aiSummary: undefined });
    expect(
      screen.queryByRole("button", { name: /Re-indexar/i }),
    ).not.toBeInTheDocument();
  });

  it("(c) clicking opens a confirm dialog with the prescribed copy", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Re-indexar/i }));

    expect(
      await screen.findByText(/reprocesará el documento/i),
    ).toBeInTheDocument();
  });

  it("(d) confirming POSTs to /api/documents/{id}/reindex and shows success toast", async () => {
    const captured: FetchCall[] = [];
    setupFetch(captured, () =>
      new Response(JSON.stringify({ chunkCount: 5 }), { status: 200 }),
    );

    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Re-indexar/i }));
    await screen.findByText(/reprocesará el documento/i);
    fireEvent.click(screen.getByRole("button", { name: /Sí, re-indexar/i }));

    await waitFor(() => {
      expect(
        captured.some(
          (c) =>
            c.url.endsWith("/api/documents/doc_card_1/reindex") &&
            c.init?.method === "POST",
        ),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/re-indexado/i),
      );
    });
  });

  it("(e) on 409 shows the in-progress toast", async () => {
    const captured: FetchCall[] = [];
    setupFetch(captured, () =>
      new Response(JSON.stringify({ error: "Reindexación en curso" }), {
        status: 409,
      }),
    );

    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Re-indexar/i }));
    await screen.findByText(/reprocesará el documento/i);
    fireEvent.click(screen.getByRole("button", { name: /Sí, re-indexar/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/en progreso|en curso/i),
      );
    });
  });

  it("(f) on 5xx shows a generic error toast", async () => {
    const captured: FetchCall[] = [];
    setupFetch(captured, () =>
      new Response(JSON.stringify({ error: "boom" }), { status: 500 }),
    );

    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Re-indexar/i }));
    await screen.findByText(/reprocesará el documento/i);
    fireEvent.click(screen.getByRole("button", { name: /Sí, re-indexar/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/error/i),
      );
    });
  });
});
