/**
 * T01 — RED: Type-shape test for Initial Balance domain types.
 *
 * Acceptance: imports the five types from `../initial-balance.types`
 * and uses `expectTypeOf` to assert each has the expected field shape.
 * Fails with `Cannot find module` because the types file does not exist yet.
 */

import { describe, it, expectTypeOf } from "vitest";
import type { Prisma, AccountSubtype } from "@/generated/prisma/client";
import type {
  InitialBalanceRow,
  InitialBalanceGroup,
  InitialBalanceSection,
  InitialBalanceStatement,
  BuildInitialBalanceInput,
} from "../domain/initial-balance.types";

describe("initial-balance.types — type shape", () => {
  it("InitialBalanceRow has accountId, code, name, subtype, amount fields", () => {
    expectTypeOf<InitialBalanceRow["accountId"]>().toEqualTypeOf<string>();
    expectTypeOf<InitialBalanceRow["code"]>().toEqualTypeOf<string>();
    expectTypeOf<InitialBalanceRow["name"]>().toEqualTypeOf<string>();
    expectTypeOf<InitialBalanceRow["subtype"]>().toEqualTypeOf<AccountSubtype>();
    expectTypeOf<InitialBalanceRow["amount"]>().toEqualTypeOf<Prisma.Decimal>();
  });

  it("InitialBalanceGroup has subtype, label, rows, subtotal fields", () => {
    expectTypeOf<InitialBalanceGroup["subtype"]>().toEqualTypeOf<AccountSubtype>();
    expectTypeOf<InitialBalanceGroup["label"]>().toEqualTypeOf<string>();
    expectTypeOf<InitialBalanceGroup["rows"]>().toEqualTypeOf<InitialBalanceRow[]>();
    expectTypeOf<InitialBalanceGroup["subtotal"]>().toEqualTypeOf<Prisma.Decimal>();
  });

  it("InitialBalanceSection has key, label, groups, sectionTotal fields", () => {
    expectTypeOf<InitialBalanceSection["key"]>().toEqualTypeOf<
      "ACTIVO" | "PASIVO_PATRIMONIO"
    >();
    expectTypeOf<InitialBalanceSection["label"]>().toEqualTypeOf<string>();
    expectTypeOf<InitialBalanceSection["groups"]>().toEqualTypeOf<InitialBalanceGroup[]>();
    expectTypeOf<InitialBalanceSection["sectionTotal"]>().toEqualTypeOf<Prisma.Decimal>();
  });

  it("InitialBalanceStatement has orgId, dateAt, sections, flags, caCount", () => {
    expectTypeOf<InitialBalanceStatement["orgId"]>().toEqualTypeOf<string>();
    expectTypeOf<InitialBalanceStatement["dateAt"]>().toEqualTypeOf<Date>();
    expectTypeOf<InitialBalanceStatement["sections"]>().toEqualTypeOf<
      [InitialBalanceSection, InitialBalanceSection]
    >();
    expectTypeOf<InitialBalanceStatement["imbalanced"]>().toEqualTypeOf<boolean>();
    expectTypeOf<InitialBalanceStatement["imbalanceDelta"]>().toEqualTypeOf<Prisma.Decimal>();
    expectTypeOf<InitialBalanceStatement["multipleCA"]>().toEqualTypeOf<boolean>();
    expectTypeOf<InitialBalanceStatement["caCount"]>().toEqualTypeOf<number>();
  });

  it("BuildInitialBalanceInput has rows, dateAt, caCount, orgId, org fields", () => {
    expectTypeOf<BuildInitialBalanceInput["orgId"]>().toEqualTypeOf<string>();
    expectTypeOf<BuildInitialBalanceInput["dateAt"]>().toEqualTypeOf<Date>();
    expectTypeOf<BuildInitialBalanceInput["caCount"]>().toEqualTypeOf<number>();
    expectTypeOf<BuildInitialBalanceInput["rows"]>().toEqualTypeOf<InitialBalanceRow[]>();
  });
});
