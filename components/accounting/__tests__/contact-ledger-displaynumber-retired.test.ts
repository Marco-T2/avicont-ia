/**
 * T2.2 — REQ-DISPLAY-2 sentinel: contact-ledger consumers must NOT
 * reference `entry.displayNumber`. After T2.1, the canonical
 * `LedgerEntry`/`ContactLedgerEntry` DTO drops the field; the consumers
 * pivot to `entry.entryNumber` (raw) as fallback when
 * `documentReferenceNumber` is null.
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   `expect(src).not.toMatch(/entry\.displayNumber/)` FAILS on
 *   contact-ledger-page-client.tsx L551 + contact-ledger-xlsx.exporter.ts
 *   L356. (contact-ledger-pdf.exporter.ts was bridged in T2.1 commit; this
 *   sentinel additionally locks it in.)
 *
 * GREEN: switch all three consumers to
 *   `entry.documentReferenceNumber ?? String(entry.entryNumber)`. Drop
 *   `displayNumber` from the shadow `ContactLedgerEntry` interface in
 *   contact-ledger-page-client.tsx + drop the JSDoc fallback note.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..");

const FILES = [
  "components/accounting/contact-ledger-page-client.tsx",
  "modules/accounting/infrastructure/exporters/contact-ledger/contact-ledger-pdf.exporter.ts",
  "modules/accounting/infrastructure/exporters/contact-ledger/contact-ledger-xlsx.exporter.ts",
];

describe("T2.2 — contact-ledger displayNumber retirement (REQ-DISPLAY-2)", () => {
  for (const rel of FILES) {
    it(`${rel} does NOT reference entry.displayNumber`, () => {
      const src = readFileSync(resolve(ROOT, rel), "utf8");
      expect(src).not.toMatch(/entry\.displayNumber/);
    });
  }
});
