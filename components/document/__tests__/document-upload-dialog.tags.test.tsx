/**
 * F5 C5.3 RED → GREEN — DocumentUploadDialog tag MultiSelect (REQ-45).
 *
 * Locks:
 *   - dialog fetches GET /api/organizations/{slug}/tags on mount
 *   - renders all returned tags as toggleable options
 *   - selecting tags then submitting POSTs /api/documents with
 *     `tagIds` as a JSON-stringified FormData field (server route
 *     parses it back to string[]; mirrors how `scope` is sent today).
 *
 * Expected RED failure (pre-GREEN): the dialog doesn't render any tag
 * UI — findByText("Etiquetas") rejects with "Unable to find an
 * element with the text: Etiquetas", failing every it() before the
 * submit-body assertion. That IS the right reason (UI not built yet).
 */
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DocumentUploadDialog from "../document-upload-dialog";

afterEach(() => cleanup());

// ── Clerk hooks: stubbed with a valid org + user for the upload path ────────

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({
    organization: { id: "clerk_org_1", slug: "acme" },
  }),
  useUser: () => ({
    user: { id: "user_1" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Permissions: admin role can upload to ORGANIZATION ──────────────────────
// Stubbing avoids dragging the @clerk server module path into jsdom.

vi.mock("@/features/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/permissions")>();
  return {
    ...actual,
    getUploadScopes: () => ["ORGANIZATION", "ACCOUNTING", "FARM"],
  };
});

const MOCK_TAGS = [
  { id: "t1", name: "Contabilidad", slug: "contabilidad", color: null },
  { id: "t2", name: "Fiscal", slug: "fiscal", color: null },
];

type FetchInit = Parameters<typeof fetch>[1];
type FetchCall = { url: string; init?: FetchInit };

function setupFetch(captured: FetchCall[]) {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: FetchInit) => {
    const url = typeof input === "string" ? input : input.toString();
    captured.push({ url, init });
    if (url.includes("/tags") && (!init || init.method === undefined || init.method === "GET")) {
      return new Response(JSON.stringify({ tags: MOCK_TAGS }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "/api/documents" && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

function buildTxtFile(): File {
  return new File(["hello world"], "doc.txt", { type: "text/plain" });
}

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /Subir Documento/i }));
}

describe("DocumentUploadDialog — tag MultiSelect (REQ-45)", () => {
  beforeEach(() => {
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn();
    }
  });

  it("(a) fetches org tags from /api/organizations/{slug}/tags and renders them", async () => {
    const captured: FetchCall[] = [];
    setupFetch(captured);

    render(<DocumentUploadDialog userRole="admin" />);
    await openDialog();

    await waitFor(() => {
      const tagsCall = captured.find((c) =>
        c.url.includes("/api/organizations/acme/tags"),
      );
      expect(tagsCall).toBeTruthy();
    });

    // Both fixture tags rendered as selectable options.
    expect(await screen.findByText("Contabilidad")).toBeInTheDocument();
    expect(screen.getByText("Fiscal")).toBeInTheDocument();
  });

  it("(b) sends selected tagIds in the POST /api/documents body", async () => {
    const captured: FetchCall[] = [];
    setupFetch(captured);

    render(<DocumentUploadDialog userRole="admin" />);
    await openDialog();

    // Wait for tags to render, then click "Contabilidad".
    const contabilidad = await screen.findByText("Contabilidad");
    fireEvent.click(contabilidad);

    // Fill in name + file (file selector lives behind a hidden input).
    const nameInput = screen.getByPlaceholderText(/nombre del documento/i);
    fireEvent.change(nameInput, { target: { value: "doc-test" } });

    const fileInput = document.getElementById("file-upload") as HTMLInputElement;
    Object.defineProperty(fileInput, "files", {
      value: [buildTxtFile()],
      configurable: true,
    });
    fireEvent.change(fileInput);

    // Submit. The submit button shares the "Subir Documento" label with the
    // open-dialog trigger; pick the one inside the dialog footer (last in
    // DOM order after the open trigger).
    const allSubmits = screen.getAllByRole("button", { name: /Subir Documento/i });
    fireEvent.click(allSubmits[allSubmits.length - 1]);

    await waitFor(() => {
      const post = captured.find(
        (c) => c.url === "/api/documents" && c.init?.method === "POST",
      );
      expect(post).toBeTruthy();
      const form = post!.init!.body as FormData;
      // tagIds shipped as JSON to keep FormData arity simple — server parses back.
      const raw = form.get("tagIds");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string) as string[];
      expect(parsed).toEqual(["t1"]);
    });
  });
});
