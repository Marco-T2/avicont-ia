/**
 * T5.2 — REQ-DISPLAY-3: purchase.service.ts journalDescription generation
 * FUTURE-only — NO `${displayCode} - ` prefix in any new entry.
 *
 * 4 enumerated call sites: post() L368-371, update() L538-541,
 * confirm()-flow L868-871, getReconciliation() L1205-1208.
 *
 * Also retires the local `TYPE_PREFIXES` const at L52 (in-file helper
 * per REQ-DISPLAY-2) — was only used by the journalDescription templates.
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   grep `const TYPE_PREFIXES|const displayCode = .\\$\\{TYPE_PREFIXES|
 *   .\\$\\{displayCode\\} - .` returns ZERO; today all three present.
 *
 * GREEN: drop local `const TYPE_PREFIXES` + 4 `const displayCode = ...`
 *   lines + change templates from `${displayCode} - ${description}` to
 *   `description` (or `${description} | ${notes}`). Preserve notes-suffix.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..");
const SERVICE = resolve(ROOT, "modules/purchase/application/purchase.service.ts");

describe("T5.2 — purchase.service journalDescription FUTURE-only (REQ-DISPLAY-3)", () => {
  it("purchase.service.ts does NOT declare local TYPE_PREFIXES const", () => {
    const src = readFileSync(SERVICE, "utf8");
    expect(src).not.toMatch(/const\s+TYPE_PREFIXES\b/);
  });

  it("purchase.service.ts does NOT construct local displayCode from TYPE_PREFIXES", () => {
    const src = readFileSync(SERVICE, "utf8");
    expect(src).not.toMatch(/const\s+displayCode\s*=\s*`\$\{TYPE_PREFIXES/);
  });

  it("purchase.service.ts journalDescription templates do NOT prepend ${displayCode} - prefix", () => {
    const src = readFileSync(SERVICE, "utf8");
    expect(src).not.toMatch(/\$\{displayCode\}\s*-\s*\$\{/);
  });
});
