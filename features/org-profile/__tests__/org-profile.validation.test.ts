/**
 * T2.1 — OrgProfile validation tests.
 *
 * Covers REQ-OP.2 field rules:
 *   razonSocial | nit | direccion | ciudad | telefono — required non-empty, max lengths
 *   nroPatronal — optional, max 50
 *   logoUrl     — optional, valid URL
 */
import { describe, it, expect } from "vitest";
import {
  updateOrgProfileSchema,
  logoUploadConstraints,
} from "../org-profile.validation";

describe("updateOrgProfileSchema — valid inputs", () => {
  it("passes a valid partial update with only a couple of fields", () => {
    const result = updateOrgProfileSchema.safeParse({
      nit: "1234567",
      ciudad: "Sucre",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nit).toBe("1234567");
      expect(result.data.ciudad).toBe("Sucre");
    }
  });

  it("trims whitespace before persisting", () => {
    const result = updateOrgProfileSchema.safeParse({
      razonSocial: "  Empresa A  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.razonSocial).toBe("Empresa A");
    }
  });

  it("accepts empty object (partial update, nothing changing)", () => {
    const result = updateOrgProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts nroPatronal = null to clear the field", () => {
    const result = updateOrgProfileSchema.safeParse({ nroPatronal: null });
    expect(result.success).toBe(true);
  });

  it("accepts logoUrl = null to clear the logo", () => {
    const result = updateOrgProfileSchema.safeParse({ logoUrl: null });
    expect(result.success).toBe(true);
  });

  it("accepts a valid logoUrl from Vercel Blob domain", () => {
    const result = updateOrgProfileSchema.safeParse({
      logoUrl:
        "https://abc123.public.blob.vercel-storage.com/logos/org-1/logo.png",
    });
    expect(result.success).toBe(true);
  });

  it("accepts logoUrl undefined (field not present)", () => {
    const result = updateOrgProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts telefono containing / and , separators", () => {
    const result = updateOrgProfileSchema.safeParse({
      telefono: "78123456 / 77-654321, 2227777",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateOrgProfileSchema — invalid inputs", () => {
  it("rejects whitespace-only razonSocial", () => {
    const result = updateOrgProfileSchema.safeParse({ razonSocial: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("razonSocial");
    }
  });

  it("rejects empty-string nit", () => {
    const result = updateOrgProfileSchema.safeParse({ nit: "" });
    expect(result.success).toBe(false);
  });

  it("rejects direccion longer than 300 chars", () => {
    const result = updateOrgProfileSchema.safeParse({
      direccion: "x".repeat(301),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("direccion");
    }
  });

  it("rejects razonSocial longer than 200 chars", () => {
    const result = updateOrgProfileSchema.safeParse({
      razonSocial: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects ciudad longer than 100 chars", () => {
    const result = updateOrgProfileSchema.safeParse({
      ciudad: "c".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects nit longer than 50 chars", () => {
    const result = updateOrgProfileSchema.safeParse({ nit: "n".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("rejects telefono longer than 100 chars", () => {
    const result = updateOrgProfileSchema.safeParse({
      telefono: "1".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects nroPatronal longer than 50 chars", () => {
    const result = updateOrgProfileSchema.safeParse({
      nroPatronal: "p".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("rejects logoUrl = 'not-a-url'", () => {
    const result = updateOrgProfileSchema.safeParse({ logoUrl: "not-a-url" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("logoUrl");
    }
  });

  it("rejects logoUrl from an arbitrary https domain (not Vercel Blob)", () => {
    const result = updateOrgProfileSchema.safeParse({
      logoUrl: "https://evil.com/logo.png",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("logoUrl");
    }
  });

  it("rejects logoUrl from an http (non-https) Vercel-like URL", () => {
    const result = updateOrgProfileSchema.safeParse({
      logoUrl:
        "http://abc123.public.blob.vercel-storage.com/logos/logo.png",
    });
    expect(result.success).toBe(false);
  });
});

describe("logoUploadConstraints", () => {
  it("exposes a 2 MB max byte limit", () => {
    expect(logoUploadConstraints.maxBytes).toBe(2 * 1024 * 1024);
  });

  it("allows png, jpeg, webp, and svg+xml MIME types", () => {
    expect(logoUploadConstraints.allowedMimes).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ]);
  });
});
