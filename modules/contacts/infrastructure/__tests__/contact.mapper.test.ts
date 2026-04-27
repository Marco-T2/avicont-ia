import { describe, it, expect } from "vitest";
import { Prisma, type Contact as ContactRow } from "@/generated/prisma/client";
import {
  toDomain,
  toPersistenceCreate,
  toPersistenceUpdate,
} from "../contact.mapper";
import { Contact } from "../../domain/contact.entity";

const ROW: ContactRow = {
  id: "c1",
  organizationId: "org-1",
  type: "CLIENTE",
  name: "Acme",
  nit: "12345",
  email: "a@b.com",
  phone: "555-0000",
  address: "Calle Falsa 123",
  paymentTermsDays: 45,
  creditLimit: new Prisma.Decimal(2500.5),
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

describe("contact.mapper.toDomain", () => {
  it("rebuilds a domain entity from a Prisma row", () => {
    const c = toDomain(ROW);
    expect(c.id).toBe("c1");
    expect(c.organizationId).toBe("org-1");
    expect(c.type).toBe("CLIENTE");
    expect(c.name).toBe("Acme");
    expect(c.nit).toBe("12345");
    expect(c.email).toBe("a@b.com");
    expect(c.paymentTermsDays).toBe(45);
    expect(c.creditLimit).toBe(2500.5);
    expect(c.isActive).toBe(true);
    expect(c.createdAt).toEqual(ROW.createdAt);
  });

  it("handles null nit, email, phone, address, creditLimit", () => {
    const c = toDomain({
      ...ROW,
      nit: null,
      email: null,
      phone: null,
      address: null,
      creditLimit: null,
    });
    expect(c.nit).toBeNull();
    expect(c.email).toBeNull();
    expect(c.phone).toBeNull();
    expect(c.address).toBeNull();
    expect(c.creditLimit).toBeNull();
  });
});

describe("contact.mapper.toPersistenceCreate", () => {
  it("includes id and organizationId for create", () => {
    const c = Contact.create({
      organizationId: "org-1",
      type: "PROVEEDOR",
      name: "Prov X",
      nit: "999",
      paymentTermsDays: 60,
    });
    const data = toPersistenceCreate(c);
    expect(data.id).toBe(c.id);
    expect(data.organizationId).toBe("org-1");
    expect(data.type).toBe("PROVEEDOR");
    expect(data.nit).toBe("999");
    expect(data.paymentTermsDays).toBe(60);
    expect(data.isActive).toBe(true);
  });
});

describe("contact.mapper.toPersistenceUpdate", () => {
  it("excludes id and organizationId from update payload", () => {
    const c = Contact.create({
      organizationId: "org-1",
      type: "CLIENTE",
      name: "Acme",
    });
    const data = toPersistenceUpdate(c);
    expect("id" in data).toBe(false);
    expect("organizationId" in data).toBe(false);
    expect(data.name).toBe("Acme");
  });
});
