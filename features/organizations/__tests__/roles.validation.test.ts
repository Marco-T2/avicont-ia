/**
 * PR4.1 RED — Custom-role validation utilities (slugify + reserved + unique)
 *
 * Covers:
 *   REQ-CR.4 — Slug auto-derivation + uniqueness
 *   D.5 — Slug strategy (slugify, reserved list, collision suffix -2..-99)
 *
 * Pure functions — NO DB access in this module.
 *
 * Notes:
 *   - Reserved list = SYSTEM_ROLES (owner/admin/contador/cobrador/member).
 *     Reserved check matters on CREATE only; slug is IMMUTABLE on UPDATE (D.5).
 *   - Spec error code for collision is SLUG_TAKEN (design used SLUG_COLLISION —
 *     SPEC name wins per errors.ts naming note).
 */
import { describe, it, expect } from "vitest";
import {
  slugify,
  assertNotReserved,
  resolveUniqueSlug,
} from "../roles.validation";
import {
  RESERVED_SLUG,
  SLUG_TAKEN,
  ValidationError,
  ConflictError,
} from "@/features/shared/errors";

describe("slugify (D.5)", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Mi Rol Especial")).toBe("mi-rol-especial");
  });

  it("strips diacritics (NFKD)", () => {
    expect(slugify("Contaduría")).toBe("contaduria");
    expect(slugify("Téc. Ñandú Ángel")).toBe("tec-nandu-angel");
  });

  it("collapses multiple spaces into single hyphen", () => {
    expect(slugify("rol  con   espacios")).toBe("rol-con-espacios");
  });

  it("trims leading and trailing dashes and whitespace", () => {
    expect(slugify(" -hola- ")).toBe("hola");
    expect(slugify("---inicio")).toBe("inicio");
    expect(slugify("fin---")).toBe("fin");
  });

  it("strips non-alphanumeric characters", () => {
    expect(slugify("rol!@#$%^&*() especial")).toBe("rol-especial");
  });

  it("caps output length at 32 characters", () => {
    const name = "a".repeat(50);
    const result = slugify(name);
    expect(result.length).toBeLessThanOrEqual(32);
    expect(result).toBe("a".repeat(32));
  });

  it("does not leave trailing dash after length cap", () => {
    // e.g. "aaaa-bbbb-..." truncated exactly where the dash lands
    const result = slugify("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa bbbbbbbb"); // 32 a + space + 8 b
    expect(result.length).toBeLessThanOrEqual(32);
    expect(result.endsWith("-")).toBe(false);
  });

  it("returns empty string for input that produces only separators", () => {
    expect(slugify("---")).toBe("");
    expect(slugify("!!!")).toBe("");
  });

  it("is idempotent on an already-valid slug", () => {
    expect(slugify("facturador")).toBe("facturador");
    expect(slugify("rol-con-guiones")).toBe("rol-con-guiones");
  });
});

describe("assertNotReserved (D.5)", () => {
  const RESERVED = [
    "owner",
    "admin",
    "contador",
    "cobrador",
    "member",
  ];

  for (const slug of RESERVED) {
    it(`throws ValidationError(RESERVED_SLUG) for reserved slug "${slug}"`, () => {
      try {
        assertNotReserved(slug);
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).code).toBe(RESERVED_SLUG);
        expect((err as ValidationError).statusCode).toBe(422);
      }
    });
  }

  it("does NOT throw for a non-reserved slug", () => {
    expect(() => assertNotReserved("facturador")).not.toThrow();
    expect(() => assertNotReserved("cajero")).not.toThrow();
    expect(() => assertNotReserved("org-admin")).not.toThrow();
  });
});

describe("resolveUniqueSlug (D.5 collision)", () => {
  it("returns base when no collision", () => {
    expect(resolveUniqueSlug("facturador", new Set())).toBe("facturador");
  });

  it("appends -2 on first collision", () => {
    expect(
      resolveUniqueSlug("facturador", new Set(["facturador"])),
    ).toBe("facturador-2");
  });

  it("appends -3 when base and -2 are both taken", () => {
    expect(
      resolveUniqueSlug(
        "facturador",
        new Set(["facturador", "facturador-2"]),
      ),
    ).toBe("facturador-3");
  });

  it("keeps incrementing suffix until unique (up to -99)", () => {
    const taken = new Set<string>(["facturador"]);
    for (let i = 2; i <= 50; i++) taken.add(`facturador-${i}`);
    expect(resolveUniqueSlug("facturador", taken)).toBe("facturador-51");
  });

  it("throws ConflictError(SLUG_TAKEN) when all -2..-99 are taken", () => {
    const taken = new Set<string>(["facturador"]);
    for (let i = 2; i <= 99; i++) taken.add(`facturador-${i}`);

    try {
      resolveUniqueSlug("facturador", taken);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as ConflictError).code).toBe(SLUG_TAKEN);
      expect((err as ConflictError).statusCode).toBe(409);
    }
  });
});
