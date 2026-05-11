import { describe, it, expect } from "vitest";
import type { OrgProfile as PrismaOrgProfile } from "@/generated/prisma/client";
import { toDomain, toPersistence } from "../org-profile.mapper";
import { OrgProfile } from "../../domain/org-profile.entity";

const row = (
  override: Partial<PrismaOrgProfile> = {},
): PrismaOrgProfile => ({
  id: "op-1",
  organizationId: "org-1",
  razonSocial: "Empresa A",
  nit: "123456",
  direccion: "Calle 1",
  ciudad: "Sucre",
  telefono: "78123456",
  representanteLegal: "Juan Perez",
  nroPatronal: "NRP-1",
  logoUrl: "https://blob.example.com/logo.png",
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
  ...override,
});

describe("org-profile mapper", () => {
  describe("toDomain()", () => {
    // α17
    it("hydrates an OrgProfile entity from a Prisma row", () => {
      const d = toDomain(row());
      expect(d).toBeInstanceOf(OrgProfile);
      expect(d.id).toBe("op-1");
      expect(d.organizationId).toBe("org-1");
      expect(d.razonSocial).toBe("Empresa A");
    });

    // α18
    it("preserves nullable fields (nroPatronal, logoUrl)", () => {
      const d = toDomain(row({ nroPatronal: null, logoUrl: null }));
      expect(d.nroPatronal).toBeNull();
      expect(d.logoUrl).toBeNull();
    });

    // α19
    it("preserves all string fields", () => {
      const d = toDomain(row());
      expect(d.nit).toBe("123456");
      expect(d.direccion).toBe("Calle 1");
      expect(d.ciudad).toBe("Sucre");
      expect(d.telefono).toBe("78123456");
      expect(d.representanteLegal).toBe("Juan Perez");
    });
  });

  describe("toPersistence()", () => {
    const buildEntity = () => OrgProfile.create("org-1");

    // α20
    it("returns a Prisma persistence payload", () => {
      const entity = buildEntity();
      const data = toPersistence(entity);
      expect(data.id).toBe(entity.id);
      expect(data.organizationId).toBe("org-1");
      expect(data.razonSocial).toBe("");
      expect(data.logoUrl).toBeNull();
    });

    // α21
    it("preserves createdAt + updatedAt timestamps", () => {
      const entity = buildEntity();
      const data = toPersistence(entity);
      expect(data.createdAt).toBeInstanceOf(Date);
      expect(data.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("roundtrip", () => {
    // α22
    it("toPersistence(toDomain(row)) yields equivalent payload", () => {
      const original = row();
      const entity = toDomain(original);
      const data = toPersistence(entity);
      expect(data.id).toBe(original.id);
      expect(data.organizationId).toBe(original.organizationId);
      expect(data.razonSocial).toBe(original.razonSocial);
      expect(data.nit).toBe(original.nit);
      expect(data.logoUrl).toBe(original.logoUrl);
      expect(data.createdAt.getTime()).toBe(original.createdAt.getTime());
    });
  });
});
