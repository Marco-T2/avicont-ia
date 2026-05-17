/**
 * REQ-40/44 — TagsService unit (in-memory fake repo).
 *
 * Locks the service contract:
 *  - list(orgId)          → repo.listByOrg passthrough.
 *  - resolveBySlugs(...)  → repo.findBySlugs passthrough.
 *  - create(org, name)    → slugify(name) server-side, persist via repo.create.
 *  - attach(docId, ids)   → repo.attachToDocument passthrough.
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - TagsService methods currently throw `new Error("TODO F4-POST")`.
 *     Every test below fails at the throw site, NOT at the assertion. That
 *     IS the right reason (skeleton placeholders being filled in).
 */

import { describe, it, expect } from "vitest";
import { TagsService } from "../application/tags.service";
import type { TagsRepositoryPort } from "../domain/ports/tags-repository.port";
import type { CreateTagInput, Tag } from "../domain/tag.types";

function makeFakeRepo(): TagsRepositoryPort & { _state: Tag[]; _attached: Array<{ documentId: string; tagIds: string[] }> } {
  const state: Tag[] = [];
  const attached: Array<{ documentId: string; tagIds: string[] }> = [];
  return {
    _state: state,
    _attached: attached,
    async listByOrg(orgId: string) {
      return state.filter((t) => t.organizationId === orgId);
    },
    async findBySlugs(orgId: string, slugs: string[]) {
      return state.filter((t) => t.organizationId === orgId && slugs.includes(t.slug));
    },
    async create(input: CreateTagInput & { slug: string }) {
      const row: Tag = {
        id: `tag-${state.length + 1}`,
        organizationId: input.organizationId,
        name: input.name,
        slug: input.slug,
        color: input.color ?? null,
        createdAt: new Date("2026-05-17T00:00:00Z"),
      };
      state.push(row);
      return row;
    },
    async attachToDocument(documentId: string, tagIds: string[]) {
      attached.push({ documentId, tagIds });
    },
  };
}

describe("TagsService — REQ-40/44", () => {
  it("SCN-list: list returns repo.listByOrg result", async () => {
    const repo = makeFakeRepo();
    repo._state.push({
      id: "t1",
      organizationId: "org-1",
      name: "Contabilidad",
      slug: "contabilidad",
      color: null,
      createdAt: new Date(),
    });
    const svc = new TagsService(repo);
    const out = await svc.list("org-1");
    expect(out).toHaveLength(1);
    expect(out[0].slug).toBe("contabilidad");
  });

  it("SCN-resolveBySlugs: returns matching tags only", async () => {
    const repo = makeFakeRepo();
    repo._state.push(
      { id: "t1", organizationId: "org-1", name: "A", slug: "a", color: null, createdAt: new Date() },
      { id: "t2", organizationId: "org-1", name: "B", slug: "b", color: null, createdAt: new Date() },
      { id: "t3", organizationId: "org-1", name: "C", slug: "c", color: null, createdAt: new Date() },
    );
    const svc = new TagsService(repo);
    const out = await svc.resolveBySlugs("org-1", ["a", "c"]);
    expect(out.map((t) => t.slug).sort()).toEqual(["a", "c"]);
  });

  it("SCN-44.1: create derives slug from name (lowercase + dashes + diacritic strip)", async () => {
    const repo = makeFakeRepo();
    const svc = new TagsService(repo);
    const out = await svc.create("org-1", "Contabilidad Avanzada");
    expect(out.slug).toBe("contabilidad-avanzada");
    expect(out.name).toBe("Contabilidad Avanzada");
    expect(out.organizationId).toBe("org-1");
    expect(repo._state).toHaveLength(1);
    expect(repo._state[0].slug).toBe("contabilidad-avanzada");
  });

  it("SCN-44.2: create ignores any client-provided slug (positional arg is name)", async () => {
    const repo = makeFakeRepo();
    const svc = new TagsService(repo);
    const out = await svc.create("org-1", "RRHH");
    expect(out.slug).toBe("rrhh");
  });

  it("SCN-attach: attach delegates to repo.attachToDocument", async () => {
    const repo = makeFakeRepo();
    const svc = new TagsService(repo);
    await svc.attach("doc-1", ["t1", "t2"]);
    expect(repo._attached).toEqual([{ documentId: "doc-1", tagIds: ["t1", "t2"] }]);
  });
});
