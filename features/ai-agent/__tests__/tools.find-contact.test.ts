/**
 * Tests del executor findContact.
 *
 * Reusa contactsService.list(orgId, { search, isActive }) que ya filtra por
 * contains en name + nit. El executor agrega: exclusión de CLIENTE, ranking
 * por calidad de match, cap 10, matchedExactly cuando hay match exacto único.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-for-vitest";
});

import { executeFindContact } from "../tools/find-contact";
import type { makeContactsService } from "@/modules/contacts/presentation/server";
import type { Contact, ContactType } from "@/generated/prisma/client";

// ── Fixtures ──

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "ct-1",
    organizationId: "org-1",
    type: "PROVEEDOR" as ContactType,
    name: "Granos del Sur",
    nit: "1234567",
    email: null,
    phone: null,
    address: null,
    paymentTermsDays: 30,
    creditLimit: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDeps(contacts: Contact[]) {
  const contactsService = {
    list: vi.fn(async () => contacts),
  } as unknown as ReturnType<typeof makeContactsService>;
  return { contactsService };
}

// ── Tests ──

describe("findContact — filtros básicos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invoca contactsService.list con search + isActive=true", async () => {
    const deps = makeDeps([]);
    await executeFindContact("org-1", { query: "Granos" }, deps);

    expect(deps.contactsService.list).toHaveBeenCalledWith(
      "org-1",
      { search: "Granos", isActive: true },
    );
  });

  it("excluye CLIENTE del resultado", async () => {
    const proveedor = makeContact({ id: "ct-1", type: "PROVEEDOR", name: "Proveedor X" });
    const cliente = makeContact({ id: "ct-2", type: "CLIENTE", name: "Cliente Y" });
    const socio = makeContact({ id: "ct-3", type: "SOCIO", name: "Socio Z" });

    const result = await executeFindContact("org-1", { query: "X" }, makeDeps([proveedor, cliente, socio]));

    const ids = result.contacts.map((c) => c.id);
    expect(ids).toContain("ct-1");
    expect(ids).toContain("ct-3");
    expect(ids).not.toContain("ct-2");
  });

  it("limita el resultado a 10", async () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      makeContact({ id: `ct-${i}`, name: `Contact ${i}` }),
    );

    const result = await executeFindContact("org-1", { query: "Contact" }, makeDeps(many));

    expect(result.contacts).toHaveLength(10);
  });
});

// ── Ranking ──

describe("findContact — ranking por calidad de match", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exact name match va primero", async () => {
    const exact = makeContact({ id: "ct-1", name: "Granos del Sur" });
    const prefix = makeContact({ id: "ct-2", name: "Granos del Sur SA" });
    const contains = makeContact({ id: "ct-3", name: "Distribuidor Granos del Sur Ltda" });

    const result = await executeFindContact(
      "org-1",
      { query: "Granos del Sur" },
      makeDeps([contains, prefix, exact]),
    );

    expect(result.contacts[0].id).toBe("ct-1");
  });

  it("exact NIT match va antes que prefix de name", async () => {
    const exactNit = makeContact({ id: "ct-1", nit: "9999", name: "Otra Razón Social" });
    const prefixName = makeContact({ id: "ct-2", nit: "1111", name: "9999 Distribuciones" });

    const result = await executeFindContact(
      "org-1",
      { query: "9999" },
      makeDeps([prefixName, exactNit]),
    );

    expect(result.contacts[0].id).toBe("ct-1");
  });
});

// ── matchedExactly ──

describe("findContact — matchedExactly", () => {
  beforeEach(() => vi.clearAllMocks());

  it("setea matchedExactly cuando hay un único match exacto por nombre", async () => {
    const exact = makeContact({ id: "ct-1", name: "Granos del Sur" });
    const otro = makeContact({ id: "ct-2", name: "Granos del Norte" });

    const result = await executeFindContact(
      "org-1",
      { query: "Granos del Sur" },
      makeDeps([exact, otro]),
    );

    expect(result.matchedExactly).toBe("ct-1");
  });

  it("setea matchedExactly cuando hay un único match exacto por NIT", async () => {
    const exact = makeContact({ id: "ct-1", nit: "1234567" });
    const otro = makeContact({ id: "ct-2", nit: "9999999", name: "matches by name 1234567" });

    const result = await executeFindContact(
      "org-1",
      { query: "1234567" },
      makeDeps([otro, exact]),
    );

    expect(result.matchedExactly).toBe("ct-1");
  });

  it("NO setea matchedExactly cuando hay múltiples matches exactos", async () => {
    // Dos contactos con el mismo nombre exacto (caso real: típo del usuario)
    const a = makeContact({ id: "ct-1", name: "Granos" });
    const b = makeContact({ id: "ct-2", name: "Granos" });

    const result = await executeFindContact(
      "org-1",
      { query: "Granos" },
      makeDeps([a, b]),
    );

    expect(result.matchedExactly).toBeUndefined();
  });

  it("NO setea matchedExactly si solo hay matches parciales", async () => {
    const partial = makeContact({ id: "ct-1", name: "Granos del Sur" });

    const result = await executeFindContact(
      "org-1",
      { query: "Granos" },
      makeDeps([partial]),
    );

    expect(result.matchedExactly).toBeUndefined();
  });
});

// ── Casos edge ──

describe("findContact — edge cases", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devuelve lista vacía cuando no hay coincidencias", async () => {
    const result = await executeFindContact("org-1", { query: "Inexistente" }, makeDeps([]));

    expect(result.contacts).toEqual([]);
    expect(result.matchedExactly).toBeUndefined();
  });

  it("match case-insensitive en nombre", async () => {
    const c = makeContact({ id: "ct-1", name: "GRANOS DEL SUR" });

    const result = await executeFindContact("org-1", { query: "granos del sur" }, makeDeps([c]));

    expect(result.matchedExactly).toBe("ct-1");
  });

  it("retorna shape con id, name, nit, type", async () => {
    const c = makeContact({ id: "ct-1", name: "Veterinaria Andina", nit: "555", type: "PROVEEDOR" });

    const result = await executeFindContact("org-1", { query: "Veterinaria" }, makeDeps([c]));

    expect(result.contacts[0]).toEqual({
      id: "ct-1",
      name: "Veterinaria Andina",
      nit: "555",
      type: "PROVEEDOR",
    });
  });
});
