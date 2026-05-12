/**
 * RED test: poc-accounting-types-to-hex
 *
 * Declared failure mode:
 *   - α01–α12: FAIL pre-GREEN (12/15) — dto/ files not yet created, features files still have definitions, barrel not yet extended/reconciled
 *   - α13–α15: PASS pre-GREEN (3/15) — existing barrel lines preserved throughout
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PRESENTATION_ROOT = resolve(__dirname, "..");
const FEATURES_ACCOUNTING = resolve(
  __dirname,
  "../../../../features/accounting",
);

function readPresentation(rel: string): string {
  return readFileSync(resolve(PRESENTATION_ROOT, rel), "utf-8");
}

function readFeatures(rel: string): string {
  return readFileSync(resolve(FEATURES_ACCOUNTING, rel), "utf-8");
}

describe("poc-accounting-types-to-hex — DTO shape + SHIM + barrel assertions", () => {
  // ── α01–α03: dto/ files exist ──

  // α01
  it("α01: dto/journal.types.ts exists", () => {
    expect(
      existsSync(resolve(PRESENTATION_ROOT, "dto/journal.types.ts")),
    ).toBe(true);
  });

  // α02
  it("α02: dto/accounts.types.ts exists", () => {
    expect(
      existsSync(resolve(PRESENTATION_ROOT, "dto/accounts.types.ts")),
    ).toBe(true);
  });

  // α03
  it("α03: dto/ledger.types.ts exists", () => {
    expect(
      existsSync(resolve(PRESENTATION_ROOT, "dto/ledger.types.ts")),
    ).toBe(true);
  });

  // ── α04–α05: dto/journal.types.ts content ──

  // α04: contains canonical journal type exports
  it("α04: dto/journal.types.ts exports CreateJournalEntryInput AND JournalLineInput", () => {
    const src = readPresentation("dto/journal.types.ts");
    expect(src).toMatch(/\bCreateJournalEntryInput\b/);
    expect(src).toMatch(/\bJournalLineInput\b/);
  });

  // α05: does NOT contain import "server-only"
  it('α05: dto/journal.types.ts does NOT contain import "server-only"', () => {
    const src = readPresentation("dto/journal.types.ts");
    expect(src).not.toMatch(/import\s+["']server-only["']/);
  });

  // ── α06–α08: features shim content ──

  // α06: features/accounting/journal.types.ts is shim pointing to dto/
  it("α06: features/accounting/journal.types.ts is shim → dto/journal.types", () => {
    const src = readFeatures("journal.types.ts");
    expect(src).toMatch(
      /^export type \* from ["']@\/modules\/accounting\/presentation\/dto\/journal\.types["'];?$/m,
    );
  });

  // α07: features/accounting/accounts.types.ts is shim pointing to dto/
  it("α07: features/accounting/accounts.types.ts is shim → dto/accounts.types", () => {
    const src = readFeatures("accounts.types.ts");
    expect(src).toMatch(
      /^export type \* from ["']@\/modules\/accounting\/presentation\/dto\/accounts\.types["'];?$/m,
    );
  });

  // α08: features/accounting/ledger.types.ts is shim pointing to dto/
  it("α08: features/accounting/ledger.types.ts is shim → dto/ledger.types", () => {
    const src = readFeatures("ledger.types.ts");
    expect(src).toMatch(
      /^export type \* from ["']@\/modules\/accounting\/presentation\/dto\/ledger\.types["'];?$/m,
    );
  });

  // ── α09: features shim does NOT contain inline interface definitions ──

  // α09: features/accounting/journal.types.ts does NOT contain export interface CreateJournalEntryInput
  it("α09: features/accounting/journal.types.ts has NO inline CreateJournalEntryInput definition", () => {
    const src = readFeatures("journal.types.ts");
    expect(src).not.toMatch(/export interface CreateJournalEntryInput/);
  });

  // ── α10–α12: barrel (server.ts) additions + OQ-1 resolution ──

  // α10: barrel contains export type * from ./dto/journal.types
  it("α10: barrel (server.ts) contains export type * from ./dto/journal.types", () => {
    const src = readPresentation("server.ts");
    expect(src).toMatch(
      /^export type \* from ["']\.\/dto\/journal\.types["'];?$/m,
    );
  });

  // α11: barrel does NOT contain the OQ-1 collision line (CreateJournalEntryInput from journals.service)
  it("α11: barrel does NOT contain export type { CreateJournalEntryInput } from journals.service", () => {
    const src = readPresentation("server.ts");
    expect(src).not.toMatch(
      /^export type \{\s*CreateJournalEntryInput\s*\} from ["']\.\.\/application\/journals\.service["'];?$/m,
    );
  });

  // α12: barrel does NOT contain the OQ-1 collision line (UpdateJournalEntryInput from journals.service)
  it("α12: barrel does NOT contain export type { UpdateJournalEntryInput } from journals.service", () => {
    const src = readPresentation("server.ts");
    expect(src).not.toMatch(
      /^export type \{\s*UpdateJournalEntryInput\s*\} from ["']\.\.\/application\/journals\.service["'];?$/m,
    );
  });

  // ── α13–α15: preserved existing barrel lines (PASS pre-GREEN) ──

  // α13: barrel STILL exports AuditUserContext from journals.service
  it("α13: barrel STILL contains export type { AuditUserContext } from journals.service", () => {
    const src = readPresentation("server.ts");
    expect(src).toMatch(
      /^export type \{\s*AuditUserContext\s*\} from ["']\.\.\/application\/journals\.service["'];?$/m,
    );
  });

  // α14: barrel STILL exports JournalsService (value export)
  it("α14: barrel STILL contains export { JournalsService } from journals.service", () => {
    const src = readPresentation("server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bJournalsService\b[^}]*\}\s*from\s*["']\.\.\/application\/journals\.service["'];?$/m,
    );
  });

  // α15: barrel STILL exports makeJournalsService from ./composition-root
  it("α15: barrel STILL contains export { makeJournalsService } from ./composition-root", () => {
    const src = readPresentation("server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bmakeJournalsService\b[^}]*\}\s*from\s*["']\.\/composition-root["'];?$/m,
    );
  });
});
