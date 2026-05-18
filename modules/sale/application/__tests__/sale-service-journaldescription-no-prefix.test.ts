/**
 * T5.1 — REQ-DISPLAY-3: sale.service.ts journalDescription generation
 * FUTURE-only — NO `${displayCode} - ` prefix in any new entry.
 *
 * 4 enumerated call sites: post() L314-317, update() L598-601,
 * confirm()-flow L771-774, getReconciliation() L1046-1049.
 *
 * Q2 (locked): NO migration of historical entries; commit chronology
 * serves as implicit marker.
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   grep `const displayCode = .VG-.*padStart\|.\\$\\{displayCode\\} - .`
 *   returns ZERO; today both exist at the 4 sites.
 *
 * GREEN: drop local `const displayCode = ...` lines + change template
 *   from `${displayCode} - ${description}` to `description` (or
 *   `${description} | ${notes}` where notes present). Preserve
 *   notes-suffix `|` pattern.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..");
const SERVICE = resolve(ROOT, "modules/sale/application/sale.service.ts");

describe("T5.1 — sale.service journalDescription FUTURE-only (REQ-DISPLAY-3)", () => {
  it("sale.service.ts does NOT construct local displayCode VG-NNN", () => {
    const src = readFileSync(SERVICE, "utf8");
    expect(src).not.toMatch(/const\s+displayCode\s*=\s*`VG-\$\{[^`]*padStart/);
  });

  it("sale.service.ts journalDescription templates do NOT prepend ${displayCode} - prefix", () => {
    const src = readFileSync(SERVICE, "utf8");
    expect(src).not.toMatch(/\$\{displayCode\}\s*-\s*\$\{/);
  });
});
