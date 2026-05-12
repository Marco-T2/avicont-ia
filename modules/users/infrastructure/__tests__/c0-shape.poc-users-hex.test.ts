/**
 * RED test — poc-users-hex: structural shape assertions C0.
 *
 * 14α declarations. Expected failure mode pre-GREEN:
 *   FAIL (13α): hex files non-existent OR SHIM pre-rewrite
 *   - α1  FAIL: modules/users/application/users.service.ts non-existent
 *   - α2  FAIL: modules/users/infrastructure/users.repository.ts non-existent
 *   - α3  FAIL: features/users/server.ts content pre-rewrite (still `from "./users.service"`)
 *   - α4  PASS (lock-only honest): features/users/server.ts already has `import "server-only"` pre-GREEN
 *   - α5  FAIL: hex users.service non-existent → readFileSync throws
 *   - α6  FAIL: hex users.repository non-existent → readFileSync throws
 *   - α7  FAIL: hex users.repository non-existent → readFileSync throws
 *   - α8  FAIL: hex users.repository non-existent → readFileSync throws
 *   - α9  FAIL: features/users/users.service.ts still exists pre-GREEN
 *   - α10 FAIL: features/users/users.repository.ts still exists pre-GREEN
 *   - α11 FAIL: hex users.service non-existent → readFileSync throws
 *   - α12 FAIL: hex users.repository non-existent → readFileSync throws
 *   - α13 FAIL: hex users.service non-existent → readFileSync throws
 *   - α14 FAIL: hex users.service non-existent → readFileSync throws
 *
 * Gate: run pre-GREEN → 13/14α FAIL + 1/14α PASS (α4 lock-only) before C1 GREEN.
 *
 * Paired sister: poc-shared-base-repo — SHA 5517966d
 *   modules/shared/infrastructure/__tests__/c1-shape.poc-shared-base-repo.test.ts
 * [[paired_sister_default_no_surface]] — applied EXACT mirror with declared divergences:
 *   - 14α (vs sister 17α) — smaller surface, 2 canonical files only
 *   - α4 lock-only PASS-pre-GREEN per [[red_acceptance_failure_mode]] (sister α7 same shape)
 *   - SHIM uses named re-export `export { UsersService }` + preserves `import "server-only"`
 * [[red_regex_discipline]] — `^...$m` anchors for import statements, `\?` for optional type props.
 * [[engram_textual_rule_verification]] — NotFoundError verified at modules/shared/domain/errors/index.ts:20.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../../..");
const HEX_USERS_SERVICE = join(
  ROOT,
  "modules/users/application/users.service.ts",
);
const HEX_USERS_REPOSITORY = join(
  ROOT,
  "modules/users/infrastructure/users.repository.ts",
);
const SHIM_USERS_SERVER = join(ROOT, "features/users/server.ts");
const LEGACY_USERS_SERVICE = join(ROOT, "features/users/users.service.ts");
const LEGACY_USERS_REPOSITORY = join(
  ROOT,
  "features/users/users.repository.ts",
);

// ── α1: hex users.service existence ──────────────────────────────────────────

describe("α1 hex users.service exists", () => {
  it("α1: modules/users/application/users.service.ts exists", () => {
    expect(existsSync(HEX_USERS_SERVICE)).toBe(true);
  });
});

// ── α2: hex users.repository existence ───────────────────────────────────────

describe("α2 hex users.repository exists", () => {
  it("α2: modules/users/infrastructure/users.repository.ts exists", () => {
    expect(existsSync(HEX_USERS_REPOSITORY)).toBe(true);
  });
});

// ── α3–α4: SHIM features/users/server.ts content sentinels ───────────────────

describe("α3–α4 SHIM features/users/server.ts content sentinels", () => {
  it("α3: SHIM is Option A static named re-export from canonical hex path", () => {
    const content = readFileSync(SHIM_USERS_SERVER, "utf-8");
    expect(content).toMatch(
      /^export \{ UsersService \} from "@\/modules\/users\/application\/users\.service";$/m,
    );
  });

  it("α4: SHIM preserves `import \"server-only\"` (lock-only — PASS pre-GREEN by design)", () => {
    const content = readFileSync(SHIM_USERS_SERVER, "utf-8");
    expect(content).toMatch(/^import ['"]server-only['"];?$/m);
  });
});

// ── α5–α6: hex users.service content sentinels ───────────────────────────────

describe("α5 hex users.service exports UsersService", () => {
  it("α5: hex users.service.ts exports `class UsersService`", () => {
    const content = readFileSync(HEX_USERS_SERVICE, "utf-8");
    expect(content).toMatch(/^export class UsersService\b/m);
  });
});

// ── α6–α8: hex users.repository content sentinels ────────────────────────────

describe("α6–α8 hex users.repository content sentinels", () => {
  it("α6: hex users.repository.ts exports `class UsersRepository`", () => {
    const content = readFileSync(HEX_USERS_REPOSITORY, "utf-8");
    expect(content).toMatch(/^export class UsersRepository\b/m);
  });

  it("α7: hex users.repository.ts exports `interface CreateUserInput` with optional `name?` field", () => {
    const content = readFileSync(HEX_USERS_REPOSITORY, "utf-8");
    expect(content).toMatch(/^export interface CreateUserInput\b/m);
    expect(content).toMatch(/name\?:/);
  });

  it("α8: hex users.repository.ts imports BaseRepository from `@/modules/shared/infrastructure/base.repository` (direct, NOT features/shared)", () => {
    const content = readFileSync(HEX_USERS_REPOSITORY, "utf-8");
    expect(content).toMatch(
      /^import \{ BaseRepository \} from "@\/modules\/shared\/infrastructure\/base\.repository";$/m,
    );
    expect(content).not.toMatch(/from ['"]@\/features\/shared/);
  });
});

// ── α9–α10: legacy paths must NOT exist post-relocation ──────────────────────

describe("α9–α10 legacy features/users/ files removed", () => {
  it("α9: features/users/users.service.ts does NOT exist", () => {
    expect(existsSync(LEGACY_USERS_SERVICE)).toBe(false);
  });

  it("α10: features/users/users.repository.ts does NOT exist", () => {
    expect(existsSync(LEGACY_USERS_REPOSITORY)).toBe(false);
  });
});

// ── α11–α12: server-only directive preservation on canonical files ───────────

describe("α11–α12 canonical files preserve `import \"server-only\"`", () => {
  it("α11: hex users.service.ts has `import \"server-only\"`", () => {
    const content = readFileSync(HEX_USERS_SERVICE, "utf-8");
    expect(content).toMatch(/^import ['"]server-only['"];?$/m);
  });

  it("α12: hex users.repository.ts has `import \"server-only\"`", () => {
    const content = readFileSync(HEX_USERS_REPOSITORY, "utf-8");
    expect(content).toMatch(/^import ['"]server-only['"];?$/m);
  });
});

// ── α13: NotFoundError direct canonical import (bypass features/shared SHIM) ─

describe("α13 hex users.service imports NotFoundError direct from canonical", () => {
  it("α13: hex users.service.ts imports NotFoundError from `@/modules/shared/domain/errors`", () => {
    const content = readFileSync(HEX_USERS_SERVICE, "utf-8");
    expect(content).toMatch(
      /^import \{ NotFoundError \} from "@\/modules\/shared\/domain\/errors";$/m,
    );
  });
});

// ── α14: sibling import form (verified against sister convention at apply) ───

describe("α14 hex users.service imports UsersRepository from canonical sibling path", () => {
  it("α14: hex users.service.ts imports `UsersRepository, type CreateUserInput` from canonical absolute path", () => {
    const content = readFileSync(HEX_USERS_SERVICE, "utf-8");
    expect(content).toMatch(
      /^import \{ UsersRepository, type CreateUserInput \} from "@\/modules\/users\/infrastructure\/users\.repository";$/m,
    );
  });
});
