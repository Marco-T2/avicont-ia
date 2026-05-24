/**
 * Shape test — org-settings domain errors (arch 4.1 code-ownership migration).
 *
 * Guards modules/org-settings/domain/errors/org-settings-errors.ts as the
 * canonical home for org-settings-OWNED error codes. Established when the 3
 * ORG_SETTINGS_ACCOUNT_* codes migrated OUT of the shared hex registry
 * (modules/shared/domain/errors/index.ts, guarded by α9) into their owning
 * module per arch 4.1 ("module-specific codes migrate to the module's
 * domain/errors/").
 *
 * Conservation guarantee — PAIRED with α9 (c1-shape.poc-shared-errors):
 *   a code removed from the shared registry MUST appear here, or BOTH sentinels
 *   break. No code can vanish silently.
 *
 * Derived from: α9 "additive only" discipline. This is the destination half of
 * the first arch-4.1 ownership migration; α9 evolved to allow decrement-via-
 * documented-migration. Future module migrations add their OWN file-local
 * sentinel here-style, touching no existing sentinel (additive scaling).
 *
 * Count ledger (org-settings-errors.ts):
 *   2 pre-existing local codes — INVALID_ROUNDING_THRESHOLD, INVALID_ACCOUNT_CODE
 *   +3 migrated from shared (arch 4.1) — ORG_SETTINGS_ACCOUNT_{NOT_FOUND,
 *      NOT_USABLE, WRONG_PARENT}
 *   = 5 total.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../../../..");
const ERRORS_FILE = join(
  ROOT,
  "modules/org-settings/domain/errors/org-settings-errors.ts",
);

describe("org-settings-errors.ts contains 5 owned const error codes (arch 4.1)", () => {
  it("count: grep-count of ^export const [A-Z_]+ = \" === 5", () => {
    const result = execSync(
      `grep -cE '^export const [A-Z_]+ = "' "${ERRORS_FILE}"`,
      { encoding: "utf-8" },
    ).trim();
    expect(Number(result)).toBe(5);
  });

  it("defines the 3 migrated ORG_SETTINGS_ACCOUNT_* codes LOCALLY (not re-exported)", () => {
    const content = readFileSync(ERRORS_FILE, "utf-8");
    expect(content).toMatch(/^export const ORG_SETTINGS_ACCOUNT_NOT_FOUND = "/m);
    expect(content).toMatch(/^export const ORG_SETTINGS_ACCOUNT_NOT_USABLE = "/m);
    expect(content).toMatch(
      /^export const ORG_SETTINGS_ACCOUNT_WRONG_PARENT = "/m,
    );
  });

  it("no longer BORROWS ORG_SETTINGS_ACCOUNT_* via shared re-export (ownership moved)", () => {
    const content = readFileSync(ERRORS_FILE, "utf-8");
    // re-export form is a bare `  ORG_SETTINGS_ACCOUNT_NOT_FOUND,` line inside an
    // `export { ... } from` block — must be gone post-migration. Line-bound per
    // sentinel-regex discipline ([^\n] via ^...$/m, not paren-class).
    expect(content).not.toMatch(/^\s+ORG_SETTINGS_ACCOUNT_NOT_FOUND,[^\n]*$/m);
  });
});
