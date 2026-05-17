/**
 * F5 C5.4 RED → GREEN — DocumentUploadDialog inline tag creation (REQ-45 item 3).
 *
 * Locks:
 *   - typing a name not in the org tag list shows a "Crear «X»" affordance
 *   - clicking it POSTs to /api/organizations/{slug}/tags with { name }
 *   - the returned tag is prepended to the option list and auto-selected,
 *     so the next form submit ships its id in `tagIds`.
 *
 * Expected RED failure (pre-GREEN): there is no input next to the tag
 * picker — the test cannot find a "Nueva etiqueta" placeholder. `findByPlaceholderText`
 * rejects with the standard testing-library miss; that IS the right
 * reason (inline create UI not built yet).
 */
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DocumentUploadDialog from "../document-upload-dialog";

afterEach(() => cleanup());

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({
    organization: { id: "clerk_org_1", slug: "acme" },
  }),
  useUser: () => ({ user: { id: "user_1" } }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/permissions")>();
  return {
    ...actual,
    getUploadScopes: () => ["ORGANIZATION", "ACCOUNTING", "FARM"],
  };
});

const INITIAL_TAGS = [
  { id: "t1", name: "Existente", slug: "existente", color: null },
];

const NEW_TAG = {
  id: "t-new",
  name: "Marketing",
  slug: "marketing",
  color: null,
};

type FetchInit = Parameters<typeof fetch>[1];
type FetchCall = { url: string; init?: FetchInit };

function setupFetch(captured: FetchCall[]) {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: FetchInit) => {
    const url = typeof input === "string" ? input : input.toString();
    captured.push({ url, init });
    if (url.includes("/api/organizations/acme/tags") && (!init || init.method === undefined || init.method === "GET")) {
      return new Response(JSON.stringify({ tags: INITIAL_TAGS }), { status: 200 });
    }
    if (url.includes("/api/organizations/acme/tags") && init?.method === "POST") {
      return new Response(JSON.stringify({ tag: NEW_TAG }), { status: 201 });
    }
    if (url === "/api/documents" && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

function buildTxtFile(): File {
  return new File(["hello"], "doc.txt", { type: "text/plain" });
}

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /Subir Documento/i }));
}

describe("DocumentUploadDialog — inline tag creation (REQ-45 item 3)", () => {
  beforeEach(() => {
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn();
    }
  });

  it("(a) POSTs the new tag, appends it to the option list, and auto-selects it", async () => {
    const captured: FetchCall[] = [];
    setupFetch(captured);

    render(<DocumentUploadDialog userRole="admin" />);
    await openDialog();

    // Wait for the existing tag to render.
    await screen.findByText("Existente");

    // Type a name in the inline-create input and submit.
    const input = screen.getByPlaceholderText(/Nueva etiqueta/i);
    fireEvent.change(input, { target: { value: "Marketing" } });

    const createBtn = screen.getByRole("button", { name: /Crear .*Marketing/i });
    fireEvent.click(createBtn);

    // POST sent with the right body.
    await waitFor(() => {
      const post = captured.find(
        (c) =>
          c.url.includes("/api/organizations/acme/tags") &&
          c.init?.method === "POST",
      );
      expect(post).toBeTruthy();
      expect(JSON.parse(post!.init!.body as string)).toEqual({
        name: "Marketing",
      });
    });

    // New tag rendered as a selected Badge.
    await screen.findByText("Marketing");

    // Now submit the upload; verify the new tag id rides in tagIds.
    const nameInput = screen.getByPlaceholderText(/nombre del documento/i);
    fireEvent.change(nameInput, { target: { value: "doc" } });

    const fileInput = document.getElementById("file-upload") as HTMLInputElement;
    Object.defineProperty(fileInput, "files", {
      value: [buildTxtFile()],
      configurable: true,
    });
    fireEvent.change(fileInput);

    const allSubmits = screen.getAllByRole("button", {
      name: /Subir Documento/i,
    });
    fireEvent.click(allSubmits[allSubmits.length - 1]);

    await waitFor(() => {
      const post = captured.find(
        (c) => c.url === "/api/documents" && c.init?.method === "POST",
      );
      expect(post).toBeTruthy();
      const raw = (post!.init!.body as FormData).get("tagIds");
      expect(JSON.parse(raw as string)).toEqual(["t-new"]);
    });
  });
});
