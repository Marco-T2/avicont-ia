/**
 * REQ-40/41/44 — PrismaTagsRepository adapter shape test.
 *
 * Mirrors the paired sister `prisma-org-profile.repository.test.ts` pattern —
 * inject a fake PrismaClient via BaseRepository constructor, assert that each
 * port method delegates to the right Prisma model with the expected args.
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - Skeleton methods throw `new Error("TODO F4-POST")`. Every test fails
 *     at the throw, not at the assertion (right reason).
 */

import { describe, it, expect, vi } from "vitest";
import { PrismaTagsRepository } from "../infrastructure/prisma/prisma-tags.repository";
import type { Tag } from "../domain/tag.types";

function makeRow(overrides: Partial<Tag> = {}): Tag {
  return {
    id: "t1",
    organizationId: "org-1",
    name: "Contabilidad",
    slug: "contabilidad",
    color: null,
    createdAt: new Date("2026-05-17T00:00:00Z"),
    ...overrides,
  };
}

type AnySpy = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

function makeFakeDb(stubs: {
  findMany?: AnySpy;
  create?: AnySpy;
  createMany?: AnySpy;
}) {
  return {
    tag: {
      findMany: stubs.findMany ?? vi.fn(),
      create: stubs.create ?? vi.fn(),
    },
    documentTag: {
      createMany: stubs.createMany ?? vi.fn(),
    },
  };
}

describe("PrismaTagsRepository", () => {
  it("listByOrg delegates to prisma.tag.findMany scoped by organizationId, ordered by name", async () => {
    const findMany: AnySpy = vi.fn(async () => [makeRow()]);
    const db = makeFakeDb({ findMany });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new PrismaTagsRepository(db as any);

    const out = await repo.listByOrg("org-1");

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { organizationId: "org-1" },
    });
    expect(out).toHaveLength(1);
    expect(out[0].slug).toBe("contabilidad");
  });

  it("findBySlugs delegates with where { organizationId, slug: { in: [...] } }", async () => {
    const findMany: AnySpy = vi.fn(async () => [
      makeRow({ slug: "a", id: "ta" }),
      makeRow({ slug: "b", id: "tb" }),
    ]);
    const db = makeFakeDb({ findMany });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new PrismaTagsRepository(db as any);

    const out = await repo.findBySlugs("org-1", ["a", "b", "z"]);

    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { organizationId: "org-1", slug: { in: ["a", "b", "z"] } },
    });
    expect(out.map((t) => t.slug).sort()).toEqual(["a", "b"]);
  });

  it("findBySlugs returns [] without hitting Prisma when slugs is empty", async () => {
    const findMany: AnySpy = vi.fn(async () => []);
    const db = makeFakeDb({ findMany });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new PrismaTagsRepository(db as any);

    const out = await repo.findBySlugs("org-1", []);

    expect(out).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("create delegates to prisma.tag.create with derived slug already supplied", async () => {
    const create: AnySpy = vi.fn(async () =>
      makeRow({ id: "tx", slug: "contabilidad-avanzada", name: "Contabilidad Avanzada" }),
    );
    const db = makeFakeDb({ create });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new PrismaTagsRepository(db as any);

    const out = await repo.create({
      organizationId: "org-1",
      name: "Contabilidad Avanzada",
      slug: "contabilidad-avanzada",
    });

    expect(create.mock.calls[0][0]).toMatchObject({
      data: {
        organizationId: "org-1",
        name: "Contabilidad Avanzada",
        slug: "contabilidad-avanzada",
      },
    });
    expect(out.slug).toBe("contabilidad-avanzada");
  });

  it("attachToDocument inserts N rows via documentTag.createMany with skipDuplicates", async () => {
    const createMany: AnySpy = vi.fn(async () => ({ count: 2 }));
    const db = makeFakeDb({ createMany });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new PrismaTagsRepository(db as any);

    await repo.attachToDocument("doc-1", ["t1", "t2"]);

    expect(createMany.mock.calls[0][0]).toMatchObject({
      data: [
        { documentId: "doc-1", tagId: "t1" },
        { documentId: "doc-1", tagId: "t2" },
      ],
      skipDuplicates: true,
    });
  });

  it("attachToDocument is a no-op when tagIds is empty (no Prisma call)", async () => {
    const createMany: AnySpy = vi.fn(async () => ({ count: 0 }));
    const db = makeFakeDb({ createMany });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new PrismaTagsRepository(db as any);

    await repo.attachToDocument("doc-1", []);

    expect(createMany).not.toHaveBeenCalled();
  });
});
