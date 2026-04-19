/**
 * T1.1 — Migration smoke test for organization-profile change.
 *
 * Asserts that after running `prisma migrate dev`, the following
 * Postgres objects exist:
 *   - enum SignatureLabel (7 values)
 *   - enum DocumentPrintType (8 values)
 *   - table org_profile
 *   - table document_signature_config
 *
 * This test touches the real DB via raw SQL against pg_catalog. No rows
 * are inserted or deleted — it's read-only schema introspection.
 *
 * Covers: REQ-OP.1, REQ-OP.4
 */
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

async function enumValues(enumName: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
    `SELECT e.enumlabel
     FROM pg_type t
     JOIN pg_enum e ON t.oid = e.enumtypid
     WHERE t.typname = $1
     ORDER BY e.enumsortorder`,
    enumName,
  );
  return rows.map((r) => r.enumlabel);
}

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    tableName,
  );
  return rows[0]?.exists === true;
}

describe("Migration smoke — organization-profile", () => {
  it("SignatureLabel enum exists with the 7 expected values", async () => {
    const values = await enumValues("SignatureLabel");
    expect(values).toEqual([
      "ELABORADO",
      "APROBADO",
      "VISTO_BUENO",
      "PROPIETARIO",
      "REVISADO",
      "REGISTRADO",
      "CONTABILIZADO",
    ]);
  });

  it("DocumentPrintType enum exists with the 8 expected values", async () => {
    const values = await enumValues("DocumentPrintType");
    expect(values).toEqual([
      "BALANCE_GENERAL",
      "ESTADO_RESULTADOS",
      "COMPROBANTE",
      "DESPACHO",
      "VENTA",
      "COMPRA",
      "COBRO",
      "PAGO",
    ]);
  });

  it("org_profile table exists", async () => {
    expect(await tableExists("org_profile")).toBe(true);
  });

  it("document_signature_config table exists", async () => {
    expect(await tableExists("document_signature_config")).toBe(true);
  });
});
