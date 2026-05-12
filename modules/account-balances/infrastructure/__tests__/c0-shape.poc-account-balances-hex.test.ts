/**
 * RED test — poc-account-balances-hex: structural shape assertions C0.
 *
 * 14α declarations. Expected failure mode pre-GREEN:
 *   FAIL (13α): hex files non-existent OR SHIM pre-rewrite
 *   - α1  FAIL: modules/account-balances/application/account-balances.service.ts non-existent
 *   - α2  FAIL: modules/account-balances/infrastructure/account-balances.repository.ts non-existent
 *   - α3  FAIL: features/account-balances/server.ts content pre-rewrite (original barrel)
 *   - α4  PASS (lock-only honest): features/account-balances/server.ts already has `import "server-only"` pre-GREEN
 *          Justification: preservation sentinel — asserts server-only is NOT LOST during SHIM rewrite,
 *          not a shape sentinel. Pre-existing line 1 makes this PASS before any file creation.
 *   - α5  FAIL: hex account-balances.service non-existent → readFileSync throws
 *   - α6  FAIL: hex account-balances.service non-existent → readFileSync throws
 *   - α7  FAIL: hex account-balances.repository non-existent → readFileSync throws
 *   - α8  FAIL: hex account-balances.repository non-existent → readFileSync throws
 *   - α9  FAIL: hex account-balances.service non-existent → readFileSync throws
 *   - α10 FAIL: features/account-balances/account-balances.service.ts still exists pre-GREEN
 *   - α11 FAIL: features/account-balances/account-balances.repository.ts still exists pre-GREEN
 *   - α12 FAIL: hex account-balances.service non-existent → readFileSync throws
 *   - α13 FAIL: hex account-balances.repository non-existent → readFileSync throws
 *   - α14 FAIL: features/account-balances/account-balances.types.ts still exists pre-GREEN
 *
 * Gate: run pre-GREEN → 13/14α FAIL + 1/14α PASS (α4 lock-only) before C1 GREEN.
 *
 * Paired sister: poc-users-hex — SHA 6b41ce09
 *   modules/users/infrastructure/__tests__/c0-shape.poc-users-hex.test.ts
 * [[paired_sister_default_no_surface]] — applied EXACT mirror with declared divergences:
 *   - 14α same count — surface: account-balances adds α6 (JournalEntryWithLines DIRECT, REQ-004)
 *     replaces sister α7 (CreateUserInput optional field) — different REQ-004 content, same slot count
 *   - α4 lock-only PASS-pre-GREEN per [[red_acceptance_failure_mode]] (sister α4 same shape)
 *   - 5-file C1 atomic vs sister 3-file (declared divergence #1)
 *   - +1 types file (account-balances.types.ts) vs sister (no types file)
 * [[red_regex_discipline]] — `^...$m` anchors for all import statements, optional `\?` in type props.
 * [[canonical_rule_application_commit_body]] — REQ-004 cited in C1 commit body (not this RED commit).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../../..");
const HEX_SERVICE = join(
  ROOT,
  "modules/account-balances/application/account-balances.service.ts",
);
const HEX_REPOSITORY = join(
  ROOT,
  "modules/account-balances/infrastructure/account-balances.repository.ts",
);
const SHIM_SERVER = join(ROOT, "features/account-balances/server.ts");
const LEGACY_SERVICE = join(
  ROOT,
  "features/account-balances/account-balances.service.ts",
);
const LEGACY_REPOSITORY = join(
  ROOT,
  "features/account-balances/account-balances.repository.ts",
);
const LEGACY_TYPES = join(
  ROOT,
  "features/account-balances/account-balances.types.ts",
);

// ── α1: hex account-balances.service existence ───────────────────────────────

describe("α1 hex account-balances.service exists", () => {
  it("α1: modules/account-balances/application/account-balances.service.ts exists", () => {
    expect(existsSync(HEX_SERVICE)).toBe(true);
  });
});

// ── α2: hex account-balances.repository existence ────────────────────────────

describe("α2 hex account-balances.repository exists", () => {
  it("α2: modules/account-balances/infrastructure/account-balances.repository.ts exists", () => {
    expect(existsSync(HEX_REPOSITORY)).toBe(true);
  });
});

// ── α3–α4: SHIM features/account-balances/server.ts content sentinels ────────

describe("α3–α4 SHIM features/account-balances/server.ts content sentinels", () => {
  it("α3: SHIM is Option A static named re-export from canonical hex path", () => {
    const content = readFileSync(SHIM_SERVER, "utf-8");
    expect(content).toMatch(
      /^export \{ AccountBalancesService \} from "@\/modules\/account-balances\/application\/account-balances\.service";$/m,
    );
  });

  it("α4: SHIM preserves `import \"server-only\"` (lock-only — PASS pre-GREEN by design)", () => {
    const content = readFileSync(SHIM_SERVER, "utf-8");
    expect(content).toMatch(/^import ['"]server-only['"];?$/m);
  });
});

// ── α5–α6: hex account-balances.service content sentinels ────────────────────

describe("α5 hex account-balances.service exports AccountBalancesService", () => {
  it("α5: hex account-balances.service.ts exports `class AccountBalancesService`", () => {
    const content = readFileSync(HEX_SERVICE, "utf-8");
    expect(content).toMatch(/^export.*class AccountBalancesService\b/m);
  });
});

describe("α6 hex account-balances.service imports JournalEntryWithLines from canonical (REQ-004)", () => {
  it("α6: hex account-balances.service.ts imports JournalEntryWithLines from `@/modules/accounting/presentation/dto/journal.types` DIRECT", () => {
    const content = readFileSync(HEX_SERVICE, "utf-8");
    expect(content).toMatch(
      /^import.*from ['"]@\/modules\/accounting\/presentation\/dto\/journal\.types['"];?$/m,
    );
    expect(content).not.toMatch(/from ['"]@\/features\/accounting\/server/);
  });
});

// ── α7–α8: hex account-balances.repository content sentinels ─────────────────

describe("α7 hex account-balances.repository exports AccountBalancesRepository", () => {
  it("α7: hex account-balances.repository.ts exports `class AccountBalancesRepository`", () => {
    const content = readFileSync(HEX_REPOSITORY, "utf-8");
    expect(content).toMatch(/^export.*class AccountBalancesRepository\b/m);
  });
});

describe("α8 hex account-balances.repository imports BaseRepository from modules/shared directly (REQ-004)", () => {
  it("α8: hex account-balances.repository.ts imports BaseRepository from `@/modules/shared/infrastructure/base.repository` (direct, NOT features/shared)", () => {
    const content = readFileSync(HEX_REPOSITORY, "utf-8");
    expect(content).toMatch(
      /^import \{ BaseRepository \} from "@\/modules\/shared\/infrastructure\/base\.repository";$/m,
    );
    expect(content).not.toMatch(/from ['"]@\/features\/shared/);
  });
});

// ── α9: hex account-balances.service imports repo from canonical sibling path ─

describe("α9 hex account-balances.service imports repo from canonical sibling path", () => {
  it("α9: hex account-balances.service.ts imports AccountBalancesRepository from canonical absolute OR relative sibling path", () => {
    const content = readFileSync(HEX_SERVICE, "utf-8");
    const canonicalAbsolute =
      /^import.*from ['"]@\/modules\/account-balances\/infrastructure\/account-balances\.repository['"];?$/m;
    const relativeSibling =
      /^import.*from ['"]\.\/\.\.\/infrastructure\/account-balances\.repository['"];?$/m;
    expect(
      canonicalAbsolute.test(content) || relativeSibling.test(content),
    ).toBe(true);
  });
});

// ── α10–α11: legacy paths must NOT exist post-relocation ─────────────────────

describe("α10–α11 legacy features/account-balances/ files removed", () => {
  it("α10: features/account-balances/account-balances.service.ts does NOT exist", () => {
    expect(existsSync(LEGACY_SERVICE)).toBe(false);
  });

  it("α11: features/account-balances/account-balances.repository.ts does NOT exist", () => {
    expect(existsSync(LEGACY_REPOSITORY)).toBe(false);
  });
});

// ── α12–α13: server-only directive preservation on canonical files ───────────

describe("α12–α13 canonical files preserve `import \"server-only\"`", () => {
  it("α12: hex account-balances.service.ts has `import \"server-only\"`", () => {
    const content = readFileSync(HEX_SERVICE, "utf-8");
    expect(content).toMatch(/^import ['"]server-only['"];?$/m);
  });

  it("α13: hex account-balances.repository.ts has `import \"server-only\"`", () => {
    const content = readFileSync(HEX_REPOSITORY, "utf-8");
    expect(content).toMatch(/^import ['"]server-only['"];?$/m);
  });
});

// ── α14: legacy types file removed ───────────────────────────────────────────

describe("α14 legacy account-balances.types.ts removed", () => {
  it("α14: features/account-balances/account-balances.types.ts does NOT exist", () => {
    expect(existsSync(LEGACY_TYPES)).toBe(false);
  });
});
