import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ACCOUNTING_ROOT = resolve(__dirname, "../..");
const IVA_BOOKS_ROOT = resolve(__dirname, "../../../iva-books/presentation");

function readAccountingFile(rel: string): string {
  return readFileSync(resolve(ACCOUNTING_ROOT, rel), "utf-8");
}

function readIvaBooksFile(rel: string): string {
  return readFileSync(resolve(IVA_BOOKS_ROOT, rel), "utf-8");
}

describe("poc-hex-public-barrels — presentation/server.ts shape (existence-only regex)", () => {
  // α01 — accounting server.ts exists
  it("accounting: server.ts file exists", () => {
    const src = readAccountingFile("presentation/server.ts");
    expect(src).toBeDefined();
  });

  // α02 — accounting server.ts line 1 = import "server-only";
  it('accounting: server.ts line 1 is exactly import "server-only";', () => {
    const src = readAccountingFile("presentation/server.ts");
    expect(src).toMatch(/^import "server-only";$/m);
    expect(src.split("\n")[0]).toBe('import "server-only";');
  });

  // α03 — accounting server.ts exports makeJournalsService from ./composition-root
  it("accounting: server.ts exports makeJournalsService from ./composition-root", () => {
    const src = readAccountingFile("presentation/server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bmakeJournalsService\b[^}]*\}\s*from\s*["']\.\/composition-root["']/m,
    );
  });

  // α04 — accounting server.ts exports JournalsService from ../application/journals.service
  it("accounting: server.ts exports JournalsService from ../application/journals.service", () => {
    const src = readAccountingFile("presentation/server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bJournalsService\b[^}]*\}\s*from\s*["']\.\.\/application\/journals\.service["']/m,
    );
  });

  // α05 — iva-books server.ts exists
  it("iva-books: server.ts file exists", () => {
    const src = readIvaBooksFile("server.ts");
    expect(src).toBeDefined();
  });

  // α06 — iva-books server.ts line 1 = import "server-only";
  it('iva-books: server.ts line 1 is exactly import "server-only";', () => {
    const src = readIvaBooksFile("server.ts");
    expect(src).toMatch(/^import "server-only";$/m);
    expect(src.split("\n")[0]).toBe('import "server-only";');
  });

  // α07 — iva-books server.ts exports makeIvaBookService + makeIvaScopeFactory from ./composition-root
  it("iva-books: server.ts exports makeIvaBookService + makeIvaScopeFactory from ./composition-root", () => {
    const src = readIvaBooksFile("server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bmakeIvaBookService\b[^}]*\}\s*from\s*["']\.\/composition-root["']/m,
    );
    expect(src).toMatch(/\bmakeIvaScopeFactory\b/);
  });

  // α08 — iva-books server.ts exports IvaBookService from ../application/iva-book.service
  it("iva-books: server.ts exports IvaBookService from ../application/iva-book.service", () => {
    const src = readIvaBooksFile("server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bIvaBookService\b[^}]*\}\s*from\s*["']\.\.\/application\/iva-book\.service["']/m,
    );
  });
});
