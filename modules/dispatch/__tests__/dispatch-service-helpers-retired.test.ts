/**
 * T4.4b + T5.3 combined — REQ-DISPLAY-2 + REQ-DISPLAY-3:
 *
 * T4.4b: dispatch.service.ts L62 inline `function getDisplayCode` deleted
 *   wholesale (Group E hidden drift). The infra file already retired in
 *   T4.4a — this deletes the in-file duplicate.
 *
 * T5.3: dispatch.service.ts L367 + L630 journalDescription templates strip
 *   the `${displayCode} - ` prefix (FUTURE-only generation per Q2).
 *   Notes-suffix `| ${notes}` pattern preserved.
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   grep `function getDisplayCode|const displayCode = getDisplayCode|
 *   \\$\\{displayCode\\} - ` in the service file returns ZERO; today all
 *   three are present at L62, L367, L630.
 *
 * Combined commit per amended bookmark — splitting causes mid-commit RED
 * because journalDescription template strips depend on the displayCode
 * variable being gone.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..");
const SERVICE = resolve(ROOT, "modules/dispatch/application/dispatch.service.ts");

describe("T4.4b + T5.3 — dispatch.service inline helper + journalDescription strip", () => {
  it("dispatch.service.ts does NOT declare inline function getDisplayCode", () => {
    const src = readFileSync(SERVICE, "utf8");
    expect(src).not.toMatch(/function\s+getDisplayCode\s*\(/);
  });

  it("dispatch.service.ts does NOT construct displayCode locals", () => {
    const src = readFileSync(SERVICE, "utf8");
    expect(src).not.toMatch(/const\s+displayCode\s*=\s*getDisplayCode\s*\(/);
  });

  it("dispatch.service.ts journalDescription templates do NOT prepend ${displayCode} - prefix", () => {
    const src = readFileSync(SERVICE, "utf8");
    // T5.3 — REQ-DISPLAY-3 FUTURE-only: templates strip prefix; only
    // `${description}` or `${description} | ${notes}` remains.
    expect(src).not.toMatch(/\$\{displayCode\}\s*-\s*\$\{/);
  });
});
