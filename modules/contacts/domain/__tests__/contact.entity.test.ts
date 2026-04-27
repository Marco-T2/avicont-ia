import { describe, it, expect } from "vitest";
import { Contact } from "../contact.entity";
import { Nit } from "../value-objects/nit";
import { PaymentTermsDays } from "../value-objects/payment-terms-days";
import { CreditLimit } from "../value-objects/credit-limit";
import {
  InvalidContactType,
  InvalidNitFormat,
  InvalidPaymentTermsDays,
  InvalidCreditLimit,
} from "../errors/contact-errors";

const ORG = "org-1";

describe("Contact.create", () => {
  it("creates an active contact with required fields and defaults", () => {
    const c = Contact.create({
      organizationId: ORG,
      type: "CLIENTE",
      name: "Acme S.A.",
    });

    expect(c.organizationId).toBe(ORG);
    expect(c.type).toBe("CLIENTE");
    expect(c.name).toBe("Acme S.A.");
    expect(c.nit).toBeNull();
    expect(c.email).toBeNull();
    expect(c.phone).toBeNull();
    expect(c.address).toBeNull();
    expect(c.paymentTermsDays).toBe(30);
    expect(c.creditLimit).toBeNull();
    expect(c.isActive).toBe(true);
    expect(c.id).toBeTruthy();
  });

  it("accepts all optional fields", () => {
    const c = Contact.create({
      organizationId: ORG,
      type: "PROVEEDOR",
      name: "Proveedor X",
      nit: "12345678",
      email: "x@example.com",
      phone: "+591 70000000",
      address: "Calle Falsa 123",
      paymentTermsDays: 45,
      creditLimit: 1500,
    });

    expect(c.nit).toBe("12345678");
    expect(c.email).toBe("x@example.com");
    expect(c.phone).toBe("+591 70000000");
    expect(c.address).toBe("Calle Falsa 123");
    expect(c.paymentTermsDays).toBe(45);
    expect(c.creditLimit).toBe(1500);
  });

  it("trims surrounding whitespace from NIT", () => {
    const c = Contact.create({
      organizationId: ORG,
      type: "CLIENTE",
      name: "X",
      nit: "  12345  ",
    });
    expect(c.nit).toBe("12345");
  });

  it("treats empty/whitespace optional strings as null", () => {
    const c = Contact.create({
      organizationId: ORG,
      type: "CLIENTE",
      name: "X",
      email: "",
      phone: "   ",
      address: "",
    });
    expect(c.email).toBeNull();
    expect(c.phone).toBeNull();
    expect(c.address).toBeNull();
  });

  it("rejects an invalid contact type", () => {
    expect(() =>
      Contact.create({
        organizationId: ORG,
        type: "EMPLEADO" as never,
        name: "X",
      }),
    ).toThrow(InvalidContactType);
  });

  it("rejects a NIT longer than 20 chars", () => {
    expect(() =>
      Contact.create({
        organizationId: ORG,
        type: "CLIENTE",
        name: "X",
        nit: "X".repeat(21),
      }),
    ).toThrow(InvalidNitFormat);
  });

  it("rejects payment terms outside 0..365", () => {
    expect(() =>
      Contact.create({
        organizationId: ORG,
        type: "CLIENTE",
        name: "X",
        paymentTermsDays: -1,
      }),
    ).toThrow(InvalidPaymentTermsDays);
  });

  it("rejects negative credit limit", () => {
    expect(() =>
      Contact.create({
        organizationId: ORG,
        type: "CLIENTE",
        name: "X",
        creditLimit: -5,
      }),
    ).toThrow(InvalidCreditLimit);
  });
});

describe("Contact.fromPersistence", () => {
  it("rebuilds an entity from raw props", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const c = Contact.fromPersistence({
      id: "c1",
      organizationId: ORG,
      type: "CLIENTE",
      name: "Acme",
      nit: Nit.of("12345"),
      email: "a@b.com",
      phone: null,
      address: null,
      paymentTermsDays: PaymentTermsDays.of(30),
      creditLimit: CreditLimit.of(500),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    expect(c.id).toBe("c1");
    expect(c.email).toBe("a@b.com");
    expect(c.creditLimit).toBe(500);
    expect(c.createdAt).toEqual(now);
  });
});

describe("Contact.update", () => {
  const base = () =>
    Contact.create({
      organizationId: ORG,
      type: "CLIENTE",
      name: "Original",
      nit: "100",
      email: "old@x.com",
      paymentTermsDays: 30,
      creditLimit: 1000,
    });

  it("renames the contact", () => {
    const c = base().update({ name: "Renamed" });
    expect(c.name).toBe("Renamed");
    expect(c.nit).toBe("100");
  });

  it("changes the type", () => {
    const c = base().update({ type: "PROVEEDOR" });
    expect(c.type).toBe("PROVEEDOR");
  });

  it("clears NIT when null is passed explicitly", () => {
    const c = base().update({ nit: null });
    expect(c.nit).toBeNull();
  });

  it("replaces NIT when a new value is passed", () => {
    const c = base().update({ nit: "200" });
    expect(c.nit).toBe("200");
  });

  it("clears credit limit when null is passed", () => {
    const c = base().update({ creditLimit: null });
    expect(c.creditLimit).toBeNull();
  });

  it("rejects invalid update values (e.g. bad NIT)", () => {
    expect(() => base().update({ nit: "X".repeat(25) })).toThrow(InvalidNitFormat);
  });

  it("returns a new instance (immutability)", () => {
    const original = base();
    const updated = original.update({ name: "Other" });
    expect(updated).not.toBe(original);
    expect(original.name).toBe("Original");
  });
});

describe("Contact.deactivate", () => {
  it("flips isActive to false", () => {
    const c = Contact.create({ organizationId: ORG, type: "CLIENTE", name: "X" });
    expect(c.deactivate().isActive).toBe(false);
  });
});

describe("Contact.toSnapshot", () => {
  it("returns a Prisma-compatible row shape", () => {
    const c = Contact.create({
      organizationId: ORG,
      type: "CLIENTE",
      name: "Acme",
      nit: "12345",
      email: "a@b.com",
      paymentTermsDays: 45,
      creditLimit: 2500,
    });
    const snap = c.toSnapshot();
    expect(snap).toMatchObject({
      organizationId: ORG,
      type: "CLIENTE",
      name: "Acme",
      nit: "12345",
      email: "a@b.com",
      phone: null,
      address: null,
      paymentTermsDays: 45,
      creditLimit: 2500,
      isActive: true,
    });
    expect(snap.id).toBe(c.id);
    expect(snap.createdAt).toBeInstanceOf(Date);
    expect(snap.updatedAt).toBeInstanceOf(Date);
  });
});
