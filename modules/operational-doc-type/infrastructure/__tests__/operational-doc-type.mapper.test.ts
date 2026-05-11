import { describe, it, expect } from "vitest";
import type { OperationalDocType as PrismaOperationalDocType } from "@/generated/prisma/client";
import { toDomain, toPersistence } from "../operational-doc-type.mapper";
import { OperationalDocType } from "../../domain/operational-doc-type.entity";

const row = (
  override: Partial<PrismaOperationalDocType> = {},
): PrismaOperationalDocType => ({
  id: "odt-1",
  organizationId: "org-1",
  code: "FACT-A",
  name: "Factura A",
  direction: "PAGO",
  isActive: true,
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
  ...override,
});

describe("operational-doc-type mapper", () => {
  describe("toDomain()", () => {
    // α22
    it("hydrates an OperationalDocType from a Prisma row", () => {
      const d = toDomain(row());
      expect(d).toBeInstanceOf(OperationalDocType);
      expect(d.id).toBe("odt-1");
      expect(d.organizationId).toBe("org-1");
    });

    // α23
    it("preserves direction enum (Prisma OperationalDocDirection → domain OperationalDocDirection)", () => {
      const cobro = toDomain(row({ direction: "COBRO" }));
      const pago = toDomain(row({ direction: "PAGO" }));
      const both = toDomain(row({ direction: "BOTH" }));
      expect(cobro.direction).toBe("COBRO");
      expect(pago.direction).toBe("PAGO");
      expect(both.direction).toBe("BOTH");
    });

    // α24
    it("preserves isActive boolean", () => {
      const active = toDomain(row({ isActive: true }));
      const inactive = toDomain(row({ isActive: false }));
      expect(active.isActive).toBe(true);
      expect(inactive.isActive).toBe(false);
    });
  });

  describe("toPersistence()", () => {
    const buildEntity = () =>
      OperationalDocType.create({
        organizationId: "org-1",
        code: "REM-X",
        name: "Remisión X",
        direction: "COBRO",
      });

    // α25
    it("returns a Prisma create payload", () => {
      const entity = buildEntity();
      const data = toPersistence(entity);
      expect(data.id).toBe(entity.id);
      expect(data.code).toBe("REM-X");
      expect(data.organizationId).toBe("org-1");
      expect(data.direction).toBe("COBRO");
    });

    // α26
    it("preserves createdAt + updatedAt timestamps", () => {
      const entity = buildEntity();
      const data = toPersistence(entity);
      expect(data.createdAt).toBeInstanceOf(Date);
      expect(data.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("roundtrip", () => {
    // α27
    it("toPersistence(toDomain(row)) yields equivalent payload", () => {
      const original = row();
      const entity = toDomain(original);
      const data = toPersistence(entity);
      expect(data.id).toBe(original.id);
      expect(data.code).toBe(original.code);
      expect(data.organizationId).toBe(original.organizationId);
      expect(data.direction).toBe(original.direction);
      expect(data.createdAt.getTime()).toBe(original.createdAt.getTime());
    });
  });
});
